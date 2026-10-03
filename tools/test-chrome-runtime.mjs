import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash, X509Certificate } from 'node:crypto';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Builder, By, logging } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import { buildExtension } from './build-extension.mjs';
import { searchFixture } from './chrome-search-fixture.mjs';
import { runChromeFeatures, runChromeBackup } from './test-chrome-features.mjs';
import { connectCdp, enableDeveloperMode } from './chrome-cdp.mjs';
import { testIconChooser } from './test-icon-chooser.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = path.join(root, '.local/chrome-runtime');
const evidence = path.join(runtime, 'run-' + Date.now());
await mkdir(evidence, { recursive: true });
const binary = process.env.CHROME_BINARY || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const driverPath = process.env.CHROMEDRIVER_BINARY || path.join(runtime, 'driver/chromedriver-win64/chromedriver.exe');
const extension = path.join(evidence, 'extension');
const profile = path.join(evidence, 'profile');
const checks = [];
const features = process.argv.includes('--features') || process.argv.includes('--features-only');
const report = { startedAt: new Date().toISOString(), binary, driverPath, evidence, isolatedProfile: profile, features, checks };
const requests = [];
const png = await readFile(path.join(root, 'assets/icons/icon128.png'));
const smallPng = await readFile(path.join(root, 'assets/icons/icon32.png'));
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192"><rect width="192" height="192" fill="#3366cc"/></svg>';
const server = createServer((req, res) => {
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    requests.push(pathname);
    res.setHeader('cache-control', 'no-store');
    const send = (type, body) => { res.setHeader('content-type', type); res.end(body); };
    if (pathname === '/choices') return send('text/html', '<link rel="icon" href="/choice-vector.svg"><link rel="icon" href="/choice-small.png"><link rel="icon" href="/declared.png">');
    if (pathname === '/choice-small.png') return send('image/png', smallPng);
    if (pathname === '/choice-vector.svg') return send('image/svg+xml', svg);
    if (pathname === '/declared') return send('text/html', '<link rel="icon" href="/declared.png" sizes="128x128"><link rel="icon" href="javascript:alert(1)">');
    if (pathname === '/large-declared') return send('text/html', '<link rel="icon" href="/declared.png" sizes="128x128">' + 'x'.repeat(700000));
    if (pathname === '/theme-declared') return send('text/html', '<link rel="icon" href="/declared.png" media="(prefers-color-scheme: light)"><link rel="icon" href="/manifest.svg" media="(prefers-color-scheme: dark)">');
    if (pathname === '/manifest-page') return send('text/html', '<link rel="manifest" href="/site.webmanifest">');
    if (pathname === '/site.webmanifest') return send('application/manifest+json', JSON.stringify({icons:[{src:'/manifest.svg',sizes:'192x192',purpose:'any'},{src:'/ignored.svg',sizes:'512x512',purpose:'monochrome'}]}));
    if (pathname === '/fallback') return send('text/html', '<title>Conventional favicon fixture</title>');
    if (pathname === '/manifest.svg') return send('image/svg+xml', svg);
    if (['/declared.png', '/favicon.png', '/custom.png'].includes(pathname)) return send('image/png', png);
    if (pathname === '/parallel.png') return setTimeout(() => send('image/png', png), 200);
    if (pathname === '/invalid.png') return send('image/png', 'not an image');
    if (pathname === '/oversized.png') return send('image/png', Buffer.alloc(512 * 1024 + 1));
    if (pathname === '/slow.png') {
        const timer = setTimeout(() => send('image/png', png), 4000);
        res.on('close', () => clearTimeout(timer));
        return;
    }
    res.statusCode = 404;
    res.end('not found');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
let driver, cdp;

async function check(name, task) {
    try { await task(); }
    catch (error) { report.failedCheck = name; throw error; }
    checks.push(name);
    console.log('PASS ' + name);
}
async function run(script, ...args) {
    const response = await driver.executeAsyncScript(`const done=arguments[arguments.length-1];
        Promise.resolve().then(async()=>{${script}}).then(value=>done({value}),error=>done({error:String(error),stack:error.stack}));`, ...args);
    if (response.error) throw new Error(response.error + '\n' + response.stack);
    return response.value;
}
const icon = (pathname, type = 'fetchIcon', customIcon = false) => run(
    'return chrome.runtime.sendMessage({type:arguments[0],url:arguments[1],customIcon:arguments[2]});', type, origin + pathname, customIcon);
const contexts = () => run('return chrome.runtime.getContexts({contextTypes:["OFFSCREEN_DOCUMENT"]});');
async function workerTarget() {
    return (await cdp.command('Target.getTargets')).targetInfos.find(target => target.type === 'service_worker' && target.url === report.extensionBase + 'background-worker.js');
}
let pageSession;
async function stopWorker() {
    const versions = cdp.events.filter(event => event.method === 'ServiceWorker.workerVersionUpdated')
        .flatMap(event => event.params.versions);
    const version = versions.findLast(value => value.scriptURL === report.extensionBase + 'background-worker.js' && value.runningStatus === 'running');
    assert.ok(version, 'Service worker version must be observed before stopping');
    await cdp.command('ServiceWorker.stopWorker', { versionId: version.versionId }, pageSession);
    await driver.wait(async () => !(await workerTarget()), 10000, 'Service worker should stop');
    return version.versionId;
}

try {
    // Isolate HTTP fixtures from the normal candidate output and restore that output immediately.
    const testPackage = await buildExtension('chrome', { testHttp: true });
    report.testPackageSha256 = testPackage.sha256;
    try {
        await cp(testPackage.directory, extension, { recursive: true });
        // A test-only extension page observes alarm broadcasts without wallpaper UI requests.
        await writeFile(path.join(extension, 'runtime-probe.html'), '<!doctype html><meta charset="utf-8"><title>Ember runtime probe</title>');
        if (features) {
            await writeFile(path.join(extension, 'search-test.js'), searchFixture);
            const html = await readFile(path.join(extension, 'newtab.html'), 'utf8');
            await writeFile(path.join(extension, 'newtab.html'), html.replace('<script src="scripts/boot/first-paint.js">', '<script src="search-test.js"></script><script src="scripts/boot/first-paint.js">'));
        }
    }
    finally { report.normalPackage = await buildExtension('chrome'); }
    const prefs = new logging.Preferences();
    prefs.setLevel(logging.Type.BROWSER, logging.Level.ALL);
    const options = new chrome.Options().setChromeBinaryPath(binary).setLoggingPrefs(prefs)
        .addArguments('--headless=new', '--no-first-run', '--no-default-browser-check', '--enable-unsafe-extension-debugging', '--user-data-dir=' + profile, '--window-size=1440,1000');
    if(features) {
        // Trust only the public test certificate in this isolated browser, never arbitrary sites.
        const certificate=new X509Certificate(await readFile(new URL('./fixtures/loopback-test.crt',import.meta.url)));
        const spki=createHash('sha256').update(certificate.publicKey.export({type:'spki',format:'der'})).digest('base64');
        options.addArguments('--ignore-certificate-errors-spki-list='+spki);
    }
    driver = await new Builder().forBrowser('chrome').setChromeOptions(options)
        .setChromeService(new chrome.ServiceBuilder(driverPath)).build();
    await driver.manage().setTimeouts({ script: 20000, pageLoad: 30000 });
    const caps = await driver.getCapabilities();
    report.browserVersion = caps.get('browserVersion');
    cdp = await connectCdp(caps.get('goog:chromeOptions').debuggerAddress);
    await enableDeveloperMode(driver);
    if (features) await cdp.command('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: evidence });
    const { id } = await cdp.command('Extensions.loadUnpacked', { path: extension });
    report.extensionId = id;
    report.extensionBase = 'chrome-extension://' + id + '/';
    await check('Chrome new-tab override opens Ember Tab', async () => {
        await driver.get('chrome://newtab/');
        await driver.wait(async () => (await driver.findElements(By.id('searchInput'))).length > 0, 10000);
        assert.equal(await run('return chrome.runtime.id;'), id);
        report.newtabNavigation = await driver.getCurrentUrl();
    });
    await driver.get(report.extensionBase + 'newtab.html');
    const pageTarget = (await cdp.command('Target.getTargets')).targetInfos.find(target => target.type === 'page' && target.url === report.extensionBase + 'newtab.html');
    ({ sessionId: pageSession } = await cdp.command('Target.attachToTarget', { targetId: pageTarget.targetId, flatten: true }));
    await cdp.command('ServiceWorker.enable', {}, pageSession);
    if (features) {
        cdp.onEvent('Fetch.requestPaused', event => {
            void cdp.command('Fetch.fulfillRequest', {
                requestId:event.params.requestId,responseCode:200,
                responseHeaders:[{name:'Content-Type',value:'image/png'}],body:png.toString('base64')
            },event.sessionId).catch(error=>{report.fixtureNetworkError=String(error);});
        });
        await cdp.command('Fetch.enable',{patterns:[
            {urlPattern:'https://w.wallhaven.cc/*'},
            {urlPattern:'https://www.bing.com/fixture-image.jpg'}
        ]},pageSession);
    }

    if (!process.argv.includes('--features-only')) {
    await check('new tab boot and first-install background defaults', async () => {
        await driver.wait(async () => /\d/.test(await driver.findElement(By.id('clock')).getText()), 10000);
        const values = await run('return {manifest:chrome.runtime.getManifest(),settings:(await chrome.storage.sync.get("backgroundSettings")).backgroundSettings};');
        assert.equal(values.manifest.name, 'Ember Tab');
        assert.equal(values.settings.type, 'files');
        assert.equal(values.settings.frequency, 'never');
        assert.ok(await workerTarget());
        await writeFile(path.join(evidence, 'newtab.png'), Buffer.from(await driver.takeScreenshot(), 'base64'));
    });
    await check('declared HTML favicon is parsed and decoded in offscreen document', async () => {
        const result = await icon('/declared', 'discoverIcon');
        assert.equal(result.success, true, result.error);
        assert.equal(result.meta.sourceKind, 'html-icon');
        assert.equal(result.meta.sourceUrl, origin + '/declared.png');
        assert.equal(result.meta.width, 128);
        assert.deepEqual(Buffer.from(result.data), png);
        assert.equal((await contexts()).length, 1);
    });
    await check('manifest SVG icons and monochrome exclusion', async () => {
        const result = await icon('/manifest-page', 'discoverIcon');
        assert.equal(result.success, true, result.error);
        assert.equal(result.meta.sourceKind, 'manifest');
        assert.equal(result.meta.sourceUrl, origin + '/manifest.svg');
        assert.equal(result.meta.width, 192);
        assert.equal(requests.includes('/ignored.svg'), false);
    });
    await check('oversized page preserves bounded declared favicon metadata', async () => {
        const result = await icon('/large-declared', 'discoverIcon');
        assert.equal(result.success, true, result.error);
        assert.equal(result.meta.sourceKind, 'html-icon');
        assert.equal(result.meta.sourceUrl, origin + '/declared.png');
        assert.equal(result.meta.width, 128);
    });
    await check('site favicon media follows the selected Ember theme', async () => {
        await run('await chrome.storage.sync.set({uiTheme:"light"});');
        assert.equal((await icon('/theme-declared', 'discoverIcon')).meta.sourceUrl, origin + '/declared.png');
        await run('await chrome.storage.sync.set({uiTheme:"dark"});');
        assert.equal((await icon('/theme-declared', 'discoverIcon')).meta.sourceUrl, origin + '/manifest.svg');
        await run('await chrome.storage.sync.set({uiTheme:"light"});');
    });
    await check('favicon fallback candidates and Chrome favicon endpoint', async () => {
        const result = await icon('/fallback', 'discoverIcon');
        assert.equal(result.success, true, result.error);
        assert.ok(['chrome', 'conventional'].includes(result.meta.sourceKind));
        assert.ok(result.meta.width >= 128 && result.meta.height >= 128, 'A 64px Chrome fallback must not mask an available 128px site icon');
        assert.ok(requests.includes('/favicon.png'));
        report.chromeFaviconResponse = await run(`const {chromeFaviconUrl}=await import('./scripts/platform/extension-urls.js');
            const response=await fetch(chromeFaviconUrl(arguments[0],64));
            const bytes=new Uint8Array(await response.arrayBuffer());
            return {status:response.status,headers:Array.from(response.headers.entries()),length:bytes.length,firstBytes:Array.from(bytes.slice(0,12))};`, origin + '/fallback');
        const own = await run(`const {chromeFaviconUrl}=await import('./scripts/platform/extension-urls.js');
            return chrome.runtime.sendMessage({type:'fetchIcon',url:chromeFaviconUrl(arguments[0],64)});`, origin + '/fallback');
        assert.equal(own.success, true, own.error);
        assert.ok(own.data.length);
    });
    await testIconChooser({ driver, run, check, origin, evidence });
    await check('custom icon fetching and cache survive page reload', async () => {
        const value = await run(`const {fetchIconBlobViaBackground}=await import('./scripts/platform/icon-fetch-bridge.js');
            const {iconCache}=await import('./scripts/platform/icon-cache.js');
            const blob=await fetchIconBlobViaBackground(arguments[0],{customIcon:true});
            if(!blob) throw new Error('Custom icon unavailable');
            return {saved:await iconCache.set('chrome-runtime-fixture',blob,arguments[0]),size:blob.size};`, origin + '/custom.png');
        assert.equal(value.saved, true);
        assert.equal(value.size, png.length);
        await driver.navigate().refresh();
        const cached = await run(`const {iconCache}=await import('./scripts/platform/icon-cache.js');
            const value=await iconCache.get('chrome-runtime-fixture');
            return {bytes:Array.from(new Uint8Array(await value.blob.arrayBuffer())),sourceUrl:value.sourceUrl};`);
        assert.deepEqual(Buffer.from(cached.bytes), png);
        assert.equal(cached.sourceUrl, origin + '/custom.png');
    });
    await check('invalid image, oversized image and timeout fail without blocking later work', async () => {
        assert.equal((await icon('/invalid.png')).success, false);
        assert.equal((await icon('/oversized.png')).error, 'Response too large');
        assert.equal((await icon('/slow.png')).error, 'Request timed out');
        assert.equal((await icon('/custom.png')).success, true);
    });
    await check('closed offscreen document is recreated on the next icon request', async () => {
        await run('await chrome.offscreen.closeDocument();');
        assert.equal((await contexts()).length, 0);
        const result = await icon('/custom.png');
        assert.equal(result.success, true, result.error);
        assert.equal((await contexts()).length, 1);
    });
    await check('multiple new-tab pages share one offscreen document and custom fetch', async () => {
        const handles = [await driver.getWindowHandle()];
        for (let i = 0; i < 3; i++) {
            await driver.switchTo().newWindow('tab');
            await driver.get(report.extensionBase + 'newtab.html');
            handles.push(await driver.getWindowHandle());
        }
        await run('await chrome.offscreen.closeDocument();');
        const before = requests.filter(value => value === '/parallel.png').length;
        const startAt = Date.now() + 1500;
        for (const handle of handles) {
            await driver.switchTo().window(handle);
            await driver.executeScript(`window.chromeFixtureResult=new Promise((resolve,reject)=>{
                setTimeout(()=>Promise.all(Array.from({length:8},()=>
                    chrome.runtime.sendMessage({type:'fetchIcon',customIcon:true,url:arguments[0]}))).then(resolve,reject),
                    Math.max(0,arguments[1]-Date.now()));
            });`, origin + '/parallel.png', startAt);
        }
        for (const handle of handles) {
            await driver.switchTo().window(handle);
            const results = await run('return await window.chromeFixtureResult;');
            assert.ok(results.every(result => result.success === true));
        }
        assert.equal((await contexts()).length, 1);
        report.parallelRequests = requests.filter(value => value === '/parallel.png').length - before;
        assert.equal(report.parallelRequests, 1, 'Concurrent custom requests across all pages should share one fetch');
        await driver.switchTo().window(handles[0]);
        for (const handle of handles.slice(1)) { await driver.switchTo().window(handle); await driver.close(); }
        await driver.switchTo().window(handles[0]);
    });
    await check('stopped service worker wakes on icon message with existing offscreen document', async () => {
        const before = (await contexts())[0].contextId;
        report.messageStoppedVersion = await stopWorker();
        assert.equal((await icon('/custom.png')).success, true);
        assert.equal((await contexts()).length, 1);
        assert.equal((await contexts())[0].contextId, before);
        assert.ok(await workerTarget());
    });
    await check('storage changes wake stopped worker and reschedule wallpaper alarm', async () => {
        report.storageStoppedVersion = await stopWorker();
        await run(`const {backgroundSettings}=await chrome.storage.sync.get('backgroundSettings');
            await chrome.storage.sync.set({backgroundSettings:{...backgroundSettings,type:'pexels',frequency:'hour'}});`);
        await driver.wait(async () => (await run('return await chrome.alarms.get("refreshBackground");'))?.periodInMinutes === 60, 10000);
        assert.ok(await workerTarget());
        await run(`const {backgroundSettings}=await chrome.storage.sync.get('backgroundSettings');
            await chrome.storage.sync.set({backgroundSettings:{...backgroundSettings,type:'files',frequency:'never'}});`);
        await driver.wait(async () => !(await run('return await chrome.alarms.get("refreshBackground");')), 10000);
    });
    await check('alarm wakes stopped worker and broadcasts refresh to an extension page', async () => {
        await driver.get(report.extensionBase + 'runtime-probe.html');
        await run(`window.chromeFixtureAlarmReceived=false;
            chrome.runtime.onMessage.addListener(message=>{if(message.type==='refreshBackground')window.chromeFixtureAlarmReceived=true;});
            const {backgroundSettings}=await chrome.storage.sync.get('backgroundSettings');
            await chrome.storage.sync.set({backgroundSettings:{...backgroundSettings,type:'pexels',frequency:'hour'}});`);
        await driver.wait(async () => (await run('return await chrome.alarms.get("refreshBackground");'))?.periodInMinutes === 60, 10000);
        await run('await chrome.alarms.create("refreshBackground",{when:Date.now()+4000});');
        report.alarmStoppedVersion = await stopWorker();
        await driver.wait(async () => await driver.executeScript('return window.chromeFixtureAlarmReceived;'), 15000);
        assert.ok(await workerTarget());
        await run(`const {backgroundSettings}=await chrome.storage.sync.get('backgroundSettings');
            await chrome.storage.sync.set({backgroundSettings:{...backgroundSettings,type:'files',frequency:'never'}});`);
    });
    }
    if (features && process.argv.includes('--backup-only')) {
        await cdp.command('Fetch.disable',{},pageSession);
        await driver.get(report.extensionBase+'runtime-probe.html');
        await runChromeBackup({driver,run,check,evidence,report});
    } else if (features) await runChromeFeatures({driver,run,check,evidence,report,origin});
    await check('normal candidate loads with HTTPS-only policy', async () => {
        await cdp.command('Extensions.uninstall', { id: report.extensionId });
        const normal = await cdp.command('Extensions.loadUnpacked', { path: path.join(root, 'dist/chrome') });
        report.normalExtensionId = normal.id;
        await driver.get('chrome-extension://' + normal.id + '/newtab.html');
        const manifest = await run('return chrome.runtime.getManifest();');
        assert.deepEqual(manifest.host_permissions, ['https://*/*']);
        assert.equal((await icon('/custom.png')).success, false);
        const invalid = await run('return chrome.runtime.sendMessage({type:"fetchIcon",url:"file:///invalid"});');
        assert.equal(invalid.error, 'Unsupported URL protocol');
        const offscreen = await run(`const {runFaviconDomTask}=await import('./scripts/platform/favicon-runtime.js');
            return runFaviconDomTask({type:'faviconOffscreenParsePage',html:'<link rel="icon" href="/test.png">',pageUrl:'https://example.invalid/'});`);
        assert.equal(offscreen.candidates[0].url, 'https://example.invalid/test.png');
    });
    report.success = true;
} catch (error) {
    report.success = false;
    report.error = String(error);
    process.exitCode = 1;
    console.error('FAIL ' + report.failedCheck + ': ' + report.error);
} finally {
    report.requests = requests;
    report.finishedAt = new Date().toISOString();
    if (driver) {
        report.browserLogs = (await driver.manage().logs().get(logging.Type.BROWSER).catch(() => [])).map(entry => ({ level: entry.level.name, message: entry.message }));
        if (!report.success) await writeFile(path.join(evidence, 'failure.png'), Buffer.from(await driver.takeScreenshot().catch(() => ''), 'base64'));
    }
    cdp?.close();
    await driver?.quit();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await writeFile(path.join(evidence, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ report: path.join(evidence, 'report.json'), success: report.success, checks: checks.length, packageSha256: report.normalPackage?.sha256, fixturePngSha256:createHash('sha256').update(png).digest('hex') }, null, 2));
}
