import assert from 'node:assert/strict';
import { Builder, By, Key } from 'selenium-webdriver';
import firefox from 'selenium-webdriver/firefox.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync, zipSync, strFromU8, strToU8 } from '../scripts/libs/fflate.esm.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const project = JSON.parse(await readFile(path.join(root, 'ember.project.json'), 'utf8'));
const version = project.currentVersion || project.initialVersion;
const evidence = path.join(root, process.env.FIREFOX_SEARCH_EVIDENCE || '.local/search-update');
await mkdir(evidence, { recursive: true });
const entries = unzipSync(await readFile(path.join(root, `dist/ember-tab-${version}-firefox.zip`)));
// Instrument a separate test-only ZIP. No fixture or intercepted searches ship.
entries['_search-test.js'] = strToU8(`(() => {
    const originalFetch = window.fetch.bind(window), originalOpen = window.open.bind(window);
    const originalQuery = chrome.search.query.bind(chrome.search);
    const state = window.__searchTest = {mode:'mock',requests:[],submissions:[],aborts:0};
    chrome.search.query = async options => { state.submissions.push({kind:'default',...options}); };
    window.open = (url, target) => {state.submissions.push({kind:'url',url,target});return state.openRealTab ? originalOpen('about:blank',target) : null;};
    state.restoreRouting = () => {chrome.search.query=originalQuery;window.open=originalOpen;};
    window.fetch = async (url, options={}) => {
        const parsed = new URL(url, location.href);
        const hosts=['api.bing.com','suggestqueries.google.com','suggestion.baidu.com','duckduckgo.com','search.brave.com','search.yahoo.com','suggest.yandex.com','ac.search.naver.com'];
        if (!hosts.includes(parsed.hostname)) return originalFetch(url,options);
        const query = ['query','q','wd','command','part'].map(key=>parsed.searchParams.get(key)).find(Boolean);
        state.requests.push({host:parsed.hostname,query,credentials:options.credentials,redirect:options.redirect});
        if(state.mode==='live') return originalFetch(url,options);
        if(query==='timeout') return new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>{state.aborts++;reject(new DOMException('Aborted','AbortError'));}));
        await new Promise(resolve=>setTimeout(resolve, query==='older' ? 1000 : 20));
        if(options.signal?.aborted) state.aborts++;
        const suggestions=[query+' one',query+' two'];
        const data=parsed.hostname==='search.yahoo.com'?{r:suggestions.map(k=>({k}))}
            :parsed.hostname==='ac.search.naver.com'?{items:[suggestions.map(q=>[q])]}
                :[query,suggestions];
        return new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
    };
})();`);
entries['newtab.html'] = strToU8(strFromU8(entries['newtab.html']).replace('<script src="scripts/boot/first-paint.js">', '<script src="_search-test.js"></script><script src="scripts/boot/first-paint.js">'));
const archive = path.join(evidence, 'instrumented-test-only.zip');
await writeFile(archive, zipSync(entries));
const uuid = '32d367b4-bf14-42d1-b7a9-2aa83f1d80e9';
const options = new firefox.Options().addArguments('-headless', '-remote-allow-system-access')
    .setPreference('gfx.webrender.software', true)
    .setPreference('gfx.webrender.all', true)
    .setPreference('extensions.webextensions.uuids', JSON.stringify({ [project.geckoId]: uuid }))
    .setPreference('messaging-system.rsexperimentloader.enabled', false)
    .setPreference('app.shield.optoutstudies.enabled', false);
if (process.env.FIREFOX_BINARY) options.setBinary(process.env.FIREFOX_BINARY);
const driver = await new Builder().forBrowser('firefox').setFirefoxOptions(options)
    .setFirefoxService(new firefox.ServiceBuilder(path.join(root, '.local/drivers/geckodriver-0.36.0.exe'))).build();
const report = { version, fixture: 'Separate test-only ZIP intercepts search navigation and deterministic suggestions; final live-provider checks use real HTTPS.', checks: [] };
const run = (script, ...args) => driver.executeAsyncScript(`const done=arguments[arguments.length-1];Promise.resolve().then(async()=>{${script}}).then(value=>done({value}),error=>done({error:String(error)}));`, ...args)
    .then(result => { if (result.error) throw new Error(result.error); return result.value; });
const type = async value => {
    await driver.executeScript(`const input=document.getElementById('searchInput');input.focus();input.value=arguments[0];input.dispatchEvent(new Event('input',{bubbles:true}));`, value);
};
const waitRows = text => driver.wait(async () => await driver.executeScript(`return document.getElementById('searchSuggestions').textContent.includes(arguments[0]);`, text), 12000);
const pref = (area, values) => run(`await chrome.storage[arguments[0]].set(arguments[1]);`, area, values);
const check = async (name, task) => { report.running = name; await task(); report.checks.push(name); console.log(`PASS ${name}`); };
try {
    report.browser = (await driver.getCapabilities()).get('browserVersion');
    await driver.manage().setTimeouts({ script: 20000 });
    await driver.manage().window().setRect({ width: 1440, height: 1050 });
    // Permission is granted only in Selenium's disposable profile to exercise a real private window.
    await driver.setContext(firefox.Context.CHROME);
    report.graphics = await driver.executeScript(`return Cc['@mozilla.org/gfx/info;1'].getService(Ci.nsIGfxInfo).getFeatures();`);
    await driver.executeAsyncScript(`const done=arguments[arguments.length-1];ChromeUtils.importESModule('resource://gre/modules/ExtensionPermissions.sys.mjs').ExtensionPermissions.add(arguments[0],{permissions:['internal:privateBrowsingAllowed'],origins:[]}).then(()=>done(true),error=>done(String(error)));`, project.geckoId);
    await driver.setContext(firefox.Context.CONTENT);
    await driver.installAddon(archive, true);
    await driver.get(`moz-extension://${uuid}/newtab.html`);
    report.running = 'startup clock';
    await driver.wait(async () => await driver.executeScript(`return document.getElementById('clock').textContent!=='00:00';`), 15000);
    await pref('sync', { interfaceLanguage: 'zh-CN', searchActive: true, searchOpenInNewTab: true });
    // Reload so the app's module instance hydrates preferences, including on ESR's WebDriver sandbox.
    await driver.navigate().refresh();
    report.running = 'startup language';
    await driver.wait(async () => await driver.executeScript(`return document.documentElement.lang==='zh-CN' && document.getElementById('clock').textContent!=='00:00';`), 15000);
    await driver.executeScript(`document.querySelector('.changelog-btn-close')?.click();`);
    if (!(await driver.executeScript(`return document.getElementById('searchContainer').classList.contains('show');`))) await driver.findElement(By.id('searchToggleBtn')).click();
    report.running = 'startup search visibility';
    await driver.wait(async () => await driver.findElement(By.id('searchInput')).isDisplayed(), 15000);
    await driver.executeScript(`document.querySelector('.changelog-btn-close')?.click();`);
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
    await check('appearance sliders preview, persist across tabs, style the real panel and reset only appearance', async () => {
        await driver.findElement(By.id('settingsBtn')).click();
        await driver.wait(async () => await driver.executeScript(`return getComputedStyle(document.getElementById('macSettingsOverlay')).opacity==='1';`), 5000);
        await driver.findElement(By.css('[data-menu="appearance"]')).click();
        await driver.wait(async () => (await driver.findElements(By.id('macSearchPanelOpacity'))).length>0, 10000);
        await driver.wait(async () => await driver.executeScript(`return document.getElementById('macSearchPanelOpacity').value==='68' && document.getElementById('macSearchPanelBlur').value==='48';`), 5000);
        await driver.executeScript(`for(const [id,value] of [['macSearchPanelOpacity',85],['macSearchPanelBlur',20]]){const input=document.getElementById(id);input.value=value;input.dispatchEvent(new Event('input'));}`);
        assert.equal(await driver.executeScript(`return document.documentElement.style.getPropertyValue('--search-panel-opacity');`), '0.85');
        assert.equal(await driver.executeScript(`return getComputedStyle(document.querySelector('.mac-search-panel-preview-surface')).backdropFilter.includes('20px');`), true);
        assert.equal(await run(`return 'searchPanelOpacity' in (await chrome.storage.sync.get('searchPanelOpacity'));`), false);
        await driver.executeScript(`for(const id of ['macSearchPanelOpacity','macSearchPanelBlur'])document.getElementById(id).dispatchEvent(new Event('change'));`);
        await driver.wait(async () => await run(`const data=await chrome.storage.sync.get(['searchPanelOpacity','searchPanelBlur']);return data.searchPanelOpacity===85 && data.searchPanelBlur===20;`), 5000);
        await driver.wait(async () => await driver.executeScript(`return getComputedStyle(document.getElementById('macSettingsOverlay')).opacity==='1';`), 5000);
        await driver.executeScript(`document.getElementById('macSearchPanelAppearance').scrollIntoView({block:'center'});`);
        await writeFile(path.join(evidence, 'appearance.png'), await driver.takeScreenshot(), 'base64');
        const original = await driver.getWindowHandle();
        await driver.switchTo().newWindow('tab'); await driver.get(`moz-extension://${uuid}/newtab.html`);
        await driver.wait(async () => await driver.executeScript(`return document.documentElement.style.getPropertyValue('--search-panel-opacity')==='0.85' && document.documentElement.style.getPropertyValue('--search-panel-blur')==='20px';`), 10000);
        assert.equal(await driver.executeScript(`return document.getElementById('searchSuggestions').parentElement.hidden;`), true);
        await driver.close(); await driver.switchTo().window(original);
        await run(`await chrome.runtime.sendMessage({type:'emberSearchHistory',action:'add',query:'appearance preview'});`);
        await driver.findElement(By.id('macSettingsClose')).click();
        await driver.wait(async () => await driver.executeScript(`const input=document.getElementById('searchInput'),r=input.getBoundingClientRect();return input===document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);`), 5000);
        await type('appearance preview'); await waitRows('appearance preview');
        const actual = await driver.executeScript(`const style=getComputedStyle(document.querySelector('.search-suggestions'));return {background:style.backgroundColor,blur:style.backdropFilter};`);
        assert.match(actual.background, /0\.85\)/); assert.match(actual.blur, /20px/);
        await run(`await chrome.runtime.sendMessage({type:'emberSearchHistory',action:'clear'});`); await type('');
        await driver.findElement(By.id('settingsBtn')).click();
        await driver.wait(async () => await driver.executeScript(`return getComputedStyle(document.getElementById('macSettingsOverlay')).opacity==='1';`), 5000);
        await driver.findElement(By.css('[data-menu="appearance"]')).click();
        await driver.wait(async () => (await driver.findElements(By.id('macSearchPanelReset'))).length>0, 5000);
        await driver.findElement(By.id('macSearchPanelReset')).click();
        await driver.wait(async () => await run(`const data=await chrome.storage.sync.get(['searchPanelOpacity','searchPanelBlur']);return data.searchPanelOpacity===68 && data.searchPanelBlur===48;`), 5000);
        assert.equal(await run(`return (await chrome.storage.local.get('searchHistoryEnabled')).searchHistoryEnabled;`), true);
        await driver.findElement(By.id('macSettingsClose')).click();
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
    await check('opening a real result tab clears input and focus before returning to Ember', async () => {
        await pref('sync', { preferredSearchEngine: 'bing' });
        const original = await driver.getWindowHandle();
        const count = (await driver.getAllWindowHandles()).length;
        await driver.executeScript(`window.__searchTest.openRealTab=true;`);
        await type('return to Ember');
        await driver.findElement(By.css('.search-submit')).click();
        await driver.wait(async () => (await driver.getAllWindowHandles()).length===count+1, 5000);
        const result = (await driver.getAllWindowHandles()).find(handle=>handle!==original);
        await driver.switchTo().window(result);
        assert.equal(await driver.getCurrentUrl(), 'about:blank');
        await driver.close(); await driver.switchTo().window(original);
        await driver.wait(async () => await driver.executeScript(`const input=document.getElementById('searchInput');return input.value==='' && !document.getElementById('searchContainer').contains(document.activeElement) && document.querySelector('.search-suggestions').hidden;`), 5000);
        await writeFile(path.join(evidence, 'search-submitted-cleared.png'), await driver.takeScreenshot(), 'base64');
        await driver.executeScript(`window.__searchTest.openRealTab=false;`);
        await run(`await chrome.runtime.sendMessage({type:'emberSearchHistory',action:'delete',query:'return to Ember'});`);
    });
    await check('new-tab autofocus stays closed; explicit click opens readable glass history without an input clear button', async () => {
        await driver.switchTo().newWindow('tab');
        await driver.get(`moz-extension://${uuid}/newtab.html`);
        await driver.wait(async () => await driver.executeScript(`return document.getElementById('clock').textContent!=='00:00' && document.getElementById('searchContainer').classList.contains('show');`), 15000);
        await driver.wait(async () => await driver.findElement(By.id('searchInput')).isDisplayed(), 5000);
        await driver.sleep(300);
        assert.equal(await driver.executeScript(`return document.activeElement===document.getElementById('searchInput');`), true);
        assert.equal(await driver.executeScript(`return document.getElementById('searchSuggestions').parentElement.hidden;`), true);
        await writeFile(path.join(evidence, 'newtab-history-closed.png'), await driver.takeScreenshot(), 'base64');
        // A deliberately detailed wallpaper exposes missing backdrop blur that a smooth default hides.
        await driver.executeScript(`const wallpaper=document.createElement('div');wallpaper.id='_searchVisualWallpaper';Object.assign(wallpaper.style,{position:'absolute',inset:'0',zIndex:'10',pointerEvents:'none',background:'repeating-linear-gradient(26deg,#dce3ed 0 3px,#8090a9 3px 7px,#d6bcb0 7px 11px,#4c5366 11px 14px)'});document.getElementById('background-wrapper').append(wallpaper);`);
        await driver.findElement(By.id('searchInput')).click(); await waitRows('ember tab');
        const panel = await driver.executeScript(`const panel=document.querySelector('.search-suggestions'),input=document.getElementById('searchContainer'),p=panel.getBoundingClientRect(),i=input.getBoundingClientRect(),style=getComputedStyle(panel);return {outsideGlass:panel.parentElement===document.body,blur:style.backdropFilter,bg:style.backgroundColor,left:p.left-i.left,width:p.width-i.width,gap:p.top-i.bottom,clear:!!document.querySelector('.search-clear')};`);
        assert.equal(panel.outsideGlass, true); assert.match(panel.blur, /blur\(48px\)/); assert.match(panel.bg, /0\.68\)/);
        assert.ok(Math.abs(panel.left)<1 && Math.abs(panel.width)<1 && Math.abs(panel.gap-10)<1);
        assert.equal(panel.clear, false);
        await writeFile(path.join(evidence, 'history-glass-detailed.png'), await driver.takeScreenshot(), 'base64');
        await type('steam'); await pref('local', { searchHistoryEnabled: false, searchSuggestionsEnabled: true, searchSuggestionSource: 'bing' });
        await waitRows('steam one');
        await writeFile(path.join(evidence, 'suggestions-glass-detailed.png'), await driver.takeScreenshot(), 'base64');
        await driver.executeScript(`document.getElementById('_searchVisualWallpaper').remove();`);
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
    await check('real private window neither reads/writes history nor requests suggestions', async () => {
        await pref('local', { searchHistoryEnabled: true, searchSuggestionsEnabled: true });
        const before = await run(`return (await chrome.storage.local.get('emberSearchHistory')).emberSearchHistory;`);
        const regular = await driver.getWindowHandle();
        const oldWindows = await driver.getAllWindowHandles();
        await driver.setContext(firefox.Context.CHROME);
        await driver.executeScript('OpenBrowserWindow({private:true});');
        await driver.setContext(firefox.Context.CONTENT);
        await driver.wait(async () => (await driver.getAllWindowHandles()).length > oldWindows.length, 10000);
        const privateHandle = (await driver.getAllWindowHandles()).find(handle => !oldWindows.includes(handle));
        await driver.switchTo().window(privateHandle);
        await driver.wait(async () => await driver.executeScript(`return location.href==='about:privatebrowsing' && document.readyState==='complete';`), 10000);
        await driver.get(`moz-extension://${uuid}/newtab.html`);
        await driver.wait(async () => await driver.executeScript(`const clock=document.getElementById('clock');return !!clock && clock.textContent!=='00:00';`), 15000);
        assert.equal(await driver.executeScript('return chrome.extension.inIncognitoContext;'), true);
        await driver.executeScript(`document.querySelector('.changelog-btn-close')?.click();`);
        if (!(await driver.executeScript(`return document.getElementById('searchContainer').classList.contains('show');`))) await driver.findElement(By.id('searchToggleBtn')).click();
        await driver.wait(async () => await driver.findElement(By.id('searchInput')).isDisplayed(), 5000);
        await type('private search'); await driver.sleep(450);
        assert.equal(await driver.executeScript('return window.__searchTest.requests.length;'), 0);
        assert.deepEqual(await run(`return (await chrome.runtime.sendMessage({type:'emberSearchHistory',action:'list'})).items;`), []);
        await driver.findElement(By.id('searchInput')).sendKeys(Key.ENTER);
        await driver.wait(async () => await driver.executeScript('return window.__searchTest.submissions.length>0;'), 5000);
        assert.deepEqual(await run(`return (await chrome.storage.local.get('emberSearchHistory')).emberSearchHistory;`), before);
        await driver.close(); await driver.switchTo().window(regular);
        await pref('local', { searchHistoryEnabled: false });
    });
    if (process.argv.includes('--live')) await check('live HTTPS suggestions render for all eight adapted providers', async () => {
        await driver.executeScript(`window.__searchTest.mode='live';`);
        await pref('local', { searchSuggestionsEnabled: true });
        report.live = [];
        for (const engine of ['bing', 'google', 'baidu', 'duckduckgo', 'brave', 'yahoo', 'yandex', 'naver']) {
            await type(''); await pref('sync', { preferredSearchEngine: engine }); await type('steam');
            await driver.wait(async () => await driver.executeScript(`return document.querySelectorAll('.search-suggestion-choice').length>0;`), 12000);
            const result = await driver.executeScript(`return {engine:arguments[0],text:document.getElementById('searchSuggestions').textContent,header:document.querySelector('.search-suggestions-label').textContent};`, engine);
            assert.ok(!result.text.includes('�'));
            report.live.push(result);
            if (engine === 'bing') {
                await writeFile(path.join(evidence, 'suggestions.png'), await driver.takeScreenshot(), 'base64');
                await driver.findElement(By.id('searchInput')).sendKeys(Key.ARROW_UP);
                const visible = await driver.executeScript(`const panel=document.querySelector('.search-suggestions').getBoundingClientRect(),row=document.querySelector('.search-suggestion-row.selected').getBoundingClientRect(),dock=document.getElementById('quicklinksContainer').getBoundingClientRect();return row.top>=panel.top && row.bottom<=panel.bottom && panel.bottom<dock.top;`);
                assert.equal(visible, true);
            }
        }
    });
    delete report.running;
    await writeFile(path.join(evidence, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ browser: report.browser, checks: report.checks.length, live: report.live?.length || 0 }));
} catch (error) {
    report.error = String(error);
    report.diagnostics = await driver.executeScript(`return {url:location.href,lang:document.documentElement.lang,clock:document.getElementById('clock')?.textContent,searchClass:document.getElementById('searchContainer')?.className,private:chrome.extension?.inIncognitoContext,fixture:typeof window.__searchTest};`).catch(() => null);
    await writeFile(path.join(evidence, 'failure.png'), await driver.takeScreenshot(), 'base64');
    await writeFile(path.join(evidence, 'report.json'), JSON.stringify(report, null, 2));
    throw error;
} finally { await driver.quit(); }
