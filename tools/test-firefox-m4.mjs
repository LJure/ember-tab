import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {unzipSync, strFromU8} from '../scripts/libs/fflate.esm.js';
import firefox from 'selenium-webdriver/firefox.js';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

async function measureFirefoxMemory(pid, task) {
    if(process.platform!=='win32') return {result:await task(),memory:null};
    assert.ok(Number.isInteger(pid)&&pid>0);
    const sample=async()=>{
        const script=`$rows=Get-CimInstance Win32_Process -Filter "name='firefox.exe'"; $ids=[System.Collections.Generic.HashSet[int]]::new();[void]$ids.Add(${pid});
            do {$added=$false;foreach($p in $rows){if($ids.Contains([int]$p.ParentProcessId) -and $ids.Add([int]$p.ProcessId)){$added=$true}}}while($added);
            ($rows | Where-Object {$ids.Contains([int]$_.ProcessId)} | Measure-Object WorkingSetSize -Sum).Sum`;
        const {stdout}=await promisify(execFile)('powershell.exe',['-NoProfile','-Command',script],{windowsHide:true});return Number(stdout.trim());
    };
    const baseline=await sample();let peak=baseline,stop=false,samples=1;
    const monitoring=(async()=>{while(!stop){peak=Math.max(peak,await sample());samples++;if(!stop)await new Promise(r=>setTimeout(r,500));}})();
    try {return {result:await task(),memory:await (async()=>{stop=true;await monitoring;return {baselineBytes:baseline,observedPeakBytes:peak,samples,intervalMs:500};})()};}
    finally {stop=true;await monitoring;}
}

export async function runM4Tests({driver,check,runInExtension:run,evidence,report,project}) {
    const current=await driver.getWindowHandle();
    for(const handle of await driver.getAllWindowHandles()) if(handle!==current) {
        await driver.switchTo().window(handle);await driver.close();
    }
    await driver.switchTo().window(current);
    await driver.manage().setTimeouts({script:120000});
    await run(`const {backgroundSettings}=await chrome.storage.sync.get('backgroundSettings');
        await chrome.storage.sync.set({backgroundSettings:{...backgroundSettings,type:'color',color:'#243b53'}});`);
    await driver.wait(async()=>await driver.executeScript('return document.documentElement.style.getPropertyValue("--solid-background")==="#243b53"'),10000);
    const files=new Map(), dirs=new Set(['/dav/']);let mode='normal';const requests=[];
    const server=createServer(async(req,res)=>{
        const pathname=new URL(req.url,'http://localhost').pathname;
        requests.push({method:req.method,path:pathname});
        if(req.headers.authorization!=='Basic '+Buffer.from('fixture:synthetic-password').toString('base64')) {res.writeHead(401);return res.end();}
        if(mode==='denied') {res.writeHead(403);return res.end();}
        if(mode==='stall' && req.method==='GET') {res.writeHead(200);res.flushHeaders();return;}
        if(mode==='broken' && req.method==='GET') {res.writeHead(200,{'Content-Length':'100000'});res.write('partial');return res.destroy();}
        if(req.method==='MKCOL') {dirs.add(pathname);res.writeHead(201);return res.end();}
        if(req.method==='PUT') {const chunks=[];for await(const c of req) chunks.push(c);files.set(pathname,Buffer.concat(chunks));res.writeHead(201);return res.end();}
        if(req.method==='GET') {if(!files.has(pathname)){res.writeHead(404);return res.end();}res.writeHead(200,{'Content-Type':'application/zip'});return res.end(files.get(pathname));}
        if(req.method==='DELETE') {files.delete(pathname);res.writeHead(204);return res.end();}
        if(req.method==='PROPFIND') {
            if(!dirs.has(pathname)) {res.writeHead(404);return res.end();}
            res.writeHead(207,{'Content-Type':'application/xml'});
            const items=req.headers.depth==='1'?[...files.entries()].filter(([p])=>p.startsWith(pathname)):[];
            return res.end('<z:multistatus xmlns:z="DAV:">'+items.map(([p,b])=>`<z:response><z:href>${p}</z:href><z:propstat><z:prop><z:getcontentlength>${b.length}</z:getcontentlength><z:getlastmodified>Sun, 27 Sep 2026 00:00:00 GMT</z:getlastmodified></z:prop><z:status>HTTP/1.1 200 OK</z:status></z:propstat></z:response>`).join('')+'</z:multistatus>');
        }
        res.writeHead(405);res.end();
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const config={baseUrl:`http://127.0.0.1:${server.address().port}/dav`,username:'fixture',password:'synthetic-password',remoteDir:'测试 # 100%/Backups',timeoutMs:1500};
    try {
        await check('M4 seed real storage, image blobs and custom icon cache',async()=>{
            const result=await run(`const {store}=await import('./scripts/domains/quicklinks/store.js');await store.init();
                await store.addItem({title:'M4 中文 link',url:'https://example.test/m4'});
                const c=document.createElement('canvas');c.width=640;c.height=480;
                c.getContext('2d').fillRect(0,0,640,480);const image=await new Promise(r=>c.toBlob(r));
                const {localFilesManager}=await import('./scripts/domains/backgrounds/source-local.js');
                await localFilesManager.init();await localFilesManager.addFiles([new File([image],'m4.png',{type:'image/png'})]);
                const {iconCache}=await import('./scripts/platform/icon-cache.js');await iconCache.init();
                await iconCache.set('m4/a',new Blob(['icon-A'],{type:'image/png'}),'https://example.test/a');
                await iconCache.set('m4-b',new Blob(['icon-B'],{type:'image/png'}),'https://example.test/b');
                await chrome.storage.sync.set({m4Marker:'原始设置'});
                await chrome.storage.local.set({m4Marker:'local original',webdavConfig:arguments[0]});
                const {BackupManager}=await import('./scripts/platform/backup-manager.js');
                const db=await new BackupManager()._openDatabase('aura-tab-assets',1,'images');
                await new Promise((r,j)=>{const tx=db.transaction('images','readwrite');tx.oncomplete=r;tx.onerror=()=>j(tx.error);
                    tx.objectStore('images').put({id:'m4-asset',fullBlob:image,thumbnailBlob:image,status:'ready',isUserPinned:true});});db.close();
                return {files:(await localFilesManager.getAllFileIds()).length,locks:!!navigator.locks};`,config);
            assert.equal(result.files,1);assert.equal(result.locks,true);
        });
        await check('M4 upstream exporter ZIP imports into Ember with image data',async()=>{
            const result=await run(`const {BackupManager:Upstream}=await import('./scripts/platform/backup-manager-upstream.js');
                window.m4LegacyBackup=await new Upstream().createBackup();
                const {BackupManager}=await import('./scripts/platform/backup-manager.js');window.m4Manager=new BackupManager();
                await chrome.storage.sync.set({m4Marker:'changed'});
                const result=await window.m4Manager.restoreFromBackup(window.m4LegacyBackup);
                return {result,marker:(await chrome.storage.sync.get('m4Marker')).m4Marker};`);
            assert.equal(result.result.success,true,JSON.stringify(result));assert.equal(result.marker,'原始设置');
        });
        await check('M4 own ZIP round trip preserves settings, links, icons and image bytes',async()=>{
            const result=await run(`const m=window.m4Manager;
                // Reseed two keys whose old sanitized ZIP paths collide.
                const {iconCache}=await import('./scripts/platform/icon-cache.js');
                await iconCache.set('m4/a',new Blob(['icon-A']),'https://example.test/a');
                await iconCache.set('m4:a',new Blob(['icon-B']),'https://example.test/b');
                const snapshot=async()=>{const out={};for(const [name,store] of [['aura-tab-local-files','files'],['aura-tab-icon-cache','icons'],['aura-tab-assets','images']]){
                    const db=await m._openDatabase(name,name.includes('icon')?2:1,store);
                    const rows=await new Promise((r,j)=>{const q=db.transaction(store).objectStore(store).getAll();q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});db.close();
                    out[name]=await Promise.all(rows.map(async row=>({id:row.id||row.cacheKey,blobs:await Promise.all(Object.entries(row).filter(([,v])=>v instanceof Blob).map(async([k,v])=>[k,Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await v.arrayBuffer()))).join(',')]))})));}return out;};
                window.m4Snapshot=snapshot;const before=await snapshot();const syncBefore=await chrome.storage.sync.get(null);window.m4Backup=await m.createBackup();
                await chrome.storage.sync.set({m4Marker:'changed again'});await chrome.storage.local.set({m4Extra:true});
                const result=await m.restoreFromBackup(window.m4Backup);
                return {result,before,after:await snapshot(),syncBefore,sync:await chrome.storage.sync.get(null),local:await chrome.storage.local.get(['m4Extra','webdavConfig'])};`);
            assert.equal(result.result.success,true);assert.deepEqual(result.after,result.before);
            assert.deepEqual(result.sync,result.syncBefore);assert.ok(!('m4Extra' in result.local));assert.deepEqual(result.local.webdavConfig,config);
        });
        await check('M4 corrupt, incomplete and oversized-quota archives preserve live data',async()=>{
            const before=await run('return await window.m4Snapshot();');
            const result=await run(`const {unzipSync,zipSync,strToU8}=await import('./scripts/libs/fflate.esm.js');
                const original=unzipSync(new Uint8Array(await window.m4Backup.arrayBuffer()));const results=[];
                const {BackupManager:Upstream}=await import('./scripts/platform/backup-manager-upstream.js');
                results.push(await window.m4Manager.restoreFromBackup(await new Upstream().createBackup()));
                for(const kind of ['missing','size','key','quota','garbage']){
                    const entries={...original};
                    if(kind==='missing') delete entries[Object.keys(entries).find(k=>k.includes('/blobs/'))];
                    if(kind==='size'||kind==='key'){const p='idb/local-files/index.json';const index=JSON.parse(new TextDecoder().decode(entries[p]));
                        if(kind==='key')delete index[0].id;else index[0].fullBlob.size++;entries[p]=strToU8(JSON.stringify(index));}
                    if(kind==='quota')entries['storage/sync.json']=strToU8(JSON.stringify({m4Marker:'x'.repeat(9000)}));
                    const blob=new Blob([kind==='garbage'?new Uint8Array([1,2,3]):zipSync(entries)]);
                    results.push(await window.m4Manager.restoreFromBackup(blob));
                }
                return {results,marker:(await chrome.storage.sync.get('m4Marker')).m4Marker,snapshot:await window.m4Snapshot()};`);
            assert.ok(result.results.every(r=>r.success===false),JSON.stringify(result.results));assert.equal(result.marker,'原始设置');
            assert.deepEqual(result.snapshot,before);
            report.invalidArchives=result.results;
        });
        await check('M4 Firefox native download fallback produces a readable ZIP',async()=>{
            const existing=new Set(await readdir(evidence));
            const result=await run('return await window.m4Manager.downloadBackupStreaming();');
            assert.deepEqual(result,{success:true,usedStreaming:false});
            let file;
            await driver.wait(async()=>{file=(await readdir(evidence)).find(n=>!existing.has(n)&&n.startsWith('aura-tab-backup_')&&n.endsWith('.zip'));return !!file;},10000);
            let zip;
            await driver.wait(async()=>{try{zip=unzipSync(await readFile(path.join(evidence,file)));return true;}catch{return false;}},10000);
            assert.equal(JSON.parse(strFromU8(zip['storage/sync.json'])).m4Marker,'原始设置');
            assert.ok(!('webdavConfig' in JSON.parse(strFromU8(zip['storage/local.json']))));
        });
        await check('M4 OPFS upload backup capability and temporary file cleanup',async()=>{
            const result=await run(`window.m4Upload=await window.m4Manager.createBackupForUpload();
                const streaming=window.m4Upload.usedStreaming;const size=window.m4Upload.blob.size;
                await window.m4Upload.cleanup?.();let count=null;
                if(streaming){const root=await navigator.storage.getDirectory();const dir=await root.getDirectoryHandle('aura-tab-tmp');count=0;for await(const _entry of dir.values())count++;}
                return {streaming,size,count};`);
            assert.ok(result.size>100);if(result.streaming)assert.equal(result.count,0);report.opfs=result;
        });
        await check('M4 WebDAV connection, nested directory, PUT, namespace listing, GET and restore',async()=>{
            const result=await run(`const {WebDAVClient}=await import('./scripts/shared/webdav-client.js');
                window.m4Dav=new WebDAVClient(arguments[0]);const client=window.m4Dav;
                const connection=await client.testConnection();const directory=await client.ensureDir();
                const put=await client.putFile('测试 # 100%.zip',window.m4Backup);const files=await client.listFiles();
                const blob=await client.getFile('测试 # 100%.zip');const restore=await window.m4Manager.restoreFromBackup(blob);
                return {connection,directory,put,files,restore,size:blob.size,expectedSize:window.m4Backup.size};`,config);
            assert.equal(result.connection.success,true);assert.equal(result.directory,true);assert.equal(result.put,true);
            assert.equal(result.files[0].filename,'测试 # 100%.zip');assert.equal(result.size,result.expectedSize);assert.equal(result.restore.success,true);
        });
        await check('M4 WebDAV auth, denied listing, stalled body and interrupted transfer fail visibly',async()=>{
            assert.equal((await run(`const {WebDAVClient}=await import('./scripts/shared/webdav-client.js');return new WebDAVClient({...arguments[0],password:'wrong'}).testConnection();`,config)).message,'auth_failed');
            mode='denied';assert.equal(await run(`try{await window.m4Dav.listFiles();return false;}catch{return true;}`),true);
            for(const failure of ['stall','broken']) {mode=failure;assert.equal(await run(`return await window.m4Dav.getFile('测试 # 100%.zip');`),null);}
            mode='normal';assert.equal(await run(`return await window.m4Dav.deleteFile('测试 # 100%.zip');`),true);
        });
        await check('M4 two tabs commit concurrently without losing links or exceeding chunk size',async()=>{
            const first=await driver.getWindowHandle();
            const prepare=async prefix=>run(`const {store}=await import('./scripts/domains/quicklinks/store.js');await store.init();
                const prefix=arguments[0];window.m4Concurrent=new Promise(resolve=>{
                    const handler=(changes,area)=>{if(area==='local'&&changes.m4StartWrites){chrome.storage.onChanged.removeListener(handler);resolve();}};
                    chrome.storage.onChanged.addListener(handler);
                }).then(()=>store.bulkAddItems([{pageIndex:1,items:Array.from({length:40},(_,i)=>({title:prefix+i,url:'https://example.test/'+prefix+i}))}]));`,prefix);
            await prepare('m4-A-');
            await driver.setContext(firefox.Context.CHROME);await driver.executeScript('BrowserCommands.openTab();');
            await driver.setContext(firefox.Context.CONTENT);await driver.switchTo().window((await driver.getAllWindowHandles()).at(-1));
            const second=await driver.getWindowHandle();
            await prepare('m4-B-');
            await run('await chrome.storage.local.set({m4StartWrites:Date.now()});');
            assert.equal((await run('return await window.m4Concurrent;')).success,40);
            await driver.switchTo().window(first);assert.equal((await run('return await window.m4Concurrent;')).success,40);
            const result=await run(`const {store}=await import('./scripts/domains/quicklinks/store.js');await store.loadData();
                const data=await chrome.storage.sync.get(null);return {count:store.getAllItems().filter(i=>/^m4-[AB]-/.test(i.title)).length,
                    chunks:data['quicklinksChunkSet_'+data.quicklinksActiveSet+'_index'].length,
                    sizes:Object.entries(data).map(([k,v])=>new TextEncoder().encode(k+JSON.stringify(v)).length),bytes:await chrome.storage.sync.getBytesInUse(null)};`);
            assert.equal(result.count,80);assert.ok(result.chunks>=2);assert.ok(Math.max(...result.sizes)<=8192);assert.ok(result.bytes<=102400);
            report.concurrentStore=result;
            await driver.switchTo().window(second);await driver.close();await driver.switchTo().window(first);
        });
        await check('M4 partial Sync delivery preserves data and recovers when chunks arrive',async()=>{
            const result=await run(`const {store}=await import('./scripts/domains/quicklinks/store.js');await store.loadData();
                const before=store.getAllItems().map(i=>i._id);const saved=await chrome.storage.sync.get(null);
                const index='quicklinksChunkSet_m4remote_index';
                const sourceKeys=saved['quicklinksChunkSet_'+saved.quicklinksActiveSet+'_index'];
                const keys=sourceKeys.map((_,i)=>'quicklinksChunkSet_m4remote_'+i);
                await chrome.storage.sync.set({quicklinksActiveSet:'m4remote'});await store.loadData();
                const preserved=JSON.stringify(store.getAllItems().map(i=>i._id))===JSON.stringify(before);
                let blocked=false;try{await store._commit({apply:({items,dockPins})=>({items,dockPins})});}catch(e){blocked=e.message==='SYNC_SNAPSHOT_INCOMPLETE';}
                await chrome.storage.sync.set({[index]:keys});await store.loadData();const incomplete=store._syncSnapshotIncomplete;
                await chrome.storage.sync.set(Object.fromEntries(keys.map((k,i)=>[k,saved[sourceKeys[i]]])));await store.loadData();
                const recovered=!store._syncSnapshotIncomplete&&JSON.stringify(store.getAllItems().map(i=>i._id))===JSON.stringify(before);
                await chrome.storage.sync.set({quicklinksActiveSet:saved.quicklinksActiveSet});await store.loadData();
                await chrome.storage.sync.remove([index,...keys]);
                return {preserved,blocked,incomplete,recovered,restored:store.getAllItems().length===before.length,chunks:sourceKeys.length};`);
            assert.ok(result.preserved&&result.blocked&&result.incomplete&&result.recovered&&result.restored);report.partialSync=result;
        });
        await check('M4 Firefox rejects an oversized storage.sync key without writing it',async()=>{
            const result=await run(`let rejected=false;try{await chrome.storage.sync.set({m4Oversized:'x'.repeat(9000)});}catch{rejected=true;}
                return {rejected,absent:!('m4Oversized' in await chrome.storage.sync.get('m4Oversized'))};`);
            assert.deepEqual(result,{rejected:true,absent:true});
        });
        await check('M4 32 MiB binary library streams through OPFS and restores with matching hashes',async()=>{
            await run(`const bytes=new Uint8Array(8*1024*1024);for(let i=0;i<bytes.length;i+=65536)crypto.getRandomValues(bytes.subarray(i,i+65536));
                window.m4LargeHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).join(',');
                const blob=new Blob([bytes],{type:'application/octet-stream'});const db=await window.m4Manager._openDatabase('aura-tab-assets',1,'images');
                await new Promise((r,j)=>{const tx=db.transaction('images','readwrite');tx.oncomplete=r;tx.onerror=()=>j(tx.error);
                    for(let i=0;i<4;i++)tx.objectStore('images').put({id:'m4-large-'+i,fullBlob:blob,thumbnailBlob:new Blob(['thumb']),isUserPinned:true,status:'ready'});});db.close();`);
            const pid=(await driver.getCapabilities()).get('moz:processID');
            report.largeBackup=await measureFirefoxMemory(pid,()=>run(`const start=performance.now();const upload=await window.m4Manager.createBackupForUpload();
                try {const exportedMs=performance.now()-start;const size=upload.blob.size;const restore=await window.m4Manager.restoreFromBackup(upload.blob);
                    const db=await window.m4Manager._openDatabase('aura-tab-assets',1,'images');const rows=await new Promise((r,j)=>{const q=db.transaction('images').objectStore('images').getAll();q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});db.close();
                    const large=rows.filter(r=>r.id.startsWith('m4-large-'));const hashes=await Promise.all(large.map(async r=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await r.fullBlob.arrayBuffer()))).join(',')));
                    return {inputBytes:4*8*1024*1024,archiveBytes:size,usedStreaming:upload.usedStreaming,exportedMs,totalMs:performance.now()-start,restore,count:large.length,hashesMatch:hashes.every(h=>h===window.m4LargeHash)};
                } finally {await upload.cleanup?.();}`));
            assert.equal(report.largeBackup.result.restore.success,true);assert.equal(report.largeBackup.result.count,4);assert.equal(report.largeBackup.result.hashesMatch,true);
        });
        await check('M4 disabled and reenabled extension preserves storage and blobs',async()=>{
            const expected=await run('return window.m4LargeHash;');
            // Keep a normal tab alive: disabling closes all extension tabs.
            await driver.switchTo().newWindow('tab');
            await driver.setContext(firefox.Context.CHROME);
            await run(`const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
                const addon=await AddonManager.getAddonByID(arguments[0]);await addon.disable();await addon.enable();`,project.geckoId);
            await driver.executeScript('BrowserCommands.openTab();');await driver.setContext(firefox.Context.CONTENT);
            await driver.switchTo().window((await driver.getAllWindowHandles()).at(-1));
            await driver.wait(async()=>await run('return (await chrome.storage.sync.get("m4Marker")).m4Marker==="原始设置"'),10000);
            const actual=await run(`const {BackupManager}=await import('./scripts/platform/backup-manager.js');
                const db=await new BackupManager()._openDatabase('aura-tab-assets',1,'images');
                const row=await new Promise((r,j)=>{const q=db.transaction('images').objectStore('images').get('m4-large-0');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});db.close();
                return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await row.fullBlob.arrayBuffer()))).join(',');`);
            assert.equal(actual,expected);
        });
        report.webdavRequests=requests;
        await writeFile(path.join(evidence,'m4-ui.png'),await driver.takeScreenshot(),'base64');
    } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
