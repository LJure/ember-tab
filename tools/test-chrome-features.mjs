import assert from 'node:assert/strict';
import { createServer } from 'node:https';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { By, Key } from 'selenium-webdriver';
import { unzipSync, strFromU8 } from '../scripts/libs/fflate.esm.js';

export async function runChromeFeatures({driver, run, check, evidence, report, origin}) {
    const click = async selector => {
        for(let attempt=0;attempt<3;attempt++) {
        try {
        let el = await driver.findElement(By.css(selector));
        if (selector.includes('quicklink-item')) el = await el.findElement(By.css('.quicklink-icon'));
        await driver.actions().move({origin:el}).pause(350).perform();
        await driver.wait(async()=>await driver.executeScript('return !document.getAnimations().some(a=>a.playState==="running"&&a.effect.getComputedTiming().iterations!==Infinity);'),5000);
        await driver.wait(async () => driver.executeScript(`const el=arguments[0],r=el.getBoundingClientRect();
            return r.width>0&&r.height>0&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));`,el),5000);
        const point=await driver.executeScript('const r=arguments[0].getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};',el);
        await driver.sendAndGetDevToolsCommand('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',buttons:1,clickCount:1});
        await driver.sendAndGetDevToolsCommand('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',buttons:0,clickCount:1});
        return;
        }catch(error){
            // Settings can replace a row while thumbnail/storage notifications arrive.
            if(error.name!=='StaleElementReferenceError'||attempt===2) throw error;
        }
        }
    };
    await driver.get(report.extensionBase + 'newtab.html');
    await driver.wait(async () => await driver.executeScript(`return document.getElementById('clock').textContent!=='00:00';`),10000);
    await driver.executeScript(`document.querySelector('.changelog-btn-close')?.click();`);
    await check('Chrome bookmark roots, nested folders, duplicate filtering and actual import', async () => {
        const result = await run(`const tree=(await chrome.bookmarks.getTree())[0];
            const roots=tree.children.filter(node=>!node.url);
            if(roots.length<2)throw new Error('Expected Chrome bookmark roots');
            await chrome.bookmarks.create({parentId:roots[0].id,title:'Fixture A',url:arguments[0]+'/a'});
            const folder=await chrome.bookmarks.create({parentId:roots[0].id,title:'Chrome fixture folder'});
            const inner=await chrome.bookmarks.create({parentId:folder.id,title:'Nested'});
            await chrome.bookmarks.create({parentId:inner.id,title:'Fixture B',url:arguments[0]+'/b'});
            await chrome.bookmarks.create({parentId:roots[1].id,title:'Duplicate A',url:arguments[0]+'/a'});
            const {store}=await import('./scripts/domains/quicklinks/store.js');await store.init();
            const {bookmarkImporter}=await import('./scripts/domains/bookmarks/importer.js');
            const parsed=await bookmarkImporter.parseBookmarkTree();
            const preview=bookmarkImporter.previewImport({selectedFolders:new Set(parsed.folders.keys())});
            return {roots:roots.map(x=>({id:x.id,title:x.title})),stats:parsed.stats,total:preview.totalItems,result:await bookmarkImporter.executeImport(preview.pages)};`,origin);
        assert.equal(result.stats.totalBookmarks,2);assert.equal(result.stats.duplicateCount,1);
        assert.equal(result.total,2);assert.equal(result.result.success,2);
        report.bookmarkRoots=result.roots;
    });
    // The UI workflows below also run against Firefox in its existing M3 suite.
        await check('Chrome add shortcut in UI with custom icon and Dock pin', async () => {
            await click('#quicklinksAddBtn');
            await driver.wait(async () => await driver.findElement(By.id('quicklinkUrlInput')).isDisplayed(), 5000);
            await driver.findElement(By.id('quicklinkUrlInput')).sendKeys(origin+'/declared');
            await driver.findElement(By.id('quicklinkTitleInput')).clear();
            await driver.findElement(By.id('quicklinkTitleInput')).sendKeys('Chrome 自定义');
            await click('#quicklinkIconModeCustom');
            await driver.findElement(By.id('quicklinkIconInput')).sendKeys(origin+'/custom.png');
            const pin = await driver.findElement(By.id('quicklinkDockCheckbox'));
            if (!(await pin.isSelected())) await click('label:has(#quicklinkDockCheckbox)');
            await click('#quicklinkSaveBtn');
            await driver.wait(async () => await run(`const {store}=await import('./scripts/domains/quicklinks/store.js');
                await store.init();
                return store.getDockItems().some(item=>item.title==='Chrome 自定义');`), 10000);
            await driver.wait(async () => !(await driver.findElement(By.id('quicklinkDialogOverlay')).isDisplayed()), 5000);
        });
        await check('Chrome folder, edit, reorder, pagination and deletion using real storage', async () => {
            const result = await run(`const {store}=await import('./scripts/domains/quicklinks/store.js');
                await store.init();
                const a=await store.addItem({title:'Chrome folder A',url:arguments[0]+'/fa'});
                const b=await store.addItem({title:'Chrome folder B',url:arguments[0]+'/fb'});
                const folder=await store.createFolder('Chrome Folder',[a._id,b._id]);
                await store.renameFolder(folder._id,'Chrome Renamed');
                await store.reorderFolderChildren(folder._id,[b._id,a._id]);
                await store.updateItem(a._id,{title:'Chrome Edited'});
                const snapshot={folder:store.getItem(folder._id),expectedOrder:[b._id,a._id],edited:store.getItem(a._id).title};
                await store.deleteFolder(folder._id,false);
                await store.deleteItem(a._id); await store.deleteItem(b._id);
                const bulk=await store.bulkAddItems([{pageIndex:1,items:Array.from({length:26},(_,i)=>({title:'Chrome Page '+i,url:arguments[0]+'/page/'+i}))}]);
                return {...snapshot,bulk, pages:store.getPageCount(),removed:!store.getItem(a._id)&&!store.getItem(b._id)};`, origin);
            assert.equal(result.folder.title,'Chrome Renamed'); assert.equal(result.edited,'Chrome Edited');
            assert.deepEqual(result.folder.children,result.expectedOrder);
            assert.equal(result.removed,true); assert.equal(result.bulk.success,26); assert.ok(result.pages>=2);
        });
        await check('Chrome Dock pointer drag persists order', async () => {
            const id=await run(`const {store}=await import('./scripts/domains/quicklinks/store.js');await store.init();
                return store.getDockItems().find(item=>item.title==='Chrome 自定义')._id;`);
            const source=await driver.findElement(By.css(`#quicklinksList [data-id="${id}"] .quicklink-icon`));
            const target=await driver.findElement(By.css('#quicklinksList [data-id="__SYSTEM_PHOTOS__"]'));
            await driver.actions().move({origin:source}).pause(400).perform();
            await driver.actions().press().move({origin:'pointer',x:-12,y:0,duration:200}).pause(250).perform();
            await driver.wait(async()=>await driver.executeScript('return !!document.querySelector(".sortable-fallback")'),5000);
            await driver.actions().move({origin:target,x:-10,y:0,duration:900}).pause(700).release().perform();
            report.dragAfter=await run(`const {store}=await import('./scripts/domains/quicklinks/store.js');
                return {dom:[...document.querySelectorAll('#quicklinksList .quicklink-item')].map(el=>el.dataset.id),stored:store.getDockItems().map(x=>x._id)};`);
            await driver.wait(async()=>await run(`const {store}=await import('./scripts/domains/quicklinks/store.js');await store.loadData();
                const ids=store.getDockItems().map(i=>i._id);return ids.indexOf(arguments[0])<ids.indexOf('__SYSTEM_PHOTOS__');`,id),5000);
        });
        await check('Chrome launchpad opens, searches and closes with Escape', async () => {
            await click('#launchpadBtn');
            const input=await driver.findElement(By.id('launchpadSearchInput'));
            await driver.wait(async()=>await input.isDisplayed(),5000);
            await input.sendKeys('Chrome 自定义');
            await driver.wait(async()=> await driver.executeScript('return document.getElementById("launchpadSearchResults")?.textContent.includes("Chrome 自定义") || false'),5000);
            await input.sendKeys(Key.ESCAPE);
            await driver.wait(async()=> (await input.getAttribute('value'))==='',5000);
            await input.sendKeys(Key.ESCAPE);
            await driver.wait(async()=> !(await driver.findElement(By.id('launchpadOverlay')).isDisplayed()),5000);
        });
        await check('Chrome local wallpaper upload, selection, crop and reload', async () => {
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
            const selectedId=await driver.executeScript('return document.querySelector(arguments[0])?.dataset.id;',uploaded);
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
        await check('Chrome solid wallpaper and missing API-key fallback', async () => {
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
        await check('Chrome photo thumbnails, expand and window dragging', async () => {
            report.featureStage='open photos';
            await click('.quicklink-item[data-id="__SYSTEM_PHOTOS__"]');
            await driver.wait(async()=>await driver.findElement(By.id('photosOverlay')).isDisplayed(),5000);
            await driver.wait(async()=>await driver.executeScript('return [...document.querySelectorAll(".photos-card-img")].some(img=>img.complete&&img.naturalWidth>0)'),10000);
            report.featureStage='expand photos';await click('#photosExpand');
            await driver.wait(async()=> (await driver.findElement(By.id('photosWindow')).getAttribute('class')).includes('is-expanded'),5000);
            report.featureStage='restore photos';await click('#photosExpand');
            await driver.wait(async()=>await driver.executeScript('return !document.getAnimations().some(a=>a.playState==="running"&&a.effect.getComputedTiming().iterations!==Infinity);'),5000);
            const title=await driver.findElement(By.id('photosTitlebar'));
            const before=await driver.findElement(By.id('photosWindow')).getRect();
            report.featureStage='drag photos';await driver.actions().move({origin:title,x:80,y:0}).press().move({origin:'pointer',x:60,y:40,duration:500}).release().perform();
            const after=await driver.findElement(By.id('photosWindow')).getRect();
            report.photoDrag=await driver.executeScript('return {before:arguments[0],after:arguments[1],overlay:document.getElementById("photosOverlay").outerHTML.slice(0,200),dismiss:document.body.className};',before,after);
            assert.ok(after.width>0&&after.height>0,'Dragging must keep the photo window open');
            assert.ok(Math.abs(after.x-before.x)>10 || Math.abs(after.y-before.y)>10);
            report.featureStage='open viewer';await click('.photos-card');
            await driver.wait(async()=> (await driver.findElement(By.id('photosImmersiveViewer')).getAttribute('class')).includes('is-visible'),10000);
            await driver.wait(async()=>await driver.executeScript('const img=document.getElementById("immersiveImage");return img.complete&&img.naturalWidth===1200'),10000);
            await driver.actions().sendKeys(Key.ARROW_RIGHT).perform();
            await driver.actions().sendKeys(Key.ESCAPE).perform();
            await driver.wait(async()=> !(await driver.findElement(By.id('photosImmersiveViewer')).getAttribute('class')).includes('is-visible'),5000);
            assert.equal(await driver.findElement(By.id('photosOverlay')).getAttribute('aria-hidden'),'false','Escape should return to the album');
            await writeFile(path.join(evidence,'photos.png'),await driver.takeScreenshot(),'base64');
            await click('#photosClose');
            await driver.wait(async()=>!(await driver.findElement(By.id('photosOverlay')).isDisplayed()),5000);
        });

    await check('Chrome offline local wallpaper, viewport sizes and browser zoom',async()=>{
        await driver.sendAndGetDevToolsCommand('Network.enable',{});
        await driver.sendAndGetDevToolsCommand('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
        try {
            await driver.navigate().refresh();
            await driver.wait(async()=>await driver.executeScript('return [...document.querySelectorAll(".background-image.ready")].some(el=>el.style.backgroundImage.includes("blob:"))'),10000);
            for(const [width,height] of [[800,700],[1920,1080]]) {
                await driver.manage().window().setRect({width,height});
                assert.equal(await driver.findElement(By.id('clock')).isDisplayed(),true);
                assert.ok(await driver.executeScript('return document.documentElement.scrollWidth<=innerWidth+1'));
            }
            for(const zoom of [0.8,1.25,1]) {
                await run('const tab=await chrome.tabs.getCurrent();await chrome.tabs.setZoom(tab.id,arguments[0]);',zoom);
                assert.equal(await driver.findElement(By.id('clock')).isDisplayed(),true);
                assert.ok(await driver.executeScript('return document.documentElement.scrollWidth<=innerWidth+1'));
            }
        }finally{
            await driver.sendAndGetDevToolsCommand('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
            await driver.manage().window().setRect({width:1440,height:1000});
        }
    });
    await check('Chrome Bing, Pexels and Wallhaven apply fixture wallpapers and refresh manually',async()=>{
        await run('window.__searchTest.wallpaperMode=true;');
        try {
            for(const type of ['bing','pexels','wallhaven']) {
                report.featureStage=type+' wallpaper selection';
                await run(`const {backgroundSettings}=await chrome.storage.sync.get('backgroundSettings');
                    await chrome.storage.sync.set({backgroundSettings:{...backgroundSettings,type:'color',color:'#123456',frequency:'never'}});`);
                await driver.wait(async()=>await driver.executeScript('return document.querySelectorAll(".background-image").length===0'),10000);
                await run(`const {backgroundSettings}=await chrome.storage.sync.get('backgroundSettings');
                    await chrome.storage.sync.set({backgroundSettings:{...backgroundSettings,type:arguments[0],frequency:'never',apiKeys:{pexels:'synthetic-key-for-fixture',wallhaven:'synthetic-key-for-fixture'},wallhaven:{username:'fixture',collectionId:'123'}}});`,type);
                await click('#refreshBgBtn');
                await driver.wait(async()=>await run('const bg=(await chrome.storage.local.get("currentBackground")).currentBackground;return (arguments[0]==="bing"?bg?.id?.startsWith("bing-"):bg?.provider===arguments[0])&&!!document.querySelector(".background-image.ready");',type),15000);
                report.featureStage=type+' manual wallpaper refresh';
                await run(`window.chromeFixtureRefreshEvents=[];
                    window.addEventListener('background:refreshing',event=>window.chromeFixtureRefreshEvents.push(event.detail.active));`);
                await click('#refreshBgBtn');
                await driver.wait(async()=>await run('const bg=(await chrome.storage.local.get("currentBackground")).currentBackground;return window.chromeFixtureRefreshEvents.includes(true)&&window.chromeFixtureRefreshEvents.at(-1)===false&&!!document.querySelector(".background-image.ready")&&(arguments[0]==="bing"?bg?.id?.startsWith("bing-"):bg?.provider===arguments[0]);',type),15000);
            }
            report.wallpaperFixtures=await driver.executeScript('return window.__searchTest.wallpapers;');
            await writeFile(path.join(evidence,'online-wallpaper.png'),await driver.takeScreenshot(),'base64');
        }finally{
            report.wallpaperDiagnostics=await run('return {requests:window.__searchTest.wallpapers,current:(await chrome.storage.local.get("currentBackground")).currentBackground};');
            await run(`const {backgroundSettings}=await chrome.storage.sync.get('backgroundSettings');
                await chrome.storage.sync.set({backgroundSettings:{...backgroundSettings,type:'files',frequency:'never',apiKeys:{pexels:'',wallhaven:''},wallhaven:{username:'',collectionId:''}}});`);
            await driver.wait(async()=>await driver.executeScript('return [...document.querySelectorAll(".background-image.ready")].some(el=>el.style.backgroundImage.includes("blob:"))'),10000);
            await run('window.__searchTest.wallpaperMode=false;');
        }
    });
    await check('Chrome locales, about attribution and launchpad keyboard shortcut', async()=>{
        await click('#settingsBtn');await click('[data-menu="general"]');
        for(const language of ['zh-CN','zh-TW','en']) {
            await driver.findElement(By.css('#macInterfaceLanguage option[value="'+language+'"]')).click();
            await driver.wait(async()=>await driver.executeScript('return document.documentElement.lang===arguments[0]',language),5000);
            await click('[data-menu="about"]');
            assert.match(await driver.findElement(By.css('.mac-about-footer')).getText(),/Chrome/);
            await click('[data-menu="general"]');
        }
        await click('#macSettingsClose');
        await driver.wait(async()=>!(await driver.findElement(By.id('macSettingsOverlay')).isDisplayed()),5000);
        await driver.actions().keyDown(Key.CONTROL).sendKeys('.').keyUp(Key.CONTROL).perform();
        await driver.wait(async()=>await driver.findElement(By.id('launchpadOverlay')).isDisplayed(),5000);
        await driver.findElement(By.id('launchpadSearchInput')).sendKeys(Key.ESCAPE);
        await driver.wait(async()=>!(await driver.findElement(By.id('launchpadOverlay')).isDisplayed()),5000);
    });
    const pref=(area,values)=>run('await chrome.storage[arguments[0]].set(arguments[1]);',area,values);
    const type=async value=>driver.executeScript("const input=document.getElementById('searchInput');input.focus();input.value=arguments[0];input.dispatchEvent(new Event('input',{bubbles:true}));",value);
    const waitRows=text=>driver.wait(async()=>await driver.executeScript("const list=document.getElementById('searchSuggestions'),panel=list.parentElement;return list.textContent.includes(arguments[0])&&!panel.hidden&&panel.getAnimations({subtree:true}).length===0;",text),12000);
    await pref('sync',{searchActive:true,searchOpenInNewTab:true,preferredSearchEngine:'default'});
    await driver.navigate().refresh();
    await driver.wait(async()=>await driver.findElement(By.id('searchInput')).isDisplayed(),10000);
    await check('settings default off; source has exactly five choices; controls save only locally', async () => {
        await driver.findElement(By.id('settingsBtn')).click();
        await driver.wait(async () => (await driver.findElements(By.id('macSearchHistory'))).length > 0, 10000);
        const config = await driver.executeScript(`return {history:document.getElementById('macSearchHistory').checked,suggestions:document.getElementById('macSearchSuggestions').checked,sources:[...document.getElementById('macSearchSuggestionSource').options].map(option=>option.value)};`);
        assert.equal(config.history, false); assert.equal(config.suggestions, false);
        assert.deepEqual(config.sources, ['bing', 'google', 'baidu', 'duckduckgo', 'brave']);
        await driver.wait(async () => await driver.executeScript(`const overlay=document.getElementById('macSettingsOverlay');return getComputedStyle(overlay).opacity==='1' && overlay.getAnimations({subtree:true}).every(animation=>animation.playState!=='running' || animation.effect.getComputedTiming().iterations===Infinity);`), 10000);
        await driver.executeScript(`document.getElementById('macSearchSuggestionSource').scrollIntoView({block:'center'});`);
        await writeFile(path.join(evidence, 'settings.png'), await driver.takeScreenshot(), 'base64');
        await driver.findElement(By.css('label:has(#macSearchHistory)')).click();
        await driver.wait(async () => await run(`return (await chrome.storage.local.get('searchHistoryEnabled')).searchHistoryEnabled===true;`), 5000);
        await driver.findElement(By.css('label:has(#macSearchSuggestions)')).click();
        await driver.wait(async () => await run(`return (await chrome.storage.local.get('searchSuggestionsEnabled')).searchSuggestionsEnabled===true;`), 5000);
        await driver.findElement(By.css('label:has(#macSearchSuggestions)')).click();
        await driver.wait(async () => await run(`return (await chrome.storage.local.get('searchSuggestionsEnabled')).searchSuggestionsEnabled===false;`), 5000);
        await driver.executeScript(`const select=document.getElementById('macSearchSuggestionSource');select.value='brave';select.dispatchEvent(new Event('change',{bubbles:true}));`);
        await driver.wait(async () => await run(`return (await chrome.storage.local.get('searchSuggestionSource')).searchSuggestionSource==='brave';`), 5000);
        assert.equal(await run(`const keys=['searchHistoryEnabled','searchSuggestionsEnabled','searchSuggestionSource'];const sync=await chrome.storage.sync.get(keys);return keys.some(key=>key in sync);`), false);
        await driver.findElement(By.id('macSettingsClose')).click();
        await driver.wait(async () => await driver.executeScript(`return document.getElementById('macSettingsOverlay').getAttribute('aria-hidden')==='true';`), 5000);
        await driver.wait(async () => await driver.executeScript(`const input=document.getElementById('searchInput'),r=input.getBoundingClientRect();return input===document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);`), 5000);
    });
    await check('history records submitted searches, deduplicates and deletes without searching', async () => {
        for (const query of ['aura tab', 'ember tab', 'aura tab']) {
            await type(query);
            await driver.findElement(By.id('searchInput')).sendKeys(Key.ENTER);
            await driver.wait(async () => await run(`return (await chrome.runtime.sendMessage({type:'emberSearchHistory',action:'list'})).items[0]===arguments[0];`, query), 5000);
            await driver.wait(async () => await driver.executeScript(`const input=document.getElementById('searchInput');return input.value==='' && document.activeElement!==input && document.querySelector('.search-suggestions').hidden;`), 5000);
        }
        assert.deepEqual(await run(`return (await chrome.runtime.sendMessage({type:'emberSearchHistory',action:'list'})).items;`), ['aura tab', 'ember tab']);
        await type(''); await waitRows('aura tab');
        const count = await driver.executeScript('return window.__searchTest.submissions.length;');
        await driver.actions().move({ origin: await driver.findElement(By.css('.search-suggestion-row')) }).perform();
        await writeFile(path.join(evidence, 'history.png'), await driver.takeScreenshot(), 'base64');
        await driver.findElement(By.css('.search-history-delete')).click();
        await driver.wait(async () => await run(`return (await chrome.runtime.sendMessage({type:'emberSearchHistory',action:'list'})).items.length===1;`), 5000);
        assert.equal(await driver.executeScript('return window.__searchTest.submissions.length;'), count);
        await type('not submitted');
        assert.deepEqual(await run(`return (await chrome.runtime.sendMessage({type:'emberSearchHistory',action:'list'})).items;`), ['ember tab']);
    });
    await check('all eight direct engines and all three independent modes route suggestions correctly', async () => {
        await pref('local', { searchHistoryEnabled: false, searchSuggestionsEnabled: true, searchSuggestionSource: 'brave' });
        const providers = { google: 'suggestqueries.google.com', bing: 'api.bing.com', baidu: 'suggestion.baidu.com', duckduckgo: 'duckduckgo.com', brave: 'search.brave.com', yahoo: 'search.yahoo.com', yandex: 'suggest.yandex.com', naver: 'ac.search.naver.com', default: 'search.brave.com', sogou: 'search.brave.com', ecosia: 'search.brave.com' };
        for (const [engine, host] of Object.entries(providers)) {
            await type(''); await pref('sync', { preferredSearchEngine: engine });
            await type(`sample ${engine}`); await waitRows(`sample ${engine} one`);
            assert.equal(await driver.executeScript('return window.__searchTest.requests.at(-1).host;'), host);
            await driver.findElement(By.css('.search-suggestion-choice')).click();
            await driver.wait(async () => await driver.executeScript(`return window.__searchTest.submissions.at(-1)?.text===arguments[0] || window.__searchTest.submissions.at(-1)?.url?.includes(encodeURIComponent(arguments[0]));`, `sample ${engine} one`), 5000);
            const submitted = await driver.executeScript('return window.__searchTest.submissions.at(-1);');
            if (engine === 'default') assert.equal(submitted.kind, 'default');
            else assert.ok(new URL(submitted.url).hostname.includes(engine === 'duckduckgo' ? 'duckduckgo' : engine));
            await driver.wait(async () => await driver.executeScript(`const input=document.getElementById('searchInput');return input.value==='' && document.activeElement!==input && document.querySelector('.search-suggestions').hidden;`), 5000);
        }
        for (const source of ['bing', 'google', 'baidu', 'duckduckgo', 'brave']) {
            await type(''); await pref('sync', { preferredSearchEngine: 'default' });
            await pref('local', { searchSuggestionSource: source });
            await type(`source ${source}`); await waitRows(`source ${source} one`);
            assert.equal(await driver.executeScript('return window.__searchTest.requests.at(-1).host;'), providers[source]);
        }
    });
    await check('composition blocks requests; stale responses never overwrite new suggestions', async () => {
        await type('');
        await driver.executeScript(`const input=document.getElementById('searchInput');input.dispatchEvent(new CompositionEvent('compositionstart'));input.value='zhong';input.dispatchEvent(new Event('input'));`);
        const before = await driver.executeScript('return window.__searchTest.requests.length;');
        await driver.sleep(350);
        assert.equal(await driver.executeScript('return window.__searchTest.requests.length;'), before);
        await driver.executeScript(`const input=document.getElementById('searchInput');input.value='中文';input.dispatchEvent(new CompositionEvent('compositionend'));`);
        await waitRows('中文 one');
        await type('older');
        await driver.wait(async () => await driver.executeScript(`return window.__searchTest.requests.at(-1).query==='older';`), 5000);
        await type('newer'); await waitRows('newer one');
        await driver.sleep(1100);
        assert.ok(!(await driver.findElement(By.id('searchSuggestions')).getText()).includes('older'));
    });
    await check('disable cancels pending requests and stops future requests; keyboard Escape closes', async () => {
        await type('timeout');
        await driver.wait(async () => await driver.executeScript(`return window.__searchTest.requests.at(-1).query==='timeout';`), 5000);
        await pref('local', { searchSuggestionsEnabled: false });
        const before = await driver.executeScript('return window.__searchTest.requests.length;');
        await type('off query'); await driver.sleep(350);
        assert.equal(await driver.executeScript('return window.__searchTest.requests.length;'), before);
        assert.equal(await driver.executeScript(`return document.getElementById('searchSuggestions').parentElement.hidden;`), true);
        await pref('local', { searchSuggestionsEnabled: true }); await type('escape'); await waitRows('escape one');
        await driver.findElement(By.id('searchInput')).sendKeys(Key.ESCAPE);
        assert.equal(await driver.executeScript(`return document.getElementById('searchSuggestions').parentElement.hidden;`), true);
    });
    await check('real ZIP excludes all private search data and restore preserves this device', async () => {
        report.backup = await run(`const {BackupManager}=await import('./scripts/platform/backup-manager.js');
            const {unzipSync,zipSync,strFromU8,strToU8}=await import('./scripts/libs/fflate.esm.js');
            const manager=new BackupManager();const blob=await manager.createBackup();
            const zip=unzipSync(new Uint8Array(await blob.arrayBuffer()));
            const local=JSON.parse(strFromU8(zip['storage/local.json']));const sync=JSON.parse(strFromU8(zip['storage/sync.json']));
            const keys=['emberSearchHistory','searchHistoryEnabled','searchSuggestionsEnabled','searchSuggestionSource'];
            const excluded=keys.every(key=>!(key in local)&&!(key in sync));
            zip['storage/local.json']=strToU8(JSON.stringify({...local,emberSearchHistory:['foreign'],searchHistoryEnabled:true,searchSuggestionsEnabled:true,searchSuggestionSource:'google'}));
            await chrome.storage.local.set({emberSearchHistory:['this device'],searchHistoryEnabled:false,searchSuggestionsEnabled:false,searchSuggestionSource:'brave'});
            const restored=await manager.restoreFromBackup(new Blob([zipSync(zip)]));
            return {excluded,restored,data:await chrome.storage.local.get(keys)};`);
        assert.equal(report.backup.excluded, true); assert.equal(report.backup.restored.success, true);
        assert.deepEqual(report.backup.data, { emberSearchHistory: ['this device'], searchHistoryEnabled: false, searchSuggestionsEnabled: false, searchSuggestionSource: 'brave' });
    });

    await pref('local',{searchSuggestionsEnabled:false});
    await pref('sync',{preferredSearchEngine:'default',searchOpenInNewTab:true});
    await driver.executeScript('window.__searchTest.restoreRouting();');
    await check('real Chrome default search submits Chinese text to a new result tab',async()=>{
        const current=await driver.getWindowHandle(),before=new Set(await driver.getAllWindowHandles());
        const query='Ember Chrome migration fixture 中文';
        await type(query);await driver.findElement(By.id('searchInput')).sendKeys(Key.ENTER);
        let resultHandle;
        await driver.wait(async()=>{resultHandle=(await driver.getAllWindowHandles()).find(h=>!before.has(h));return !!resultHandle;},10000);
        await driver.switchTo().window(resultHandle);
        await driver.wait(async()=>{
            try {
                const url=new URL(await driver.getCurrentUrl());
                // Google can redirect automation to a CAPTCHA; verify its original search URL without interacting with the challenge.
                const destination=url.hostname==='www.google.com'&&url.pathname.startsWith('/sorry/')&&url.searchParams.has('continue')
                    ? new URL(url.searchParams.get('continue')) : url;
                return destination.searchParams.get('q')===query;
            }catch{return false;}
        },15000);
        report.defaultSearchUrl=await driver.getCurrentUrl();
        await driver.close();await driver.switchTo().window(current);
        await driver.wait(async()=>await driver.executeScript("const input=document.getElementById('searchInput');return input.value===''&&document.activeElement!==input;"),5000);
    });
    await check('real selected engine opens encoded Chinese query in the current tab',async()=>{
        await pref('sync',{preferredSearchEngine:'bing',searchOpenInNewTab:false});
        const query='Ember 中文 & + fixture';await type(query);await driver.findElement(By.id('searchInput')).sendKeys(Key.ENTER);
        await driver.wait(async()=>{try{const url=new URL(await driver.getCurrentUrl());return url.hostname.endsWith('.bing.com')&&url.searchParams.get('q')===query;}catch{return false;}},15000);
        report.selectedSearchUrl=await driver.getCurrentUrl();
        await driver.get(report.extensionBase+'newtab.html');
        await driver.wait(async()=>await driver.findElement(By.id('clock')).isDisplayed(),10000);
    });
    // Keep image round-trip comparisons independent of UI-triggered favicon cache warming.
    // This page uses the same real Chrome extension storage and IndexedDB databases.
    await driver.get(report.extensionBase+'runtime-probe.html');
    await runChromeBackup({driver,run,check,evidence,report});
}

export async function runChromeBackup({driver,run,check,evidence,report}) {
    const files=new Map(), dirs=new Set(['/dav/']);let mode='normal';const requests=[];
    const tls={key:await readFile(new URL('./fixtures/loopback-test.key',import.meta.url)),cert:await readFile(new URL('./fixtures/loopback-test.crt',import.meta.url))};
    const server=createServer(tls,async(req,res)=>{
        const pathname=new URL(req.url,'http://localhost').pathname;
        const request={method:req.method,path:pathname};requests.push(request);
        if(req.headers.authorization!=='Basic '+Buffer.from('fixture:synthetic-password').toString('base64')) {res.writeHead(401);return res.end();}
        if(mode==='denied') {res.writeHead(403);return res.end();}
        if(mode==='stall' && req.method==='GET') {res.writeHead(200);res.flushHeaders();return;}
        if(mode==='broken' && req.method==='GET') {res.writeHead(200,{'Content-Length':'100000'});res.write('partial');return res.destroy();}
        if(req.method==='MKCOL') {dirs.add(pathname);res.writeHead(201);return res.end();}
        if(req.method==='PUT') {const chunks=[];for await(const c of req) chunks.push(c);const bytes=Buffer.concat(chunks);request.bytes=bytes.length;request.contentLength=req.headers['content-length'];files.set(pathname,bytes);res.writeHead(201);return res.end();}
        if(req.method==='GET') {if(!files.has(pathname)){res.writeHead(404);return res.end();}const bytes=files.get(pathname);request.bytes=bytes.length;res.writeHead(200,{'Content-Type':'application/zip','Content-Length':bytes.length});return res.end(bytes);}
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
    const config={baseUrl:`https://127.0.0.1:${server.address().port}/dav`,username:'fixture',password:'synthetic-password',remoteDir:'测试 # 100%/Backups',timeoutMs:1500};
    try {
        await check('Chrome backup seed real storage, image blobs and custom icon cache',async()=>{
            const result=await run(`const {store}=await import('./scripts/domains/quicklinks/store.js');await store.init();
                await store.addItem({title:'M4 中文 link',url:'https://example.test/m4',iconAppearance:{mode:'text',text:'备',color:'blue'}});
                const c=document.createElement('canvas');c.width=640;c.height=480;
                c.getContext('2d').fillRect(0,0,640,480);const image=await new Promise(r=>c.toBlob(r));
                const {localFilesManager}=await import('./scripts/domains/backgrounds/source-local.js');
                await localFilesManager.init();await localFilesManager.addFiles([new File([image],'m4.png',{type:'image/png'})]);
                const {iconCache}=await import('./scripts/platform/icon-cache.js');await iconCache.init();
                await iconCache.set('m4/a',new Blob(['icon-A'],{type:'image/png'}),'https://cache-fixture.invalid/a');
                await iconCache.set('m4-b',new Blob(['icon-B'],{type:'image/png'}),'https://cache-fixture.invalid/b');
                await chrome.storage.sync.set({m4Marker:'原始设置'});
                await chrome.storage.local.set({m4Marker:'local original',webdavConfig:arguments[0]});
                const {BackupManager}=await import('./scripts/platform/backup-manager.js');
                const db=await new BackupManager()._openDatabase('aura-tab-assets',1,'images');
                await new Promise((r,j)=>{const tx=db.transaction('images','readwrite');tx.oncomplete=r;tx.onerror=()=>j(tx.error);
                    tx.objectStore('images').put({id:'m4-asset',fullBlob:image,thumbnailBlob:image,status:'ready',isUserPinned:true});});db.close();
                return {files:(await localFilesManager.getAllFileIds()).length,locks:!!navigator.locks};`,config);
            assert.ok(result.files>=1);assert.equal(result.locks,true);
        });
        await run("const {BackupManager}=await import('./scripts/platform/backup-manager.js');window.m4Manager=new BackupManager();");
        await check('Chrome backup own ZIP round trip preserves settings, links, icons and image bytes',async()=>{
            const result=await run(`const m=window.m4Manager;
                // Reseed two keys whose old sanitized ZIP paths collide.
                const {iconCache}=await import('./scripts/platform/icon-cache.js');
                await iconCache.set('m4/a',new Blob(['icon-A']),'https://cache-fixture.invalid/a');
                await iconCache.set('m4:a',new Blob(['icon-B']),'https://cache-fixture.invalid/b');
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
        await check('Chrome backup corrupt, incomplete and oversized-quota archives preserve live data',async()=>{
            const before=await run('return await window.m4Snapshot();');
            const result=await run(`const {unzipSync,zipSync,strToU8}=await import('./scripts/libs/fflate.esm.js');
                const original=unzipSync(new Uint8Array(await window.m4Backup.arrayBuffer()));const results=[];
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
        await check('Chrome backup OPFS upload backup capability and temporary file cleanup',async()=>{
            const result=await run(`window.m4Upload=await window.m4Manager.createBackupForUpload();
                const streaming=window.m4Upload.usedStreaming;const size=window.m4Upload.blob.size;
                await window.m4Upload.cleanup?.();let count=null;
                if(streaming){const root=await navigator.storage.getDirectory();const dir=await root.getDirectoryHandle('aura-tab-tmp');count=0;for await(const _entry of dir.values())count++;}
                return {streaming,size,count};`);
            assert.ok(result.size>100);if(result.streaming)assert.equal(result.count,0);report.opfs=result;
        });
        await check('Chrome backup WebDAV connection, nested directory, PUT, namespace listing, GET and restore',async()=>{
            const result=await run(`const {WebDAVClient}=await import('./scripts/shared/webdav-client.js');
                window.m4Dav=new WebDAVClient(arguments[0]);const client=window.m4Dav;
                const connection=await client.testConnection();const directory=await client.ensureDir();
                const put=await client.putFile('测试 # 100%.zip',window.m4Backup);const files=await client.listFiles();
                const blob=await client.getFile('测试 # 100%.zip');
                const restore=await window.m4Manager.restoreFromBackup(blob);
                return {connection,directory,put,files,restore,size:blob.size,expectedSize:window.m4Backup.size};`,config);
            report.webdav=result;
            assert.equal(result.connection.success,true);assert.equal(result.directory,true);assert.equal(result.put,true);
            assert.equal(result.files[0].filename,'测试 # 100%.zip');assert.equal(result.size,result.expectedSize);assert.equal(result.restore.success,true);
        });
        await check('Chrome backup WebDAV auth, denied listing, stalled body and interrupted transfer fail visibly',async()=>{
            assert.equal((await run(`const {WebDAVClient}=await import('./scripts/shared/webdav-client.js');return new WebDAVClient({...arguments[0],password:'wrong'}).testConnection();`,config)).message,'auth_failed');
            mode='denied';assert.equal(await run(`try{await window.m4Dav.listFiles();return false;}catch{return true;}`),true);
            for(const failure of ['stall','broken']) {mode=failure;assert.equal(await run(`return await window.m4Dav.getFile('测试 # 100%.zip');`),null);}
            mode='normal';assert.equal(await run(`return await window.m4Dav.deleteFile('测试 # 100%.zip');`),true);
        });

        await check('Chrome streaming ZIP writes to a real writable file and handles picker cancellation',async()=>{
            const value=await run(`const original=window.showSaveFilePicker;
                const root=await navigator.storage.getDirectory(),handle=await root.getFileHandle('chrome-streaming-fixture.zip',{create:true});
                try {window.showSaveFilePicker=async()=>handle;
                    const result=await window.m4Manager.downloadBackupStreaming();const file=await handle.getFile();
                    const {unzipSync,strFromU8}=await import('./scripts/libs/fflate.esm.js');
                    const zip=unzipSync(new Uint8Array(await file.arrayBuffer()));
                    window.showSaveFilePicker=async()=>{throw new DOMException('Cancelled','AbortError');};
                    return {result,marker:JSON.parse(strFromU8(zip['storage/sync.json'])).m4Marker,cancelled:await window.m4Manager.downloadBackupStreaming()};
                }finally{window.showSaveFilePicker=original;await root.removeEntry('chrome-streaming-fixture.zip');}`);
            assert.deepEqual(value.result,{success:true,usedStreaming:true});assert.equal(value.marker,'原始设置');
            assert.deepEqual(value.cancelled,{success:false,error:'user_cancelled',usedStreaming:true});
        });
        await check('Chrome Blob download fallback saves a readable ZIP',async()=>{
            const existing=new Set(await readdir(evidence));
            const value=await run(`const descriptor=Object.getOwnPropertyDescriptor(window,'showSaveFilePicker');
                try {delete window.showSaveFilePicker;return await window.m4Manager.downloadBackupStreaming();}
                finally {Object.defineProperty(window,'showSaveFilePicker',descriptor);}`);
            assert.deepEqual(value,{success:true,usedStreaming:false});
            let file;await driver.wait(async()=>{file=(await readdir(evidence)).find(n=>!existing.has(n)&&n.startsWith('aura-tab-backup_')&&n.endsWith('.zip'));return !!file;},10000);
            const zip=unzipSync(await readFile(path.join(evidence,file)));
            assert.equal(JSON.parse(strFromU8(zip['storage/sync.json'])).m4Marker,'原始设置');
        });
    }finally{report.webdavRequests=requests;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
