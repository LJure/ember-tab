import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Builder } from 'selenium-webdriver';
import firefox from 'selenium-webdriver/firefox.js';
import { unzipSync, zipSync, strFromU8, strToU8 } from '../scripts/libs/fflate.esm.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const project = JSON.parse(await readFile(path.join(root, 'ember.project.json'), 'utf8'));
const evidence = path.resolve(root, process.env.FIREFOX_UI_EVIDENCE || '.local/second-update');
await mkdir(evidence, { recursive: true });
const entries = unzipSync(await readFile(path.join(root, `dist/ember-tab-${project.currentVersion}-firefox.zip`)));
entries['_ui-test.mjs'] = strToU8(`import {backgroundSystem} from './scripts/domains/backgrounds/controller.js'; window.__uiSystem=backgroundSystem;`);
entries['newtab.html'] = strToU8(strFromU8(entries['newtab.html']).replace('</body>', '<script type="module" src="_ui-test.mjs"></script></body>'));
const testArchive = path.join(evidence, 'instrumented-test-only.zip');
await writeFile(testArchive, zipSync(entries));
const uuid = '32d367b4-bf14-42d1-b7a9-2aa83f1d80e9';
const options = new firefox.Options().addArguments('-headless', '-remote-allow-system-access')
    .setPreference('extensions.webextensions.uuids', JSON.stringify({ [project.geckoId]: uuid }))
    .setPreference('gfx.webrender.software', true)
    .setPreference('messaging-system.rsexperimentloader.enabled', false)
    .setPreference('app.shield.optoutstudies.enabled', false);
if (process.env.FIREFOX_BINARY) options.setBinary(process.env.FIREFOX_BINARY);
const driver = await new Builder().forBrowser('firefox').setFirefoxOptions(options)
    .setFirefoxService(new firefox.ServiceBuilder(path.join(root, '.local/drivers/geckodriver-0.36.0.exe'))).build();
const report = { version: project.currentVersion, fixture: 'Disposable Firefox profile; separate test-only ZIP exposes the page module instance. Wallpaper provider is delayed locally to inspect busy state. Production package is uninstrumented.', checks: [] };
const run = (script, ...args) => driver.executeAsyncScript(`const done=arguments[arguments.length-1];Promise.resolve().then(async()=>{${script}}).then(value=>done({value}),error=>done({error:String(error)}));`, ...args)
    .then(result => { if (result.error) throw Error(result.error); return result.value; });
const wait = script => driver.wait(() => driver.executeScript(script), 12000);
const check = async (name, task) => { report.running = name; await task(); report.checks.push(name); console.log(`PASS ${name}`); };
const screenshot = async name => writeFile(path.join(evidence, name + '.png'), await driver.takeScreenshot(), 'base64');
try {
    report.browser = (await driver.getCapabilities()).get('browserVersion');
    await driver.manage().setTimeouts({ script: 20000 });
    await driver.manage().window().setRect({ width: 1440, height: 1000 });
    await driver.installAddon(testArchive, true);
    await driver.get(`moz-extension://${uuid}/newtab.html`);
    await run(`await chrome.storage.sync.set({searchActive:true,interfaceLanguage:'zh-CN',backgroundSettings:{type:'files',frequency:'never',smartCropEnabled:false}});await chrome.storage.local.set({searchHistoryEnabled:true,searchSuggestionsEnabled:false,emberSearchHistory:['Ember Tab','Firefox 扩展','UI 动效优化','壁纸设置']});`);
    await driver.navigate().refresh();
    await wait(`return document.getElementById('clock').textContent!=='00:00' && document.documentElement.lang==='zh-CN';`);
    await driver.executeScript(`document.querySelector('.changelog-btn-close')?.click();`);
    await wait(`return document.getElementById('searchContainer').classList.contains('show');`);
    await check('new blue icons retain alpha at all manifest sizes', async () => {
        const icons = await run(`const manifest=chrome.runtime.getManifest();const result=[];for(const [size,url] of Object.entries(manifest.icons)){const img=new Image();img.src=chrome.runtime.getURL(url);await img.decode();const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,img.width,img.height).data;const mid=(Math.floor(img.height/2)*img.width+Math.floor(img.width/2))*4;result.push({size:Number(size),width:img.width,height:img.height,cornerAlpha:data[3],center:[...data.slice(mid,mid+4)]});}return result;`);
        for (const icon of icons) { assert.equal(icon.width, icon.size); assert.equal(icon.height, icon.size); assert.ok(icon.cornerAlpha <= 4); assert.ok(icon.center[2] > 200 && icon.center[0] < 20); }
        assert.deepEqual(icons.map(icon => icon.size), [16, 32, 48, 128]);
        report.icons = icons;
    });
    await check('panel opens with motion, exits inert and can reverse an unfinished close', async () => {
        await driver.executeScript(`const input=document.getElementById('searchInput');input.focus();input.dispatchEvent(new Event('pointerdown',{bubbles:true}));`);
        await wait(`return !document.querySelector('.search-suggestions').hidden;`);
        const opened = await driver.executeScript(`const panel=document.querySelector('.search-suggestions');return {expanded:document.getElementById('searchInput').getAttribute('aria-expanded'),animations:panel.getAnimations().length};`);
        assert.equal(opened.expanded, 'true'); assert.ok(opened.animations > 0);
        await wait(`return document.querySelector('.search-suggestions').getAnimations().length===0;`);
        await screenshot('history');
        const result = await run(`const panel=document.querySelector('.search-suggestions'),input=document.getElementById('searchInput');input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));const closed={hidden:panel.hidden,inert:panel.inert,display:getComputedStyle(panel).display,expanded:input.getAttribute('aria-expanded')};input.dispatchEvent(new Event('pointerdown',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,350));return {closed,reopened:!panel.hidden&&!panel.inert&&!panel.classList.contains('closing')&&getComputedStyle(panel).opacity==='1'};`);
        assert.deepEqual(result.closed, { hidden: true, inert: true, display: 'block', expanded: 'false' });
        assert.equal(result.reopened, true);
        await driver.executeScript(`document.getElementById('searchInput').blur();`);
        await wait(`return getComputedStyle(document.querySelector('.search-suggestions')).display==='none';`);
    });
    await check('deletion keeps the surface and surviving nodes; rows and height animate', async () => {
        await driver.executeScript(`const input=document.getElementById('searchInput');input.focus();input.dispatchEvent(new Event('pointerdown',{bubbles:true}));`);
        await wait(`return document.querySelectorAll('#searchSuggestions .search-suggestion-row').length===4 && document.querySelector('.search-suggestions').getAnimations().length===0;`);
        await driver.executeScript(`const panel=document.querySelector('.search-suggestions');window.__uiHidden=[];window.__uiRows=[...document.getElementById('searchSuggestions').children];window.__uiObserver=new MutationObserver(records=>window.__uiHidden.push(...records.map(record=>record.oldValue)));window.__uiObserver.observe(panel,{attributes:true,attributeFilter:['hidden'],attributeOldValue:true});document.querySelector('.search-history-delete').click();`);
        await wait(`return document.querySelectorAll('#searchSuggestions .search-suggestion-row').length===3;`);
        const state = await driver.executeScript(`const panel=document.querySelector('.search-suggestions');return {hidden:panel.hidden,reused:document.getElementById('searchSuggestions').children[0]===window.__uiRows[1],hiddenChanges:window.__uiHidden.length,animations:panel.getAnimations({subtree:true}).length};`);
        assert.equal(state.hidden, false); assert.equal(state.reused, true); assert.equal(state.hiddenChanges, 0); assert.ok(state.animations > 0);
        await wait(`return document.querySelector('.search-suggestions').getAnimations({subtree:true}).length===0;`);
        assert.equal(await driver.executeScript(`return document.querySelectorAll('.search-suggestion-exit').length;`), 0);
        await driver.executeScript(`window.__uiObserver.disconnect();`);
        await screenshot('history-after-delete');
    });
    await check('automatic message and visibility refresh spin throughout fetching and applying', async () => {
        await run(`const system=window.__uiSystem;await system.whenReady();system.settings={...system.settings,type:'pexels',frequency:'hour',smartCropEnabled:false};system.nextBackground=null;system.preloadNextBackground=()=>{};system.getProviderBackground=()=>new Promise(resolve=>window.__uiFinish=()=>resolve(system.getSystemBackgrounds()[0]));system._runtimeMessageHandler({type:'refreshBackground'});`);
        await wait(`return !!window.__uiFinish && document.getElementById('refreshBgBtn').getAttribute('aria-busy')==='true';`);
        const start = await driver.executeScript(`return getComputedStyle(document.querySelector('#refreshBgBtn svg')).transform;`);
        await run(`await new Promise(resolve=>setTimeout(resolve,700));`);
        const end = await driver.executeScript(`return getComputedStyle(document.querySelector('#refreshBgBtn svg')).transform;`);
        assert.notEqual(start, end);
        await screenshot('wallpaper-refreshing');
        await driver.executeScript(`window.__uiFinish();`);
        await wait(`return !document.getElementById('refreshBgBtn').classList.contains('refreshing');`);
        await driver.executeScript(`window.__uiFinish=null;window.__uiSystem.lastChange='2000-01-01T00:00:00.000Z';document.dispatchEvent(new Event('visibilitychange'));`);
        await wait(`return !!window.__uiFinish && document.getElementById('refreshBgBtn').getAttribute('aria-busy')==='true';`);
        await driver.executeScript(`window.__uiFinish();`);
        await wait(`return !document.getElementById('refreshBgBtn').classList.contains('refreshing');`);
    });
    await check('failed wallpaper update falls back and stops spinning', async () => {
        await driver.executeScript(`window.__uiSystem.getProviderBackground=async()=>{throw Error('test provider offline')};window.__uiSystem._runtimeMessageHandler({type:'refreshBackground'});`);
        await wait(`return !document.getElementById('refreshBgBtn').classList.contains('refreshing') && document.getElementById('refreshBgBtn').getAttribute('aria-busy')==='false';`);
    });
    await check('reduced motion opens and closes without panel animations', async () => {
        await driver.setContext(firefox.Context.CHROME);
        await driver.executeScript(`Services.prefs.setIntPref('ui.prefersReducedMotion',1);`);
        await driver.setContext(firefox.Context.CONTENT);
        await wait(`return matchMedia('(prefers-reduced-motion: reduce)').matches;`);
        const state = await run(`const input=document.getElementById('searchInput'),panel=document.querySelector('.search-suggestions');input.focus();input.dispatchEvent(new Event('pointerdown',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,100));const animations=panel.getAnimations().length;input.blur();return {animations,hidden:panel.hidden,display:getComputedStyle(panel).display};`);
        assert.deepEqual(state, { animations: 0, hidden: true, display: 'none' });
    });
} catch (error) {
    report.failure = { message: error.message, stack: error.stack };
    await screenshot('failure').catch(() => {});
    throw error;
} finally {
    await writeFile(path.join(evidence, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    await driver.setContext(firefox.Context.CHROME).then(() => driver.executeScript(`ChromeUtils.importESModule('resource://nimbus/ExperimentAPI.sys.mjs').ExperimentAPI._rsLoader.disable();`)).catch(() => {});
    await driver.quit();
}
