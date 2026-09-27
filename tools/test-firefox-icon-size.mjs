import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';

export async function runIconSizeTests({driver, check, runInExtension:run, report, evidence}) {
    await driver.manage().setTimeouts({script:60000});
    await run(`const {iconCache}=await import('./scripts/platform/icon-cache.js');
        const {buildIconCacheKey}=await import('./scripts/shared/text.js');
        const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
        const ctx=canvas.getContext('2d');ctx.fillStyle='#ff2442';ctx.fillRect(10,10,108,108);
        const blob=await new Promise(r=>canvas.toBlob(r));
        await iconCache.set(buildIconCacheKey('https://padded.example/'),blob,'https://padded.example/icon.png');
        await iconCache.set(buildIconCacheKey('https://custom.example/','https://custom.example/icon.png'),blob,'https://custom.example/icon.png');
        window.originalPaddedBytes=blob.size;
        const {createIconElement}=await import('./scripts/domains/quicklinks/icon-renderer.js');
        const host=document.createElement('div');host.id='size-test';host.style.cssText='position:fixed;top:100px;left:100px;display:flex;gap:40px;padding:30px;background:#333;z-index:99999;--ql-icon-size:64px';
        document.body.appendChild(host);
        for(const [name,url,icon,prefix] of [['Auto Dock','https://padded.example/','','quicklink'],['Auto Grid','https://padded.example/','','launchpad'],['Custom','https://custom.example/','https://custom.example/icon.png','quicklink']]){
            const section=document.createElement('div');section.dataset.name=name;section.style.color='white';
            section.appendChild(createIconElement({title:name,url,icon},prefix));const label=document.createElement('p');label.textContent=name;section.appendChild(label);host.appendChild(section);
        }`);
    await driver.wait(async()=>run(`return [...document.querySelectorAll('#size-test img')].every(i=>i.complete&&i.naturalWidth>0);`),10000);
    await check('Automatic cached icons fill equal Dock and Launchpad image boxes',async()=>{
        report.iconSize=await run(`return [...document.querySelectorAll('#size-test img')].map(img=>({
            name:img.closest('[data-name]').dataset.name,width:img.naturalWidth,height:img.naturalHeight,
            displayWidth:img.getBoundingClientRect().width}));`);
        assert.equal(report.iconSize[0].width,108);assert.equal(report.iconSize[1].width,108);
        assert.equal(report.iconSize[0].height,108);assert.equal(report.iconSize[1].height,108);
        assert.equal(report.iconSize[0].displayWidth,report.iconSize[2].displayWidth);
    });
    await check('Custom images preserve their original padding',async()=>{
        assert.equal(report.iconSize[2].width,128);assert.equal(report.iconSize[2].height,128);
    });
    await check('Display normalization preserves original cache bytes and source',async()=>{
        const result=await run(`const {iconCache}=await import('./scripts/platform/icon-cache.js');
            const {buildIconCacheKey}=await import('./scripts/shared/text.js');
            const entry=await iconCache.get(buildIconCacheKey('https://padded.example/'));
            const image=await createImageBitmap(entry.blob);const result={width:image.width,size:entry.blob.size,expectedSize:window.originalPaddedBytes,source:entry.sourceUrl};image.close();return result;`);
        assert.equal(result.width,128);assert.equal(result.size,result.expectedSize);assert.equal(result.source,'https://padded.example/icon.png');
    });
    if(process.argv.includes('--live-icon-size')) {
        await check('Live Xiaohongshu automatic icon and cached reload remove transparent padding',async()=>{
            await run(`const {createIconElement}=await import('./scripts/domains/quicklinks/icon-renderer.js');
                const host=document.getElementById('size-test');const section=document.createElement('div');section.id='live-size';
                section.appendChild(createIconElement({title:'小红书',url:'https://www.xiaohongshu.com/'},'launchpad'));host.appendChild(section);`);
            await driver.wait(async()=>run(`const img=document.querySelector('#live-size img');return img?.complete&&img.naturalWidth>0;`),45000);
            report.liveIconSize=await run(`const {iconCache}=await import('./scripts/platform/icon-cache.js');
                const {buildIconCacheKey}=await import('./scripts/shared/text.js');
                const entry=await iconCache.get(buildIconCacheKey('https://www.xiaohongshu.com/'));
                const original=await createImageBitmap(entry.blob);const img=document.querySelector('#live-size img');
                const result={source:entry.sourceUrl,originalWidth:original.width,originalHeight:original.height,displayWidth:img.naturalWidth,displayHeight:img.naturalHeight};original.close();return result;`);
            assert.ok(report.liveIconSize.displayWidth<report.liveIconSize.originalWidth);
            await run(`const {createIconElement}=await import('./scripts/domains/quicklinks/icon-renderer.js');
                document.getElementById('live-size').replaceChildren(createIconElement({title:'小红书',url:'https://www.xiaohongshu.com/'},'quicklink'));`);
            await driver.wait(async()=>run(`return document.querySelector('#live-size img')?.naturalWidth===arguments[0];`,report.liveIconSize.displayWidth),10000);
        });
    }
    await writeFile(path.join(evidence,'icon-size.png'),await driver.takeScreenshot(),'base64');
}
