import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { By, Key } from 'selenium-webdriver';
import firefox from 'selenium-webdriver/firefox.js';

export async function runM3Tests({driver, check, runInExtension: run, evidence, uuid, report}) {
    const click = async selector => {
        const el = await driver.findElement(By.css(selector));
        await driver.wait(async () => driver.executeScript(`const el=arguments[0],r=el.getBoundingClientRect();
            return r.width>0 && r.height>0 && el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));`,el),5000);
        await el.click();
    };
    const png = Buffer.from(await run(`const c=document.createElement('canvas'); c.width=128;c.height=128;
        const ctx=c.getContext('2d');ctx.fillStyle='#d97942';ctx.fillRect(0,0,128,128);
        return c.toDataURL('image/png').split(',')[1];`), 'base64');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#d97942"/></svg>';
    const requests = [];
    let conventional = false;
    const server = createServer((req, res) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        requests.push(pathname);
        const send = (type, body) => { res.writeHead(200, {'Content-Type':type}); res.end(body); };
        if (pathname === '/declared') return send('text/html', '<base href="/assets/"><link rel="icon" href="icon.svg"><img src="/unwanted-subresource"><script>fetch("/unwanted-script")</script>');
        if (pathname === '/redirect') { res.writeHead(302, {Location:'/declared'}); return res.end(); }
        if (pathname === '/manifest-page') return send('text/html', '<link rel="manifest" href="/site.webmanifest">');
        if (pathname === '/site.webmanifest') return send('application/manifest+json', JSON.stringify({icons:[{src:'/assets/icon.svg',sizes:'128x128',purpose:'any'}]}));
        if (pathname === '/broken-page') return send('text/html', '<link rel="icon" href="/broken.png">');
        if (pathname === '/broken.png') return send('image/png', 'broken image');
        if (pathname === '/assets/icon.svg') return send('image/svg+xml', svg);
        if (pathname === '/image.png' || (pathname === '/favicon.ico' && conventional)) return send('image/png', png);
        if (pathname === '/slow.png') {
            res.writeHead(200, {'Content-Type':'image/png'}); res.flushHeaders();
            return; // Deliberately stalls after headers, testing the body deadline.
        }
        if (pathname === '/huge.png') return send('image/png', Buffer.alloc(600 * 1024));
        if (pathname === '/empty' || pathname === '/conventional') return send('text/html', '<title>Fixture</title>');
        if (pathname === '/search') return send('text/html', '<title>Ember search fixture</title>Search fixture');
        res.writeHead(404); res.end();
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const discover = suffix => run('return await chrome.runtime.sendMessage({type:"discoverIcon",url:arguments[0]})', origin + suffix);
    const openNewTab = async () => {
        await driver.setContext(firefox.Context.CHROME);
        await driver.executeScript('BrowserCommands.openTab();');
        await driver.setContext(firefox.Context.CONTENT);
        await driver.switchTo().window((await driver.getAllWindowHandles()).at(-1));
        await driver.wait(async () => (await driver.getCurrentUrl()).startsWith(`moz-extension://${uuid}/`), 10000);
        await driver.wait(async () => (await driver.findElement(By.id('searchInput')).getAttribute('placeholder')).length > 0, 10000);
    };
    try {
        await check('M3 declared SVG, base URL, redirect and manifest icon discovery', async () => {
            for (const [suffix, kind] of [['/declared','html-icon'], ['/redirect','html-icon'], ['/manifest-page','manifest']]) {
                const result = await discover(suffix);
                assert.equal(result.success, true, JSON.stringify(result));
                assert.equal(result.meta.sourceKind, kind);
                assert.equal(result.meta.sourceUrl, origin + '/assets/icon.svg');
                assert.equal(result.meta.width, 128);
            }
            assert.ok(!requests.includes('/unwanted-script'));
            assert.ok(!requests.includes('/unwanted-subresource'));
            assert.ok(!requests.some(url => url.includes('_favicon')));
        });
        await check('M3 conventional favicon, corrupt image and absent icon fallback', async () => {
            conventional = true;
            assert.equal((await discover('/conventional')).meta.sourceKind, 'conventional');
            conventional = false;
            for (const suffix of ['/broken-page', '/empty']) {
                assert.deepEqual(await discover(suffix), {success:false,error:'No valid favicon found'});
            }
        });
        await check('M3 icon byte limit and stalled response deadline', async () => {
            const large = await run('return await chrome.runtime.sendMessage({type:"fetchIcon",url:arguments[0]})', origin+'/huge.png');
            assert.equal(large.success, false); assert.equal(large.error, 'Response too large');
            const before = Date.now();
            const slow = await run('return await chrome.runtime.sendMessage({type:"fetchIcon",url:arguments[0]})', origin+'/slow.png');
            assert.equal(slow.success, false); assert.equal(slow.error, 'Request timed out');
            assert.ok(Date.now()-before < 6500);
        });
        await check('M3 manual icon blob cache and offline reuse', async () => {
            const cached = await run(`const {fetchIconBlobViaBackground} = await import('./scripts/platform/icon-fetch-bridge.js');
                const {iconCache} = await import('./scripts/platform/icon-cache.js');
                const blob = await fetchIconBlobViaBackground(arguments[0]);
                await iconCache.init(); await iconCache.set('m3-manual',blob,arguments[0]);
                const entry = await iconCache.get('m3-manual'); return {size:entry.blob.size, type:entry.blob.type};`, origin+'/image.png');
            assert.equal(cached.size, png.length);
            const before = requests.length;
            const loaded = await run(`const {iconCache} = await import('./scripts/platform/icon-cache.js');
                const entry = await iconCache.get('m3-manual');
                const img = new Image(); const url = URL.createObjectURL(entry.blob);
                try { img.src=url; await img.decode(); return img.naturalWidth; } finally { URL.revokeObjectURL(url); }`);
            assert.ok(loaded >= 32); assert.equal(requests.length, before);
        });
        await check('M3 real Firefox bookmark roots, separators, duplicates and import', async () => {
            const result = await run(`const root = (await chrome.bookmarks.getTree())[0];
                for (const folder of root.children) for (const child of folder.children || []) await chrome.bookmarks.removeTree(child.id);
                const url = arguments[0];
                await chrome.bookmarks.create({parentId:'toolbar_____',title:'A',url:url+'/a'});
                await chrome.bookmarks.create({parentId:'toolbar_____',type:'separator'});
                const nested = await chrome.bookmarks.create({parentId:'toolbar_____',title:'M3 Nested'});
                const inner = await chrome.bookmarks.create({parentId:nested.id,title:'Inner'});
                await chrome.bookmarks.create({parentId:inner.id,title:'B',url:url+'/b'});
                await chrome.bookmarks.create({parentId:'toolbar_____',title:'M3 Empty'});
                await chrome.bookmarks.create({parentId:'menu________',title:'Duplicate A',url:url+'/a'});
                await chrome.bookmarks.create({parentId:'unfiled_____',title:'C',url:url+'/c'});
                const {store} = await import('./scripts/domains/quicklinks/store.js'); await store.init();
                const {bookmarkImporter} = await import('./scripts/domains/bookmarks/importer.js');
                const parsed = await bookmarkImporter.parseBookmarkTree();
                const preview = bookmarkImporter.previewImport({selectedFolders:new Set(parsed.folders.keys())});
                const result = await bookmarkImporter.executeImport(preview.pages);
                return {stats:parsed.stats, loose:parsed.looseBookmarks, total:preview.totalItems, result};`, origin);
            assert.equal(result.stats.totalBookmarks, 3, JSON.stringify(result)); assert.equal(result.stats.duplicateCount, 1);
            assert.equal(result.total, 3); assert.equal(result.result.success, 3);
        });
        await check('M3 add shortcut in UI with custom icon and Dock pin', async () => {
            await click('#quicklinksAddBtn');
            await driver.wait(async () => await driver.findElement(By.id('quicklinkUrlInput')).isDisplayed(), 5000);
            await driver.findElement(By.id('quicklinkUrlInput')).sendKeys(origin+'/declared');
            await driver.findElement(By.id('quicklinkTitleInput')).clear();
            await driver.findElement(By.id('quicklinkTitleInput')).sendKeys('M3 自定义');
            await click('#quicklinkIconModeCustom');
            await driver.findElement(By.id('quicklinkIconInput')).sendKeys(origin+'/image.png');
            const pin = await driver.findElement(By.id('quicklinkDockCheckbox'));
            if (!(await pin.isSelected())) await click('label:has(#quicklinkDockCheckbox)');
            await click('#quicklinkSaveBtn');
            await driver.wait(async () => await run(`const {store}=await import('./scripts/domains/quicklinks/store.js');
                await store.init();
                return store.getDockItems().some(item=>item.title==='M3 自定义');`), 10000);
            await driver.wait(async () => !(await driver.findElement(By.id('quicklinkDialogOverlay')).isDisplayed()), 5000);
        });
        await check('M3 folder, edit, reorder, pagination and deletion using real storage', async () => {
            const result = await run(`const {store}=await import('./scripts/domains/quicklinks/store.js');
                await store.init();
                const a=await store.addItem({title:'M3 folder A',url:arguments[0]+'/fa'});
                const b=await store.addItem({title:'M3 folder B',url:arguments[0]+'/fb'});
                const folder=await store.createFolder('M3 Folder',[a._id,b._id]);
                await store.renameFolder(folder._id,'M3 Renamed');
                await store.reorderFolderChildren(folder._id,[b._id,a._id]);
                await store.updateItem(a._id,{title:'M3 Edited'});
                const snapshot={folder:store.getItem(folder._id),expectedOrder:[b._id,a._id],edited:store.getItem(a._id).title};
                await store.deleteFolder(folder._id,false);
                await store.deleteItem(a._id); await store.deleteItem(b._id);
                const bulk=await store.bulkAddItems([{pageIndex:1,items:Array.from({length:26},(_,i)=>({title:'M3 Page '+i,url:arguments[0]+'/page/'+i}))}]);
                return {...snapshot,bulk, pages:store.getPageCount(),removed:!store.getItem(a._id)&&!store.getItem(b._id)};`, origin);
            assert.equal(result.folder.title,'M3 Renamed'); assert.equal(result.edited,'M3 Edited');
            assert.deepEqual(result.folder.children,result.expectedOrder);
            assert.equal(result.removed,true); assert.equal(result.bulk.success,26); assert.ok(result.pages>=2);
        });
        await check('M3 Dock pointer drag persists order', async () => {
            const id=await run(`const {store}=await import('./scripts/domains/quicklinks/store.js');await store.init();
                return store.getDockItems().find(item=>item.title==='M3 自定义')._id;`);
            const source=await driver.findElement(By.css(`#quicklinksList [data-id="${id}"]`));
            const target=await driver.findElement(By.css('#quicklinksList [data-id="__SYSTEM_PHOTOS__"]'));
            await driver.actions().move({origin:source}).press().pause(250).move({origin:target,x:-22,y:0,duration:700}).pause(300).release().perform();
            await driver.wait(async()=>await run(`const {store}=await import('./scripts/domains/quicklinks/store.js');await store.loadData();
                const ids=store.getDockItems().map(i=>i._id);return ids.indexOf(arguments[0])<ids.indexOf('__SYSTEM_PHOTOS__');`,id),5000);
        });
        await check('M3 launchpad opens, searches and closes with Escape', async () => {
            await click('#launchpadBtn');
            const input=await driver.findElement(By.id('launchpadSearchInput'));
            await driver.wait(async()=>await input.isDisplayed(),5000);
            await input.sendKeys('M3 自定义');
            await driver.wait(async()=> await driver.executeScript('return document.getElementById("launchpadSearchResults")?.textContent.includes("M3 自定义") || false'),5000);
            await input.sendKeys(Key.ESCAPE);
            await driver.wait(async()=> (await input.getAttribute('value'))==='',5000);
            await input.sendKeys(Key.ESCAPE);
            await driver.wait(async()=> !(await driver.findElement(By.id('launchpadOverlay')).isDisplayed()),5000);
        });
        await check('M3 local wallpaper upload, selection, crop and reload', async () => {
            const wallpaper = Buffer.from(await run(`const c=document.createElement('canvas');c.width=1200;c.height=800;
                const ctx=c.getContext('2d');ctx.fillStyle='#243b53';ctx.fillRect(0,0,1200,800);
                ctx.fillStyle='#d97942';ctx.fillRect(650,100,400,600);return c.toDataURL('image/png').split(',')[1];`),'base64');
            const fixture=path.join(evidence,'wallpaper.png'); await writeFile(fixture,wallpaper);
            await click('#settingsBtn');
            await click('[data-menu="appearance"]');
            await driver.wait(async()=> (await driver.findElements(By.id('macLocalFileInput'))).length>0,5000);
            await driver.findElement(By.id('macLocalFileInput')).sendKeys(fixture);
            const uploaded='.mac-local-file-item:not([data-id="default"])';
            await driver.wait(async()=> (await driver.findElements(By.css(uploaded))).length===1,15000);
            const selectedId=await driver.findElement(By.css(uploaded)).getAttribute('data-id');
            await click(uploaded);
            await driver.wait(async()=>await run('return (await chrome.storage.local.get("backgroundFiles")).backgroundFiles?.[arguments[0]]?.selected===true',selectedId),10000);
            await click('#macSettingsClose');
            await driver.wait(async()=>await driver.executeScript('return [...document.querySelectorAll(".background-image.ready")].some(el=>el.style.backgroundImage.includes("blob:"))'),10000);
            const file=await run(`const {localFilesManager}=await import('./scripts/domains/backgrounds/source-local.js');
                await localFilesManager.init();const f=await localFilesManager.getSelectedFile();
                const img=new Image();img.src=f.urls.full;await img.decode();return {id:f.id,width:img.naturalWidth,height:img.naturalHeight,position:f.position};`);
            assert.equal(file.width,1200);assert.equal(file.height,800);
            assert.equal(file.id,selectedId);
            assert.equal(await driver.executeScript('return getComputedStyle(document.querySelector(".background-image.ready")).backgroundSize'),'cover');
            await driver.navigate().refresh();
            await driver.wait(async()=>await run('return (await chrome.storage.local.get("currentBackground")).currentBackground?.id===arguments[0] && [...document.querySelectorAll(".background-image.ready")].some(el=>el.style.backgroundImage.includes("blob:"))',file.id),15000);
        });
        await check('M3 solid wallpaper and missing API-key fallback', async () => {
            await run(`const {backgroundSettings}=await chrome.storage.sync.get('backgroundSettings');
                await chrome.storage.sync.set({backgroundSettings:{...backgroundSettings,type:'color',color:'#123456'}});`);
            await driver.wait(async()=>await driver.executeScript('return document.documentElement.style.getPropertyValue("--solid-background")==="#123456"'),10000);
            for(const type of ['pexels']) {
                await run(`const {backgroundSettings}=await chrome.storage.sync.get('backgroundSettings');
                    await chrome.storage.sync.set({backgroundSettings:{...backgroundSettings,type:'color'}});`);
                await driver.wait(async()=>await driver.executeScript('return document.querySelectorAll(".background-image").length===0'),10000);
                await run(`const {backgroundSettings}=await chrome.storage.sync.get('backgroundSettings');
                    await chrome.storage.sync.set({backgroundSettings:{...backgroundSettings,type:arguments[0],frequency:'never'}});`,type);
                await click('#refreshBgBtn');
                await driver.wait(async()=>await driver.executeScript('return [...document.querySelectorAll(".background-image.ready")].some(el=>el.style.backgroundImage.includes("blob:"))'),10000);
            }
            await run(`const {backgroundSettings}=await chrome.storage.sync.get('backgroundSettings');
                await chrome.storage.sync.set({backgroundSettings:{...backgroundSettings,type:'files',frequency:'never'}});`);
        });
        await check('M3 photo thumbnails, expand and window dragging', async () => {
            await click('.quicklink-item[data-id="__SYSTEM_PHOTOS__"]');
            await driver.wait(async()=>await driver.executeScript('return [...document.querySelectorAll(".photos-card-img")].some(img=>img.complete&&img.naturalWidth>0)'),10000);
            await click('#photosExpand');
            await driver.wait(async()=> (await driver.findElement(By.id('photosWindow')).getAttribute('class')).includes('is-expanded'),5000);
            await click('#photosExpand');
            const title=await driver.findElement(By.id('photosTitlebar'));
            const before=await driver.findElement(By.id('photosWindow')).getRect();
            await driver.actions().move({origin:title,x:80,y:0}).press().move({origin:'pointer',x:60,y:40,duration:500}).release().perform();
            const after=await driver.findElement(By.id('photosWindow')).getRect();
            assert.ok(Math.abs(after.x-before.x)>10 || Math.abs(after.y-before.y)>10);
            await click('.photos-card');
            await driver.wait(async()=> (await driver.findElement(By.id('photosImmersiveViewer')).getAttribute('class')).includes('is-visible'),10000);
            await driver.wait(async()=>await driver.executeScript('const img=document.getElementById("immersiveImage");return img.complete&&img.naturalWidth===1200'),10000);
            await driver.actions().sendKeys(Key.ARROW_RIGHT).perform();
            await driver.actions().sendKeys(Key.ESCAPE).perform();
            await driver.wait(async()=> !(await driver.findElement(By.id('photosImmersiveViewer')).getAttribute('class')).includes('is-visible'),5000);
            await writeFile(path.join(evidence,'photos.png'),await driver.takeScreenshot(),'base64');
            await click('#photosClose');
            await driver.wait(async()=>!(await driver.findElement(By.id('photosOverlay')).isDisplayed()),5000);
        });
        await check('M3 offline local wallpaper and viewport sizes', async () => {
            await driver.setContext(firefox.Context.CHROME);
            await driver.executeScript('Services.io.offline=true;');
            await driver.setContext(firefox.Context.CONTENT);
            try {
                await driver.navigate().refresh();
                await driver.wait(async()=>await driver.executeScript('return [...document.querySelectorAll(".background-image.ready")].some(el=>el.style.backgroundImage.includes("blob:"))'),10000);
                for(const [width,height] of [[800,700],[1920,1080]]) {
                    await driver.manage().window().setRect({width,height});
                    assert.equal(await driver.findElement(By.id('clock')).isDisplayed(),true);
                    assert.equal(await driver.findElement(By.id('settingsBtn')).isDisplayed(),true);
                    assert.ok(await driver.executeScript('return document.documentElement.scrollWidth<=innerWidth+1'));
                }
            } finally {
                await driver.setContext(firefox.Context.CHROME);
                await driver.executeScript('Services.io.offline=false;');
                await driver.setContext(firefox.Context.CONTENT);
                await driver.manage().window().setRect({width:1440,height:1000});
            }
        });
        await check('M3 locales, launchpad shortcut and browser zoom', async () => {
            await click('#settingsBtn');
            await click('[data-menu="general"]');
            await driver.wait(async()=>await driver.executeScript(`const el=document.getElementById('macSettingsOverlay');
                return getComputedStyle(el).opacity==='1' && !el.getAnimations({subtree:true}).some(a=>a.playState==='running'&&a.effect.getComputedTiming().iterations!==Infinity);`),5000);
            for(const htmlLang of ['zh-CN','zh-TW','en']) {
                await driver.findElement(By.css(`#macInterfaceLanguage option[value="${htmlLang}"]`)).click();
                await driver.wait(async()=>await driver.executeScript('return document.documentElement.lang===arguments[0]',htmlLang),5000);
                assert.ok((await driver.findElement(By.id('searchInput')).getAttribute('placeholder')).length>0);
            }
            await click('#macSettingsClose');
            await driver.wait(async()=>!(await driver.findElement(By.id('macSettingsOverlay')).isDisplayed()),5000);
            await driver.actions().keyDown(Key.CONTROL).sendKeys('.').keyUp(Key.CONTROL).perform();
            await driver.wait(async()=>await driver.findElement(By.id('launchpadOverlay')).isDisplayed(),5000);
            await driver.findElement(By.id('launchpadSearchInput')).sendKeys(Key.ESCAPE);
            await driver.wait(async()=>!(await driver.findElement(By.id('launchpadOverlay')).isDisplayed()),5000);
            for(const zoom of [0.8,1.25,1]) {
                await driver.setContext(firefox.Context.CHROME);
                await driver.executeScript('gBrowser.selectedBrowser.fullZoom=arguments[0];',zoom);
                await driver.setContext(firefox.Context.CONTENT);
                assert.equal(await driver.findElement(By.id('clock')).isDisplayed(),true);
                assert.ok(await driver.executeScript('return document.documentElement.scrollWidth<=innerWidth+1'));
            }
        });
        if(process.argv.includes('--live-bing')) {
            await driver.manage().setTimeouts({script:60000});
            try {
                report.liveBingBefore=await run('return {hidden:document.hidden,settings:(await chrome.storage.sync.get("backgroundSettings")).backgroundSettings.type};');
                await run(`const {backgroundSettings}=await chrome.storage.sync.get('backgroundSettings');
                    await chrome.storage.sync.set({backgroundSettings:{...backgroundSettings,type:'bing',frequency:'day'}});`);
                await click('#refreshBgBtn');
                await driver.wait(async()=>await run('return (await chrome.storage.local.get("currentBackground")).currentBackground?.id?.startsWith("bing-")===true'),55000);
                report.liveBing=await run(`const {currentBackground:bg}=await chrome.storage.local.get('currentBackground');const img=new Image();
                    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Bing image timeout')),10000);
                        img.onload=()=>{clearTimeout(timer);resolve();};img.onerror=()=>{clearTimeout(timer);reject(new Error('Bing image failed'));};img.src=bg.urls.small;});
                    return {status:'passed',id:bg.id,width:img.naturalWidth,height:img.naturalHeight};`);
            } catch(error) { report.liveBing={status:'unavailable',error:String(error)}; }
            finally {
                await driver.manage().setTimeouts({script:15000});
                await run(`const {backgroundSettings}=await chrome.storage.sync.get('backgroundSettings');
                    await chrome.storage.sync.set({backgroundSettings:{...backgroundSettings,type:'files',frequency:'never'}});`);
                await driver.wait(async()=>await driver.executeScript('return [...document.querySelectorAll(".background-image.ready")].some(el=>el.style.backgroundImage.includes("blob:"))'),10000);
            }
            console.log('LIVE BING '+JSON.stringify(report.liveBing));
        }
        await check('M3 default Firefox search, Chinese query and both tab dispositions', async () => {
            await driver.setContext(firefox.Context.CHROME);
            await run(`const {SearchService}=ChromeUtils.importESModule('moz-src:///toolkit/components/search/SearchService.sys.mjs');
                const engine=await SearchService.addUserEngine({name:'Ember M3 fixture',url:arguments[0]+'/search?q={searchTerms}'});
                await SearchService.setDefault(engine,SearchService.CHANGE_REASON.USER);`,origin);
            await driver.setContext(firefox.Context.CONTENT);
            const query='火狐 test & +?';
            for(const newTab of [false,true]) {
                await run('await chrome.storage.sync.set({preferredSearchEngine:"default",searchOpenInNewTab:arguments[0]});',newTab);
                await driver.navigate().refresh();
                await driver.wait(async()=>await driver.executeScript('return document.getElementById("searchInput")?.placeholder==="Search"'),10000);
                await driver.actions().keyDown(Key.CONTROL).sendKeys('k').keyUp(Key.CONTROL).perform();
                await driver.wait(async()=>await driver.executeScript('return document.activeElement.id==="searchInput"'),5000);
                const handles=await driver.getAllWindowHandles();
                await driver.findElement(By.id('searchInput')).sendKeys(query,Key.ENTER);
                if(newTab) {
                    await driver.wait(async()=> (await driver.getAllWindowHandles()).length>handles.length,10000);
                    await driver.switchTo().window((await driver.getAllWindowHandles()).at(-1));
                }
                await driver.wait(async()=> (await driver.getCurrentUrl()).startsWith(origin+'/search?'),10000);
                assert.equal(new URL(await driver.getCurrentUrl()).searchParams.get('q'),query);
                if(newTab) assert.equal((await driver.getAllWindowHandles()).length,handles.length+1);
                else assert.equal((await driver.getAllWindowHandles()).length,handles.length);
                await openNewTab();
            }
        });
        await check('M3 selected Bing engine preserves query and tab preference', async () => {
            const query='Ember Firefox 测试 & +?';
            for(const newTab of [false,true]) {
                await run('await chrome.storage.sync.set({searchOpenInNewTab:arguments[0]});',newTab);
                await click('#searchEngineBtn');
                await click('.engine-btn[data-engine="bing"]');
                await driver.wait(async()=>await run('return (await chrome.storage.sync.get("preferredSearchEngine")).preferredSearchEngine==="bing"'),5000);
                const handles=await driver.getAllWindowHandles();
                await driver.findElement(By.id('searchInput')).sendKeys(query,Key.ENTER);
                if(newTab) {
                    await driver.wait(async()=> (await driver.getAllWindowHandles()).length>handles.length,10000);
                    await driver.switchTo().window((await driver.getAllWindowHandles()).at(-1));
                }
                await driver.wait(async()=> {
                    const url=new URL(await driver.getCurrentUrl());
                    return url.protocol==='https:' && ['www.bing.com','cn.bing.com'].includes(url.hostname) && url.pathname==='/search';
                },15000);
                assert.equal(new URL(await driver.getCurrentUrl()).searchParams.get('q'),query);
                assert.equal((await driver.getAllWindowHandles()).length,handles.length+(newTab?1:0));
                await openNewTab();
            }
        });
        report.m3FixtureRequests = requests.length;
        await writeFile(path.join(evidence,'m3-ui.png'),await driver.takeScreenshot(),'base64');
    } finally {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
}
