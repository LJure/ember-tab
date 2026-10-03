import assert from 'node:assert/strict';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Builder, By, logging } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import firefox from 'selenium-webdriver/firefox.js';
import { buildExtension } from './build-extension.mjs';
import { chromeIdentity } from './chrome-identity.mjs';
import { connectCdp, enableDeveloperMode } from './chrome-cdp.mjs';
import { seedState, snapshotState } from './migration-state-fixture.mjs';
import { unzipSync, zipSync, strToU8, strFromU8 } from '../scripts/libs/fflate.esm.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const evidence=path.join(root,'.local/chrome-lifecycle/run-'+Date.now());
const sourceDownloads=path.join(evidence,'firefox-export'), targetDownloads=path.join(evidence,'chrome-export');
for(const directory of [evidence,sourceDownloads,targetDownloads]) await mkdir(directory,{recursive:true});
const project=JSON.parse(await readFile(path.join(root,'ember.project.json'),'utf8'));
const identity=chromeIdentity(project), base='chrome-extension://'+identity.id+'/';
const installed=path.join(evidence,'extension-a'), relocated=path.join(evidence,'extension-b');
const profile=path.join(evidence,'chrome-profile');
const binary=process.env.CHROME_BINARY || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const driverPath=process.env.CHROMEDRIVER_BINARY || path.join(root,'.local/chrome-runtime/driver/chromedriver-win64/chromedriver.exe');
const geckoPath=process.env.GECKODRIVER_BINARY || path.join(root,'.local/drivers/geckodriver-0.36.0.exe');
const uuid='32d367b4-bf14-42d1-b7a9-2aa83f1d80e9';
const probe='<!doctype html><meta charset="utf-8"><title>Isolated lifecycle probe</title>';
const checks=[], report={startedAt:new Date().toISOString(),evidence,profile,chromeId:identity.id,checks};
let driver, cdp, firefoxDriver, browserPid;
async function check(name,task) {
    try{await task();checks.push(name);console.log('PASS '+name);}catch(error){report.failedCheck=name;throw error;}
}
async function runWith(browser,script,...args) {
    const response=await browser.executeAsyncScript(`const done=arguments[arguments.length-1];
        Promise.resolve().then(async()=>{${script}}).then(value=>done({value}),error=>done({error:String(error),stack:error.stack}));`,...args);
    if(response.error) throw new Error(response.error+'\n'+response.stack);
    return response.value;
}
const run=(script,...args)=>runWith(driver,script,...args);
async function startChrome(userProfile=profile) {
    const prefs=new logging.Preferences();prefs.setLevel(logging.Type.BROWSER,logging.Level.ALL);
    const options=new chrome.Options().setChromeBinaryPath(binary).setLoggingPrefs(prefs)
        .addArguments('--headless=new','--no-first-run','--no-default-browser-check','--enable-unsafe-extension-debugging','--user-data-dir='+userProfile,'--window-size=1440,1000');
    driver=await new Builder().forBrowser('chrome').setChromeOptions(options).setChromeService(new chrome.ServiceBuilder(driverPath)).build();
    await driver.manage().setTimeouts({script:30000,pageLoad:30000});
    const caps=await driver.getCapabilities();report.chromeVersion=caps.get('browserVersion');
    cdp=await connectCdp(caps.get('goog:chromeOptions').debuggerAddress);
    const developerModeBefore=await enableDeveloperMode(driver);
    if(report.profileStarts?.some(x=>x.profile===userProfile)) assert.equal(developerModeBefore,true,'Developer mode must persist across restart');
    (report.profileStarts||=[]).push({profile:userProfile,developerModeBefore});
    await cdp.command('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:targetDownloads});
    browserPid=(await cdp.command('SystemInfo.getProcessInfo')).processInfo.find(x=>x.type==='browser').id;
    return browserPid;
}
async function stopChrome() {
    if(driver) {
        report.browserLogs=(report.browserLogs||[]).concat((await driver.manage().logs().get(logging.Type.BROWSER).catch(()=>[])).map(x=>({level:x.level.name,message:x.message})));
        // Request a normal browser shutdown before the WebDriver session is disposed.
        await cdp?.command('Browser.close').catch(()=>{});
        await driver.wait(async()=>{try{process.kill(browserPid,0);return false;}catch{return true;}},10000,'Chrome process should exit normally');
        cdp?.close();cdp=null;await driver.quit().catch(()=>{});driver=null;
    }
}
async function stopFirefox() {
    if(!firefoxDriver)return;
    await firefoxDriver.setContext(firefox.Context.CHROME).then(()=>firefoxDriver.executeScript(`ChromeUtils.importESModule('resource://nimbus/ExperimentAPI.sys.mjs').ExperimentAPI._rsLoader.disable();`)).catch(()=>{});
    await firefoxDriver.quit();firefoxDriver=null;
}
async function openProbe() {await driver.get(base+'lifecycle-probe.html');}
async function openNewtab() {
    await driver.get('chrome://newtab/');
    await driver.wait(async()=>{try{return await driver.findElement(By.id('clock')).isDisplayed();}catch{return false;}},15000);
    assert.equal(await run('return chrome.runtime.id;'),identity.id);
}
async function reloadExtension() {
    // The old extension page context must disappear during a real extension reload.
    const before=(await run('return chrome.runtime.getContexts({contextTypes:["TAB"]});')).find(x=>x.documentUrl===base+'lifecycle-probe.html')?.contextId;
    assert.ok(before,'Existing probe context must be observed');
    await run('setTimeout(()=>chrome.runtime.reload(),100);');
    await driver.wait(async()=>{
        try{return await driver.executeScript('return !chrome.runtime?.id;');}catch{return true;}
    },15000);
    await openProbe();
    await driver.wait(async()=>await driver.executeScript('return !!chrome.runtime?.id;'),10000);
    const after=(await run('return chrome.runtime.getContexts({contextTypes:["TAB"]});')).find(x=>x.documentUrl===base+'lifecycle-probe.html')?.contextId;
    assert.notEqual(after,before,'Reload must replace the extension page context');
}
function assertPortable(actual,expected) {
    for(const key of ['settings','links','dock','files']) assert.deepEqual(actual[key],expected[key],key);
    // UI may warm additional caches; every exported record and Blob must survive unchanged.
    for(const [database,rows] of Object.entries(expected.databases)) for(const row of rows) {
        assert.deepEqual(actual.databases[database].find(x=>x.id===row.id),row,database+' '+row.id);
    }
}
function assertPreserved(actual,expected) {
    assert.equal(actual.id,identity.id);assertPortable(actual.portable,expected.portable);
    assert.deepEqual(actual.local,expected.local);assert.deepEqual(actual.private,expected.private);
}
async function downloadZip(browser,directory) {
    const before=new Set(await readdir(directory));
    await runWith(browser,"const {BackupManager}=await import('./scripts/platform/backup-manager.js');await new BackupManager().downloadBackup();");
    let file,bytes,entries;await browser.wait(async()=>{
        const filename=(await readdir(directory)).find(x=>!before.has(x)&&x.startsWith('aura-tab-backup_')&&x.endsWith('.zip'));
        if(!filename)return false;
        // Firefox creates the destination name before finishing its .part download.
        try{file=path.join(directory,filename);bytes=await readFile(file);entries=unzipSync(bytes);return !!entries['meta.json'];}catch{return false;}
    },15000);
    const local=JSON.parse(strFromU8(entries['storage/local.json'])), sync=JSON.parse(strFromU8(entries['storage/sync.json']));
    for(const key of ['emberSearchHistory','searchHistoryEnabled','searchSuggestionsEnabled','searchSuggestionSource','webdavConfig']) {
        assert.ok(!(key in local)&&!(key in sync),'Excluded local field '+key);
    }
    return {file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),meta:JSON.parse(strFromU8(entries['meta.json']))};
}
async function click(selector) {
    await driver.wait(async()=>await driver.executeScript('return !document.getAnimations().some(a=>a.playState==="running"&&a.effect.getComputedTiming().iterations!==Infinity);'),5000);
    await driver.findElement(By.css(selector)).click();
}
async function importUi(file,confirm=true) {
    report.importStage='open settings';
    await openNewtab();await click('#settingsBtn');await click('[data-menu="data"]');
    await driver.wait(async()=>(await driver.findElements(By.id('macImportDataFileInput'))).length>0,10000);
    const before=await driver.executeScript('return performance.timeOrigin;');
    await driver.findElement(By.id('macImportDataFileInput')).sendKeys(file);
    report.importStage='confirm';
    await driver.wait(async()=>(await driver.findElements(By.css('.confirm-dialog-overlay.active'))).length>0,5000);
    await click(confirm?'.confirm-dialog__confirm':'.confirm-dialog__cancel');
    report.importStage=confirm?'wait imported page reload':'wait original wallpaper';
    if(confirm) await driver.wait(async()=>{
        try{return await driver.executeScript('return performance.timeOrigin!==arguments[0]&&!!document.getElementById("clock");',before);}catch{return false;}
    },20000);
    report.importStage='wait selected local wallpaper';
    await driver.wait(async()=>await driver.executeScript('return [...document.querySelectorAll(".background-image.ready")].some(el=>el.style.backgroundImage.includes("blob:"));'),15000);
}

try {
    report.chromePackage=await buildExtension('chrome');report.firefoxPackage=await buildExtension('firefox');
    await cp(report.chromePackage.directory,installed,{recursive:true});
    await writeFile(path.join(installed,'lifecycle-probe.html'),probe);
    const entries=unzipSync(await readFile(report.firefoxPackage.archive));entries['lifecycle-probe.html']=strToU8(probe);
    const firefoxPackage=path.join(evidence,'firefox-with-probe.zip');await writeFile(firefoxPackage,zipSync(entries));
    let source,original,sourceZip,safetyZip;
    await check('actual Firefox seed, native ZIP export and private-field exclusions',async()=>{
        const options=new firefox.Options().addArguments('-headless','-remote-allow-system-access')
            .setPreference('extensions.webextensions.uuids',JSON.stringify({[project.geckoId]:uuid}))
            .setPreference('messaging-system.rsexperimentloader.enabled',false).setPreference('app.shield.optoutstudies.enabled',false)
            .setPreference('browser.download.folderList',2).setPreference('browser.download.dir',sourceDownloads)
            .setPreference('browser.helperApps.neverAsk.saveToDisk','application/zip').setPreference('browser.download.alwaysOpenPanel',false);
        if(process.env.FIREFOX_BINARY)options.setBinary(process.env.FIREFOX_BINARY);
        firefoxDriver=await new Builder().forBrowser('firefox').setFirefoxOptions(options).setFirefoxService(new firefox.ServiceBuilder(geckoPath)).build();
        report.firefoxVersion=(await firefoxDriver.getCapabilities()).get('browserVersion');
        await firefoxDriver.manage().setTimeouts({script:30000,pageLoad:30000});
        assert.equal(await firefoxDriver.installAddon(firefoxPackage,true),project.geckoId);
        await firefoxDriver.get('moz-extension://'+uuid+'/newtab.html');
        await firefoxDriver.wait(async()=>await firefoxDriver.findElement(By.id('clock')).isDisplayed(),15000);
        await firefoxDriver.get('moz-extension://'+uuid+'/lifecycle-probe.html');
        await runWith(firefoxDriver,seedState,'Firefox 迁移');source=await runWith(firefoxDriver,snapshotState);
        sourceZip=await downloadZip(firefoxDriver,sourceDownloads);assert.equal(sourceZip.meta.extensionVersion,project.currentVersion);
        report.source=source;report.sourceZip=sourceZip;await stopFirefox();
    });
    await check('fixed Chrome ID and real seed with links, settings and four image stores',async()=>{
        report.firstProcess=await startChrome();assert.equal((await cdp.command('Extensions.loadUnpacked',{path:installed})).id,identity.id);
        await openNewtab();await openProbe();await run(seedState,'Chrome 原始');original=await run(snapshotState);
        assert.equal(original.id,identity.id);report.original=original;
    });
    await check('extension reload retains local, sync, history, credentials and image bytes',async()=>{
        await reloadExtension();const value=await run(snapshotState);assertPreserved(value,original);report.reload=value;
    });
    await check('browser restart retains extension registration and all persistent data',async()=>{
        await stopChrome();report.secondProcess=await startChrome();assert.notEqual(report.secondProcess,report.firstProcess);
        await openNewtab();await openProbe();const value=await run(snapshotState);assertPreserved(value,original);report.restart=value;
    });
    await check('manual directory update loads new version and script without uninstall or data loss',async()=>{
        const parts=project.currentVersion.split('.');parts[parts.length-1]=String(Number(parts.at(-1))+1);report.testUpgradeVersion=parts.join('.');
        const manifest=JSON.parse(await readFile(path.join(installed,'manifest.json'),'utf8'));manifest.version=report.testUpgradeVersion;
        await writeFile(path.join(installed,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
        await writeFile(path.join(installed,'lifecycle-version.js'),'window.lifecycleUpgradeMarker="test-only-updated-code";\n');
        const html=await readFile(path.join(installed,'newtab.html'),'utf8');
        await writeFile(path.join(installed,'newtab.html'),html.replace('<script src="scripts/boot/first-paint.js">','<script src="lifecycle-version.js"></script><script src="scripts/boot/first-paint.js">'));
        await reloadExtension();await openNewtab();assert.equal(await driver.executeScript('return window.lifecycleUpgradeMarker;'),'test-only-updated-code');
        await openProbe();const value=await run(snapshotState);assertPreserved(value,original);assert.equal(value.version,report.testUpgradeVersion);report.upgrade=value;
    });
    await check('updated version and image data survive another browser restart',async()=>{
        await stopChrome();report.thirdProcess=await startChrome();assert.notEqual(report.thirdProcess,report.secondProcess);
        await openNewtab();assert.equal(await driver.executeScript('return window.lifecycleUpgradeMarker;'),'test-only-updated-code');
        await openProbe();const value=await run(snapshotState);assertPreserved(value,original);assert.equal(value.version,report.testUpgradeVersion);
    });
    await check('loading a different directory retains the same ID and existing data',async()=>{
        await cp(installed,relocated,{recursive:true});
        assert.equal((await cdp.command('Extensions.loadUnpacked',{path:relocated})).id,identity.id);
        await openProbe();await reloadExtension();assertPreserved(await run(snapshotState),original);
    });
    await check('Chrome native safety ZIP export and cancelling import leave original data intact',async()=>{
        safetyZip=await downloadZip(driver,targetDownloads);report.safetyZip=safetyZip;
        await importUi(sourceZip.file,false);await openProbe();assertPreserved(await run(snapshotState),original);
    });
    await check('Firefox ZIP imports through Chrome settings and preserves destination-local privacy',async()=>{
        await importUi(sourceZip.file);await writeFile(path.join(evidence,'migrated-newtab.png'),Buffer.from(await driver.takeScreenshot(),'base64'));
        await openProbe();const value=await run(snapshotState);assertPortable(value.portable,source.portable);
        assert.equal(value.local.step4Marker,'Firefox 迁移');assert.deepEqual(value.local.step4Seed,source.local.step4Seed);
        assert.deepEqual(value.private,original.private);assert.deepEqual(value.local.webdavConfig,original.local.webdavConfig);report.migrated=value;
    });
    await check('migrated Firefox data survives Chrome restart and remains usable offline',async()=>{
        await stopChrome();report.fourthProcess=await startChrome();assert.notEqual(report.fourthProcess,report.thirdProcess);
        await driver.get(base+'newtab.html');await driver.sendAndGetDevToolsCommand('Network.enable',{});
        await driver.sendAndGetDevToolsCommand('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
        try{
            await openNewtab();await driver.wait(async()=>await driver.executeScript('return [...document.querySelectorAll(".background-image.ready")].some(el=>el.style.backgroundImage.includes("blob:"));'),15000);
            await openProbe();const value=await run(snapshotState);assertPortable(value.portable,source.portable);
            assert.deepEqual(value.private,original.private);assert.deepEqual(value.local.webdavConfig,original.local.webdavConfig);report.migratedRestart=value;
        }finally{await driver.sendAndGetDevToolsCommand('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});}
    });
    await check('Chrome safety ZIP restores original settings, links and image bytes after migration',async()=>{
        await importUi(safetyZip.file);await openProbe();const value=await run(snapshotState);assertPreserved(value,original);report.rollback=value;
    });
    await check('second clean profile uses the same ID without inheriting another profile data',async()=>{
        await stopChrome();await startChrome(path.join(evidence,'second-chrome-profile'));
        assert.equal((await cdp.command('Extensions.loadUnpacked',{path:relocated})).id,identity.id);await openNewtab();await openProbe();
        assert.equal(await run('return (await chrome.storage.local.get("step4Marker")).step4Marker||null;'),null);
    });
    await check('earlier Chrome package without a key migrates by ZIP to the fixed ID',async()=>{
        const legacy=path.join(evidence,'legacy-without-key');await cp(report.chromePackage.directory,legacy,{recursive:true});
        const manifest=JSON.parse(await readFile(path.join(legacy,'manifest.json'),'utf8'));delete manifest.key;
        await writeFile(path.join(legacy,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');await writeFile(path.join(legacy,'lifecycle-probe.html'),probe);
        const {id}=await cdp.command('Extensions.loadUnpacked',{path:legacy});assert.notEqual(id,identity.id);
        const legacyBase='chrome-extension://'+id+'/';await driver.get(legacyBase+'newtab.html');
        await driver.wait(async()=>await driver.findElement(By.id('clock')).isDisplayed(),15000);
        await driver.get(legacyBase+'lifecycle-probe.html');await run(seedState,'旧 Chrome 无固定 ID');const before=await run(snapshotState);
        const zip=await downloadZip(driver,targetDownloads);report.legacyChromeZip=zip;report.legacyChromeId=id;
        await openProbe();const localBefore=await run('return chrome.storage.local.get(["emberSearchHistory","searchHistoryEnabled","searchSuggestionsEnabled","searchSuggestionSource"]);');
        const result=await run(`const {BackupManager}=await import('./scripts/platform/backup-manager.js');
            return new BackupManager().restoreFromBackup(new Blob([Uint8Array.from(atob(arguments[0]),c=>c.charCodeAt(0))],{type:'application/zip'}));`,(await readFile(zip.file)).toString('base64'));
        assert.equal(result.success,true);await openProbe();const migrated=await run(snapshotState);assertPortable(migrated.portable,before.portable);
        assert.equal(migrated.id,identity.id);assert.deepEqual(migrated.private,localBefore);
        assert.equal(await run('return Object.hasOwn(await chrome.storage.local.get("webdavConfig"),"webdavConfig");'),false);
        report.legacyChromeMigrated=migrated;
        await driver.get(legacyBase+'lifecycle-probe.html');const sourceAfter=await run(snapshotState);
        assertPortable(sourceAfter.portable,before.portable);assert.deepEqual(sourceAfter.private,before.private);
    });
    report.success=true;
}catch(error){report.success=false;report.error=String(error);process.exitCode=1;console.error('FAIL '+report.failedCheck+': '+report.error);}
finally{
    if(driver&&!report.success)await writeFile(path.join(evidence,'failure.png'),Buffer.from(await driver.takeScreenshot().catch(()=>''),'base64'));
    await stopChrome();await stopFirefox();report.finishedAt=new Date().toISOString();
    await writeFile(path.join(evidence,'report.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({report:path.join(evidence,'report.json'),success:report.success,checks:checks.length,chromeId:identity.id},null,2));
}
