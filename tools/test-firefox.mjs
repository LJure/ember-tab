import assert from 'node:assert/strict';
import { openSync, closeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Builder, By, Key } from 'selenium-webdriver';
import firefox from 'selenium-webdriver/firefox.js';
import { download } from 'geckodriver';
import { execFileSync } from 'node:child_process';
import { unzipSync, zipSync, strToU8 } from '../scripts/libs/fflate.esm.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const includeM3 = process.argv.includes('--m3');
const includeM4 = process.argv.includes('--m4');
const evidence = path.join(root, '.local', includeM4 ? 'm4' : includeM3 ? 'm3' : 'm2');
await mkdir(evidence, { recursive: true });
const project = JSON.parse(await readFile(path.join(root, 'ember.project.json'), 'utf8'));
const manifest = JSON.parse(await readFile(path.join(root, 'dist/firefox/manifest.json'), 'utf8'));
const uuid = '32d367b4-bf14-42d1-b7a9-2aa83f1d80e9';
const driverPath = await download('0.36.0', path.join(root, '.local', 'drivers'));
const options = new firefox.Options()
    .addArguments('-headless', '-remote-allow-system-access')
    .setPreference('extensions.webextensions.uuids', JSON.stringify({ [project.geckoId]: uuid }))
    .setPreference('messaging-system.rsexperimentloader.enabled', false)
    .setPreference('app.shield.optoutstudies.enabled', false)
    .setPreference('browser.newtabpage.activity-stream.asrouter.userprefs.cfr.addons', false);
if (process.env.FIREFOX_BINARY) options.setBinary(process.env.FIREFOX_BINARY);
if (includeM4) {
    options.setPreference('browser.download.folderList', 2)
        .setPreference('browser.download.dir', evidence)
        .setPreference('browser.helperApps.neverAsk.saveToDisk', 'application/zip')
        .setPreference('browser.download.alwaysOpenPanel', false);
}
// Selenium creates a disposable profile. Never attach to the user's Firefox.
const logFd = openSync(path.join(evidence, 'geckodriver.log'), 'w');
const driver = await new Builder().forBrowser('firefox').setFirefoxOptions(options)
    .setFirefoxService(new firefox.ServiceBuilder(driverPath).enableVerboseLogging()
        .setStdio(['ignore', logFd, logFd])).build();
const checks = [];
const report = { startedAt: new Date().toISOString(), checks };
report.packageSha256 = createHash('sha256').update(await readFile(path.join(root, `dist/ember-tab-${manifest.version}-firefox.zip`))).digest('hex');
let installPath=path.join(root, `dist/ember-tab-${manifest.version}-firefox.zip`);
if(includeM4) {
    // Test-only upstream exporter, never shipped in the development package.
    const entries=unzipSync(await readFile(installPath));
    entries['scripts/platform/backup-manager-upstream.js']=strToU8(execFileSync('git',
        ['show',`${project.upstreamCommit}:scripts/platform/backup-manager.js`],{cwd:root,encoding:'utf8'}));
    installPath=path.join(evidence,'test-with-upstream-exporter.zip');
    await writeFile(installPath,zipSync(entries));
    report.testFixture='Unmodified upstream exporter module in a Firefox test package; not a Chrome-origin export';
}
async function check(name, task) {
    try { await task(); }
    catch (error) { report.failedCheck = name; throw error; }
    checks.push(name);
    console.log(`PASS ${name}`);
}
async function runInExtension(script, ...args) {
    return driver.executeAsyncScript(`const done = arguments[arguments.length - 1];
        Promise.resolve().then(async () => { ${script} })
        .then(value => done({ value }), error => done({ error: String(error), stack: error.stack }));`, ...args)
        .then(result => { if (result.error) throw new Error(result.error + '\n' + result.stack); return result.value; });
}
async function suspendBackground() {
    // Test-only Firefox API: use the real event-page shutdown path, not a mock.
    await driver.setContext(firefox.Context.CHROME);
    const state = await runInExtension(`const ext = WebExtensionPolicy.getByID(arguments[0]).extension;
        await ext.terminateBackground({disableResetIdleForTest:true}); return ext.backgroundState;`, project.geckoId);
    assert.equal(state, 'stopped');
    await driver.setContext(firefox.Context.CONTENT);
}
try {
    report.browserVersion = (await driver.getCapabilities()).get('browserVersion');
    await driver.manage().setTimeouts({ script: 15000, pageLoad: 30000 });
    await driver.manage().window().setRect({ width: 1440, height: 1000 });
    await check('temporary installation and fixed Gecko ID', async () => {
        assert.equal(await driver.installAddon(installPath, true), project.geckoId);
    });
    await driver.setContext(firefox.Context.CHROME);
    await driver.executeScript('BrowserCommands.openTab();');
    await driver.setContext(firefox.Context.CONTENT);
    await driver.switchTo().window((await driver.getAllWindowHandles()).at(-1));
    await driver.wait(async () => (await driver.getCurrentUrl()).startsWith(`moz-extension://${uuid}/`), 10000);
    await check('new tab boot, localized search and clock', async () => {
        await driver.wait(async () => (await driver.findElement(By.id('searchInput')).getAttribute('placeholder')).length > 0, 15000);
        assert.match(await driver.findElement(By.id('clock')).getText(), /\d/);
        assert.equal(await runInExtension('return browser.runtime.getManifest().version'), manifest.version);
        assert.equal(await runInExtension('return browser.runtime.getManifest().name'), project.name);
    });
    await check('first-install background defaults', async () => {
        const defaults = await runInExtension('return (await chrome.storage.sync.get("backgroundSettings")).backgroundSettings');
        assert.equal(defaults.type, 'files');
        assert.equal(defaults.frequency, 'never');
    });
    await check('asynchronous background message reply', async () => {
        const result = await runInExtension('return await chrome.runtime.sendMessage({type:"fetchIcon", url:"file:///invalid"})');
        assert.equal(result.success, false);
        assert.ok(result.error);
    });
    await check('settings UI language and theme changes', async () => {
        await driver.findElement(By.id('settingsBtn')).click();
        await driver.wait(async () => (await driver.findElements(By.id('macInterfaceLanguage'))).length > 0, 10000);
        await driver.wait(async () => await driver.executeScript(`const el=document.getElementById('macSettingsOverlay');
            return getComputedStyle(el).opacity==='1' && !el.getAnimations({subtree:true}).some(a=>a.playState==='running' && a.effect.getComputedTiming().iterations!==Infinity);`),5000);
        await driver.findElement(By.id('macInterfaceLanguage')).sendKeys(Key.END);
        await driver.wait(async () => (await driver.findElement(By.css('html')).getAttribute('lang')) === 'en', 5000);
        await driver.findElement(By.css('[data-menu="appearance"]')).click();
        await driver.wait(async () => (await driver.findElements(By.id('macThemeDark'))).length > 0, 5000);
        await driver.findElement(By.css('label:has(#macThemeDark)')).click();
        await driver.wait(async () => (await driver.findElement(By.css('html')).getAttribute('data-theme')) === 'dark', 5000);
        const settings = await runInExtension('return await chrome.storage.sync.get(["uiTheme","interfaceLanguage"])');
        assert.deepEqual(settings, { uiTheme: 'dark', interfaceLanguage: 'en' });
        await driver.findElement(By.id('macSettingsClose')).click();
    });
    await check('settings survive page reload; local and session Promise APIs', async () => {
        await runInExtension('await chrome.storage.local.set({m2Local:"local"}); await chrome.storage.session.set({m2Session:"session"});');
        await driver.navigate().refresh();
        await driver.wait(async () => (await driver.findElement(By.css('html')).getAttribute('data-theme')) === 'dark', 10000);
        assert.equal(await driver.findElement(By.css('html')).getAttribute('lang'), 'en');
        assert.equal(await driver.findElement(By.id('searchInput')).getAttribute('placeholder'), 'Search');
        assert.equal(await runInExtension('return (await chrome.storage.local.get("m2Local")).m2Local'), 'local');
        assert.equal(await runInExtension('return (await chrome.storage.session.get("m2Session")).m2Session'), 'session');
    });
    await check('message wakes suspended module event page', async () => {
        await suspendBackground();
        const result = await runInExtension('return await chrome.runtime.sendMessage({type:"fetchIcon", url:"file:///invalid"})');
        assert.equal(result.success, false);
        assert.equal(result.error, 'Unsupported URL protocol');
    });
    await check('storage event wakes background and creates hourly alarm', async () => {
        await suspendBackground();
        await runInExtension(`const {backgroundSettings} = await chrome.storage.sync.get('backgroundSettings');
            await chrome.storage.sync.set({backgroundSettings:{...backgroundSettings,type:'unsplash',frequency:'hour'}});`);
        await driver.wait(async () => (await runInExtension('return await chrome.alarms.get("refreshBackground")'))?.periodInMinutes === 60, 10000);
    });
    await check('alarm wakes suspended background and broadcasts refresh', async () => {
        await runInExtension(`window.m2AlarmReceived = false;
            browser.runtime.onMessage.addListener(message => { if (message.type === 'refreshBackground') window.m2AlarmReceived = true; });
            await chrome.alarms.create('refreshBackground', {when:Date.now()+3000});`);
        await suspendBackground();
        await driver.wait(async () => await driver.executeScript('return window.m2AlarmReceived === true'), 10000);
        await runInExtension(`const {backgroundSettings} = await chrome.storage.sync.get('backgroundSettings');
            await chrome.storage.sync.set({backgroundSettings:{...backgroundSettings,type:'files',frequency:'never'}});`);
        await driver.wait(async () => !(await runInExtension('return await chrome.alarms.get("refreshBackground")')), 10000);
    });
    await check('extension reload preserves settings and restores handlers', async () => {
        await driver.setContext(firefox.Context.CHROME);
        await runInExtension(`const {AddonManager} = ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
            const addon = await AddonManager.getAddonByID(arguments[0]); await addon.reload();`, project.geckoId);
        await driver.executeScript('BrowserCommands.openTab();');
        await driver.setContext(firefox.Context.CONTENT);
        await driver.switchTo().window((await driver.getAllWindowHandles()).at(-1));
        await driver.wait(async () => (await driver.findElement(By.css('html')).getAttribute('data-theme')) === 'dark', 10000);
        assert.equal(await driver.findElement(By.css('html')).getAttribute('lang'), 'en');
        assert.equal(await runInExtension('return (await chrome.storage.local.get("m2Local")).m2Local'), 'local');
        assert.equal((await runInExtension('return await chrome.runtime.sendMessage({type:"fetchIcon",url:"file:///invalid"})')).success, false);
    });
    if (includeM3) {
        const { runM3Tests } = await import('./test-firefox-m3.mjs');
        await runM3Tests({driver, check, runInExtension, root, evidence, uuid, report});
    }
    if(includeM4) {
        const {runM4Tests}=await import('./test-firefox-m4.mjs');
        await runM4Tests({driver,check,runInExtension,root,evidence,uuid,report,project,installPath});
    }
    await writeFile(path.join(evidence, 'newtab.png'), await driver.takeScreenshot(), 'base64');
    await driver.setContext(firefox.Context.CHROME);
    report.extensionDiagnostics = await driver.executeScript(`return Services.console.getMessageArray()
        .filter(entry => entry.message?.includes(arguments[0]) || entry.sourceName?.includes(arguments[0]))
        .map(entry => ({message:entry.message, source:entry.sourceName, line:entry.lineNumber}));`, uuid);
    await driver.setContext(firefox.Context.CONTENT);
    report.status = 'passed';
} catch (error) {
    report.status = 'failed';
    report.error = error.stack;
    try { await writeFile(path.join(evidence, 'failure.png'), await driver.takeScreenshot(), 'base64'); } catch { /* page may have unloaded */ }
    throw error;
} finally {
    await writeFile(path.join(evidence, 'firefox-smoke.json'), JSON.stringify(report, null, 2) + '\n');
    // Firefox 156's experiment loader can block shutdown while waiting on its
    // remote service. Stop that unrelated loader only in this disposable profile.
    await driver.setContext(firefox.Context.CHROME).then(() =>
        driver.executeScript(`ChromeUtils.importESModule('resource://nimbus/ExperimentAPI.sys.mjs')
            .ExperimentAPI._rsLoader.disable();`)).catch(() => {});
    try {
        await driver.quit();
    } catch (error) {
        report.status = 'failed';
        report.cleanupError = error.stack;
        process.exitCode = 1;
    } finally {
        closeSync(logFd);
        report.finishedAt = new Date().toISOString();
        await writeFile(path.join(evidence, 'firefox-smoke.json'), JSON.stringify(report, null, 2) + '\n');
    }
}
