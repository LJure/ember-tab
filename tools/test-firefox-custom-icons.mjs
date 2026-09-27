import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';

export async function runCustomIconTests({driver,check,runInExtension:run,evidence,report}) {
    await driver.manage().setTimeouts({script:180000});
    const png=Buffer.from(await run(`const c=document.createElement('canvas');c.width=c.height=128;
        c.getContext('2d').fillRect(0,0,128,128);return c.toDataURL().split(',')[1];`),'base64');
    const requests=new Map();
    const server=createServer((req,res)=>{
        requests.set(req.url,(requests.get(req.url)||0)+1);
        if(req.url==='/missing.png'){res.writeHead(404,{'Cache-Control':'no-store'});return res.end();}
        if(req.url==='/retry.png'&&requests.get(req.url)===1){res.writeHead(503);return res.end();}
        res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'no-store'});res.flushHeaders();
        if(req.url==='/slow.png'){setTimeout(()=>res.end(png),5000);return;}
        res.end(png);
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin=`http://127.0.0.1:${server.address().port}`;
    const render=async(url,count=1)=>run(`const {createIconElement}=await import('./scripts/domains/quicklinks/icon-renderer.js');
        document.getElementById('custom-icon-test')?.remove();const host=document.createElement('div');host.id='custom-icon-test';
        host.style.cssText='position:fixed;top:150px;left:50px;display:flex;gap:30px;z-index:99999';document.body.appendChild(host);
        for(let i=0;i<arguments[1];i++)host.appendChild(createIconElement({title:'慢图',url:'https://example.test/link',icon:arguments[0]},i%2?'quicklink':'launchpad'));`,url,count);
    const loaded=()=>run(`return [...document.querySelectorAll('#custom-icon-test img')].every(img=>img.naturalWidth===128&&getComputedStyle(img).display!=='none')
        &&document.getElementById('custom-icon-test').textContent==='';`);
    try {
        await check('Custom image: slow body, visible placeholder, shared request and cache',async()=>{
            await render(origin+'/slow.png',3);
            await driver.wait(async()=>await run(`return document.getElementById('custom-icon-test').textContent.includes('慢');`),2000);
            await driver.wait(loaded,15000);
            assert.equal(requests.get('/slow.png'),1);
            const cache=await run(`const {iconCache}=await import('./scripts/platform/icon-cache.js');
                const {buildIconCacheKey}=await import('./scripts/shared/text.js');
                const entry=await iconCache.get(buildIconCacheKey('https://example.test/link',arguments[0]));return entry?.blob?.size;`,origin+'/slow.png');
            assert.equal(cache,png.length);
            await render(origin+'/slow.png');await driver.wait(loaded,2000);
            assert.equal(requests.get('/slow.png'),1);
        });
        await check('Custom image: transient HTTP failure retries and updates placeholder',async()=>{
            await render(origin+'/retry.png');await driver.wait(loaded,7000);
            assert.equal(requests.get('/retry.png'),2);
        });
        await check('Custom image: read-only editor preview uses the slow-image policy',async()=>{
            const result=await run(`const {setImageSrcWithFallback}=await import('./scripts/shared/favicon.js');
                const img=document.createElement('img');document.body.appendChild(img);
                return await new Promise(resolve=>setImageSrcWithFallback(img,[],()=>resolve({success:false}),{
                    cacheKey:'readonly-slow',customIconUrl:arguments[0],cacheMode:'read-only',onResolved:()=>resolve({success:true})}));`,origin+'/slow.png');
            assert.equal(result.success,true);
        });
        await check('Custom image: permanent failure shows a readable fallback',async()=>{
            const result=await run(`const {setImageSrcWithFallback}=await import('./scripts/shared/favicon.js');
                const img=document.createElement('img');const text=document.createElement('span');text.textContent='慢';
                document.body.append(img,text);const fallback=()=>{img.style.display='none';text.hidden=false;};
                return await new Promise(resolve=>setImageSrcWithFallback(img,[],()=>{
                    fallback();resolve({noSource:!img.hasAttribute('src'),fallbackVisible:!text.hidden});
                },{cacheKey:'missing-custom',customIconUrl:arguments[0],onPending:fallback}));`,origin+'/missing.png');
            assert.deepEqual(result,{noSource:true,fallbackVisible:true});
            // Background request plus direct-image fallback; no infinite retry.
            assert.ok(requests.get('/missing.png')>=1&&requests.get('/missing.png')<=2);
        });
        if(process.env.CUSTOM_ICON_TEST_URL){
            await check('Custom image: optional live user-provided image',async()=>{
                const start=Date.now();
                const result=await run(`const {fetchIconBlobViaBackground}=await import('./scripts/platform/icon-fetch-bridge.js');
                    const blob=await fetchIconBlobViaBackground(arguments[0],{customIcon:true});return {size:blob?.size||0,type:blob?.type||''};`,process.env.CUSTOM_ICON_TEST_URL);
                report.liveCustomImage={...result,elapsedMs:Date.now()-start};assert.ok(result.size>0);
            });
        }
        report.customIconRequests=Object.fromEntries(requests);
        await writeFile(path.join(evidence,'custom-icons.png'),await driver.takeScreenshot(),'base64');
    } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
