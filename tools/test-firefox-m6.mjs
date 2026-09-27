import assert from 'node:assert/strict';

export async function runM6Tests({driver, check, runInExtension: run, report}) {
    await driver.manage().setTimeouts({script: 120000});
    await check('M6 remote staging survives local commit and late active pointer', async () => {
        report.syncStaging = await run(`
            const {store} = await import('./scripts/domains/quicklinks/store.js');
            await store.loadData();
            const id='qlink_m6_remote';
            const index='quicklinksChunkSet_m6remote_index', chunk='quicklinksChunkSet_m6remote_0';
            await chrome.storage.sync.set({[index]:[chunk], [chunk]:{[id]:{
                _id:id,title:'Remote',url:'https://example.com/remote',createdAt:1}}});
            await store.addItem({title:'Local',url:'https://example.com/local'});
            const local=await chrome.storage.sync.get(null);
            const retained=Boolean(local[chunk]?.[id]);
            await chrome.storage.sync.set({quicklinksActiveSet:'m6remote',quicklinksItems:[id]});
            await store.loadData();
            const recovered=store.getItem(id)?.title==='Remote' && !store._syncSnapshotIncomplete;
            await store._cleanupObsoleteStorage(local.quicklinksActiveSet,[index,chunk]);
            const stillPresent=Boolean((await chrome.storage.sync.get(chunk))[chunk]?.[id]);
            return {retained,recovered,stillPresent};`);
        assert.deepEqual(report.syncStaging, {retained:true, recovered:true, stillPresent:true});
    });
    await check('M6 link order arriving before matching chunks keeps the last complete view', async () => {
        report.syncOrder = await run(`
            const {store}=await import('./scripts/domains/quicklinks/store.js');
            await store.loadData();
            const saved=await chrome.storage.sync.get(null), before=store.getAllItems().map(i=>i._id);
            await chrome.storage.sync.set({quicklinksItems:['qlink_m6_late']});
            await store.loadData();
            const preserved=JSON.stringify(before)===JSON.stringify(store.getAllItems().map(i=>i._id));
            let blocked=false;
            try {await store._commit({apply:({items,dockPins})=>({items,dockPins})});}
            catch(e){blocked=e.message==='SYNC_SNAPSHOT_INCOMPLETE';}
            await chrome.storage.sync.set({quicklinksItems:saved.quicklinksItems});
            await store.loadData();
            return {preserved,blocked,recovered:!store._syncSnapshotIncomplete};`);
        assert.deepEqual(report.syncOrder, {preserved:true,blocked:true,recovered:true});
    });
    await check('M6 interrupted restore reports failure and a retry completes', async () => {
        report.restoreInterruption = await run(`
            const {BackupManager}=await import('./scripts/platform/backup-manager.js');
            const manager=new BackupManager();
            const put=async text=>{const db=await manager._openDatabase('aura-tab-assets',1,'images');
                await new Promise((r,j)=>{const tx=db.transaction('images','readwrite');tx.oncomplete=r;tx.onabort=tx.onerror=()=>j(tx.error);
                    tx.objectStore('images').put({id:'m6-interrupt',fullBlob:new Blob([text]),isUserPinned:true,status:'ready'});});db.close();};
            const read=async()=>{const db=await manager._openDatabase('aura-tab-assets',1,'images');
                const row=await new Promise((r,j)=>{const q=db.transaction('images').objectStore('images').get('m6-interrupt');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});db.close();return row.fullBlob.text();};
            await put('archive');await chrome.storage.local.set({m6RestoreMarker:'archive'});
            const backup=await manager.createBackup();
            await put('live');await chrome.storage.local.set({m6RestoreMarker:'live'});
            const interrupted=await manager.restoreFromBackup(backup,{onProgress:({stage})=>{
                if(stage==='restoreLocalFiles')throw new Error('M6_INJECTED_INTERRUPTION');}});
            const partial={blob:await read(),marker:(await chrome.storage.local.get('m6RestoreMarker')).m6RestoreMarker};
            const retry=await manager.restoreFromBackup(backup);
            return {interrupted,partial,retry,blob:await read(),marker:(await chrome.storage.local.get('m6RestoreMarker')).m6RestoreMarker};`);
        assert.equal(report.restoreInterruption.interrupted.success,false);
        assert.equal(report.restoreInterruption.interrupted.error,'M6_INJECTED_INTERRUPTION');
        // This deliberately demonstrates the documented lack of global rollback.
        assert.deepEqual(report.restoreInterruption.partial,{blob:'archive',marker:'live'});
        assert.equal(report.restoreInterruption.retry.success,true);
        assert.equal(report.restoreInterruption.blob,'archive');
        assert.equal(report.restoreInterruption.marker,'archive');
    });
    await check('M6 repeated tab teardown leaves background messaging and storage usable', async () => {
        const original=await driver.getWindowHandle(), url=await driver.getCurrentUrl();
        await run(`await chrome.storage.local.set({m6ContextMarker:'retained'});`);
        for(let i=0;i<20;i++) {
            await driver.switchTo().newWindow('tab');
            await driver.get(url);
            await driver.executeScript(`for(let i=0;i<8;i++){
                chrome.runtime.sendMessage({type:'fetchIcon',url:'file:///m6-invalid'}).catch(()=>{});
                chrome.storage.local.get('m6ContextMarker').catch(()=>{});
            }`);
            await driver.close();await driver.switchTo().window(original);
        }
        report.contextPressure=await run(`const replies=await Promise.all(Array.from({length:20},()=>
            chrome.runtime.sendMessage({type:'fetchIcon',url:'file:///m6-invalid'})));
            return {replies:replies.length,allReplied:replies.every(r=>r?.success===false),
                marker:(await chrome.storage.local.get('m6ContextMarker')).m6ContextMarker};`);
        assert.deepEqual(report.contextPressure,{replies:20,allReplied:true,marker:'retained'});
        report.contextPressure.closedTabs=20;
    });
    if (process.argv.includes('--live-bing')) {
        await check('M6 Bing refresh immediately after new-tab navigation completes', async () => {
            await run(`const {backgroundSettings}=await chrome.storage.sync.get('backgroundSettings');
                await chrome.storage.local.remove('currentBackground');
                await chrome.storage.sync.set({backgroundSettings:{...backgroundSettings,type:'bing',frequency:'never'}});`);
            await driver.navigate().refresh();
            const clickAtMs=await driver.executeScript(`document.getElementById('refreshBgBtn').click();return performance.now();`);
            await driver.wait(async()=>await run(`return (await chrome.storage.local.get('currentBackground')).currentBackground?.id?.startsWith('bing-')===true;`),60000);
            report.startupBing=await run(`const {currentBackground:bg}=await chrome.storage.local.get('currentBackground');
                const img=new Image();img.src=bg.urls.small;await img.decode();
                return {id:bg.id,width:img.naturalWidth,height:img.naturalHeight};`);
            assert.ok(report.startupBing.width>0 && report.startupBing.height>0);
            report.startupBing.clickAtMs=clickAtMs;
        });
    }
}
