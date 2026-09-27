import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {Builder} from 'selenium-webdriver';
import firefox from 'selenium-webdriver/firefox.js';
import {download} from 'geckodriver';
import {unzipSync,zipSync,strFromU8,strToU8} from '../scripts/libs/fflate.esm.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const evidence=path.join(root,'.local','m4');await mkdir(evidence,{recursive:true});
const profile=path.join(evidence,'restart-profile-'+Date.now());await mkdir(profile);
const project=JSON.parse(await readFile(path.join(root,'ember.project.json'),'utf8'));
const uuid='32d367b4-bf14-42d1-b7a9-2aa83f1d80e9';
await writeFile(path.join(profile,'user.js'),[
    ['extensions.webextensions.uuids',JSON.stringify({[project.geckoId]:uuid})],
    ['messaging-system.rsexperimentloader.enabled',false],['app.shield.optoutstudies.enabled',false]
].map(([k,v])=>`user_pref(${JSON.stringify(k)},${JSON.stringify(v)});`).join('\n'));
const binary=process.env.FIREFOX_BINARY;
const gecko=await download('0.36.0',path.join(root,'.local','drivers'));
const original=path.join(root,`dist/ember-tab-${project.initialVersion}-firefox.zip`);
const originalBytes=await readFile(original);
const entries=unzipSync(originalBytes);const manifest=JSON.parse(strFromU8(entries['manifest.json']));
manifest.version='0.1.1';entries['manifest.json']=strToU8(JSON.stringify(manifest));
const upgraded=path.join(evidence,'test-upgrade-0.1.1.zip');await writeFile(upgraded,zipSync(entries));
const report={profile,testOnlyVersion:'0.1.1',packageSha256:createHash('sha256').update(originalBytes).digest('hex'),startedAt:new Date().toISOString()};
let driver;
const run=async(script,...args)=>{
    const result=await driver.executeAsyncScript(`const done=arguments[arguments.length-1];Promise.resolve().then(async()=>{${script}}).then(value=>done({value}),error=>done({error:String(error)}));`,...args);
    if(result.error)throw new Error(result.error);return result.value;
};
const start=async()=>{
    const options=new firefox.Options().addArguments('-headless','-remote-allow-system-access','-profile',profile);
    if(binary)options.setBinary(binary);
    driver=await new Builder().forBrowser('firefox').setFirefoxOptions(options).setFirefoxService(new firefox.ServiceBuilder(gecko)).build();
    await driver.manage().setTimeouts({script:30000});
    return (await driver.getCapabilities()).get('moz:processID');
};
const open=async()=>{
    await driver.setContext(firefox.Context.CHROME);await driver.executeScript('BrowserCommands.openTab();');
    await driver.setContext(firefox.Context.CONTENT);await driver.switchTo().window((await driver.getAllWindowHandles()).at(-1));
    await driver.wait(async()=> (await driver.getCurrentUrl()).startsWith('moz-extension:'),10000);
};
const stop=async()=>{
    if(!driver)return;
    await driver.setContext(firefox.Context.CHROME).then(()=>driver.executeScript(`ChromeUtils.importESModule('resource://nimbus/ExperimentAPI.sys.mjs').ExperimentAPI._rsLoader.disable();`)).catch(()=>{});
    await driver.quit();driver=null;
};
const read=()=>run(`const {BackupManager}=await import('./scripts/platform/backup-manager.js');
    const db=await new BackupManager()._openDatabase('aura-tab-assets',1,'images');
    const value=await new Promise((r,j)=>{const q=db.transaction('images').objectStore('images').get('m4-restart');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});db.close();
    return {marker:(await chrome.storage.local.get('m4Restart')).m4Restart,blob:value?await value.fullBlob.text():null,version:chrome.runtime.getManifest().version};`);
try {
    report.firstProcess=await start();await driver.installAddon(original,true);await open();
    await run(`await chrome.storage.local.set({m4Restart:'persisted'});
        const {BackupManager}=await import('./scripts/platform/backup-manager.js');const db=await new BackupManager()._openDatabase('aura-tab-assets',1,'images');
        await new Promise((r,j)=>{const tx=db.transaction('images','readwrite');tx.oncomplete=r;tx.onerror=()=>j(tx.error);tx.objectStore('images').put({id:'m4-restart',fullBlob:new Blob(['restart-image-bytes']),isUserPinned:true});});db.close();`);
    await driver.switchTo().newWindow('tab');await driver.installAddon(upgraded,true);await open();
    report.upgrade=await read();assert.equal(report.upgrade.marker,'persisted');assert.equal(report.upgrade.blob,'restart-image-bytes');assert.equal(report.upgrade.version,'0.1.1');
    await stop();report.secondProcess=await start();assert.notEqual(report.secondProcess,report.firstProcess);
    await driver.installAddon(upgraded,true);await open();report.restart=await read();
    report.restartDataPreserved=report.restart.marker==='persisted'&&report.restart.blob==='restart-image-bytes';
    report.status=report.restartDataPreserved?'passed':'temporary-addon-data-not-preserved';
    assert.equal(report.restartDataPreserved,true,'Restart must preserve storage and image bytes');
    console.log(JSON.stringify(report,null,2));
} catch(error) {report.status='failed';report.error=String(error);throw error;}
finally {await stop();report.finishedAt=new Date().toISOString();await writeFile(path.join(evidence,'lifecycle.json'),JSON.stringify(report,null,2)+'\n');}
