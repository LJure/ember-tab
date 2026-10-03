// Executed inside real extension origins, never included in an extension package.
export const seedState = `
    const label=arguments[0];
    const {store}=await import('./scripts/domains/quicklinks/store.js');await store.init();
    const a=await store.addItem({_id:'qlink_step4_a',title:label+' 链接 A',url:'https://example.invalid/a',iconAppearance:{mode:'text',text:'迁',color:'blue'},tags:['migration']});
    const b=await store.addItem({_id:'qlink_step4_b',title:label+' 链接 B',url:'https://example.invalid/b',iconAppearance:{mode:'text',text:'移',color:'teal'}});
    const c=await store.addItem({_id:'qlink_step4_c',title:label+' 自定义图标',url:'https://example.invalid/c',icon:'https://images.example.invalid/custom.png'});
    const folder=await store.createFolder(label+' 文件夹',[b._id,a._id]);await store.pinToDock(c._id);await store.pinToDock(folder._id);
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
    const context=canvas.getContext('2d');context.fillStyle=label.startsWith('Firefox')?'#386641':'#334466';context.fillRect(0,0,640,480);
    context.fillStyle='#dd8844';context.fillRect(90,50,240,300);const image=await new Promise(r=>canvas.toBlob(r,'image/png'));
    const {localFilesManager}=await import('./scripts/domains/backgrounds/source-local.js');await localFilesManager.init();
    await localFilesManager.addFiles([new File([image],label+' #100%.png',{type:'image/png'})]);
    const fileIds=await localFilesManager.getAllFileIds();await localFilesManager.selectFile(fileIds.at(-1));
    const {iconCache}=await import('./scripts/platform/icon-cache.js');const {buildIconCacheKey}=await import('./scripts/shared/text.js');await iconCache.init();
    await iconCache.set(buildIconCacheKey(c.url,c.icon),image,c.icon);
    const {BackupManager}=await import('./scripts/platform/backup-manager.js');const manager=new BackupManager();
    for(const [name,record] of [
        ['aura-tab-assets',{id:'step4-asset',fullBlob:image,thumbnailBlob:image,status:'ready',isUserPinned:true}],
        ['aura-tab-toolbar-icon',{id:'step4-toolbar',imageBlob:image}]
    ]){
        const db=await manager._openDatabase(name,1,name.endsWith('assets')?'images':'icons');
        await new Promise((r,j)=>{const tx=db.transaction(name.endsWith('assets')?'images':'icons','readwrite');tx.oncomplete=r;tx.onabort=tx.onerror=()=>j(tx.error);tx.objectStore(name.endsWith('assets')?'images':'icons').put(record);});db.close();
    }
    const {backgroundSettings}=await chrome.storage.sync.get('backgroundSettings');
    await chrome.storage.sync.set({uiTheme:'dark',interfaceLanguage:'zh_CN',preferredSearchEngine:'bing',searchOpenInNewTab:false,
        quicklinksDockPosition:'top',step4SyncMarker:label,backgroundSettings:{...backgroundSettings,type:'files',frequency:'never',
            apiKeys:{pexels:'synthetic-'+label,wallhaven:'synthetic-private-'+label},wallhaven:{username:'fixture',collectionId:'ab12cd'}}});
    await chrome.storage.local.set({step4Marker:label,step4Seed:{folderId:folder._id,fileIds},
        webdavConfig:{baseUrl:'https://dav.example.invalid',username:label,password:'synthetic-only',remoteDir:'目录 #100%'},
        emberSearchHistory:[label+' 本机历史'],searchHistoryEnabled:true,searchSuggestionsEnabled:false,searchSuggestionSource:label.startsWith('Firefox')?'brave':'duckduckgo'});
    // Selection was seeded in a probe, so discard the first-install wallpaper snapshot.
    // The next real new-tab boot must resolve the selected local image from storage.
    await chrome.storage.local.remove('currentBackground');
    return {folderId:folder._id,fileIds};
`;

export const snapshotState = `
    const {store}=await import('./scripts/domains/quicklinks/store.js');await store.init();
    const {BackupManager}=await import('./scripts/platform/backup-manager.js');const manager=new BackupManager();const databases={};
    for(const [name,version,storeName] of [['aura-tab-local-files',1,'files'],['aura-tab-assets',1,'images'],['aura-tab-icon-cache',2,'icons'],['aura-tab-toolbar-icon',1,'icons']]){
        const db=await manager._openDatabase(name,version,storeName);
        const rows=await new Promise((r,j)=>{const request=db.transaction(storeName).objectStore(storeName).getAll();request.onsuccess=()=>r(request.result);request.onerror=()=>j(request.error);});db.close();
        databases[name]=await Promise.all(rows.map(async row=>({id:row.id||row.cacheKey,blobs:await Promise.all(Object.entries(row).filter(([,v])=>v instanceof Blob).map(async([field,blob])=>({field,size:blob.size,type:blob.type,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))).map(n=>n.toString(16).padStart(2,'0')).join('')})))})));
    }
    const local=await chrome.storage.local.get(['step4Marker','step4Seed','backgroundFiles','webdavConfig','emberSearchHistory','searchHistoryEnabled','searchSuggestionsEnabled','searchSuggestionSource']);
    const clean=value=>{if(Array.isArray(value))return value.map(clean);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!['lastUsed','lastAccessedAt','updatedAt'].includes(k)).map(([k,v])=>[k,clean(v)]));return value;};
    return {portable:{settings:await chrome.storage.sync.get(['uiTheme','interfaceLanguage','preferredSearchEngine','searchOpenInNewTab','quicklinksDockPosition','step4SyncMarker','pexelsApiKey','backgroundSettings']),
        links:store.getAllItemsFlat(),dock:store.getDockItems().map(x=>x._id),files:clean(local.backgroundFiles),databases},
        local:{step4Marker:local.step4Marker,step4Seed:local.step4Seed,webdavConfig:local.webdavConfig},
        private:await chrome.storage.local.get(['emberSearchHistory','searchHistoryEnabled','searchSuggestionsEnabled','searchSuggestionSource']),
        id:chrome.runtime.id,version:chrome.runtime.getManifest().version};
`;
