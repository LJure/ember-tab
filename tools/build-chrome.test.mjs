import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { unzipSync, strFromU8 } from '../scripts/libs/fflate.esm.js';
import { buildExtension } from './build-extension.mjs';
import { chromeIdentity } from './chrome-identity.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const build = (browser, ...args) => JSON.parse(execFileSync(process.execPath,
    [`tools/build-${browser}.mjs`, ...args], { cwd: root, encoding: 'utf8' }));
const unpack = async archive => unzipSync(new Uint8Array(await readFile(archive)));

test('Chrome package has complete runtime files, is reproducible and preserves Firefox output', async () => {
    const sourceBefore = await readFile(new URL('../manifest.json', import.meta.url), 'utf8');
    const firefox = build('firefox');
    const firefoxArchive = await readFile(firefox.archive);
    const firefoxManifest = await readFile(new URL('../dist/firefox/manifest.json', import.meta.url));
    const project = JSON.parse(await readFile(new URL('../ember.project.json', import.meta.url), 'utf8'));
    const first = build('chrome');
    const second = build('chrome');
    assert.equal(first.sha256, second.sha256);
    assert.equal(second.sha256, createHash('sha256').update(await readFile(second.archive)).digest('hex'));
    assert.equal(await readFile(second.archive + '.sha256', 'utf8'),
        `${second.sha256}  ember-tab-${project.currentVersion}-chrome.zip\n`);
    assert.equal(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'), sourceBefore);
    assert.deepEqual(await readFile(firefox.archive), firefoxArchive);
    assert.deepEqual(await readFile(new URL('../dist/firefox/manifest.json', import.meta.url)), firefoxManifest);

    const entries = await unpack(second.archive);
    const manifest = JSON.parse(strFromU8(entries['manifest.json']));
    assert.equal(manifest.manifest_version, 3);
    assert.equal(manifest.version, project.currentVersion);
    assert.equal(manifest.key, project.chromePublicKey);
    assert.equal(chromeIdentity(project).id, project.chromeId);
    assert.equal(manifest.minimum_chrome_version, project.minimumChromeVersion);
    assert.ok(Number(manifest.minimum_chrome_version) >= 116);
    assert.equal(manifest.browser_specific_settings, undefined);
    assert.deepEqual(manifest.background, { service_worker: 'background-worker.js', type: 'module' });
    for (const permission of ['favicon', 'offscreen']) assert.ok(manifest.permissions.includes(permission));
    assert.deepEqual(manifest.host_permissions, ['https://*/*']);
    assert.match(manifest.content_security_policy.extension_pages, /connect-src 'self' https: data: blob:;/);
    assert.equal(strFromU8(entries['scripts/platform/favicon-runtime.js']),
        await readFile(new URL('../scripts/platform/favicon-runtime.js', import.meta.url), 'utf8'));
    assert.match(strFromU8(entries['scripts/platform/favicon-runtime.js']), /chrome\.offscreen/);
    assert.ok(entries[manifest.background.service_worker]);
    assert.ok(entries[manifest.chrome_url_overrides.newtab]);
    // Check actual HTML dependencies, including Chrome's previously omitted offscreen page.
    for (const html of ['newtab.html', 'favicon-offscreen.html']) {
        assert.ok(entries[html]);
        const references = [...strFromU8(entries[html]).matchAll(/(?:src|href)="([^"]+)"/g)];
        for (const [, reference] of references) {
            if (/^(?:[a-z]+:|#)/i.test(reference)) continue;
            const name = reference.replace(/^\.\//, '').split(/[?#]/)[0];
            assert.ok(entries[name], `${html} references missing ${name}`);
        }
    }
    assert.ok(entries['scripts/platform/favicon-offscreen.js']);
    assert.ok(entries['scripts/platform/favicon-dom.js']);
    assert.equal(strFromU8(entries.LICENSE), await readFile(new URL('../LICENSE', import.meta.url), 'utf8'));
    assert.match(strFromU8(entries.NOTICE), /independent Chrome port.*nil-byte/);
    assert.ok(entries['THIRD_PARTY_NOTICES.md']);
    const privacy = strFromU8(entries['privacy.html']);
    assert.match(privacy, /Chrome Sync/);
    assert.match(privacy, /Chrome's default search/);
    assert.match(privacy, new RegExp('Ember Tab ' + project.currentVersion.replaceAll('.', '\\.')));
    assert.match(privacy, /Chrome and Firefox use separate extension storage/);
    assert.ok(!privacy.includes('140+') && !privacy.includes('Chrome 140') && !privacy.includes('Firefox Sync'));
    assert.match(privacy, /Chrome 的扩展权限提示不代表每项功能已开启/);
    for (const name of ['fflate', 'interactjs', 'sortablejs', 'heroicons']) {
        assert.match(strFromU8(entries[`licenses/${name}.txt`]), /Permission is hereby granted/);
    }
    for (const locale of ['en', 'zh_CN', 'zh_TW']) {
        const messages = JSON.parse(strFromU8(entries[`_locales/${locale}/messages.json`]));
        assert.equal(messages.extName.message, 'Ember Tab');
        assert.match(messages.extDescription.message, /Chrome/);
        assert.ok(messages.extDescription.message.length <= 132);
        const ui = JSON.parse(strFromU8(entries[`scripts/platform/locales/${locale}.json`]));
        assert.match(ui.emberAttribution, /Chrome/);
        assert.ok(!ui.emberAttribution.includes('Firefox') && !ui.settingsSearchConsentRequired.includes('Firefox'));
    }
    const firefoxEntries = unzipSync(firefoxArchive);
    assert.equal(JSON.parse(strFromU8(firefoxEntries['manifest.json'])).key, undefined);
    assert.match(strFromU8(firefoxEntries['privacy.html']), /Firefox 140\+/);
    assert.match(JSON.parse(strFromU8(firefoxEntries['scripts/platform/locales/en.json'])).emberAttribution, /Firefox/);
    for (const name of Object.keys(entries)) {
        assert.match(name, /^(manifest\.json|newtab\.html|favicon-offscreen\.html|privacy\.html|background-worker\.js|LICENSE|NOTICE|THIRD_PARTY_NOTICES\.md|licenses\/|styles\/|scripts\/|_locales\/|assets\/(backgrounds\/|icons\/|changelog\.json))/);
        assert.ok(!name.split('/').includes('..'));
        assert.ok(!/node_modules|\.local\/|\.github\/|assets\/other\//.test(name));
    }
    await assert.rejects(buildExtension('../chrome'), /Unsupported build target/);
    assert.deepEqual(await readFile(firefox.archive), firefoxArchive);
    assert.equal((await buildExtension('chrome')).sha256, first.sha256);
});

test('Chrome HTTP test package opens only loopback and keeps the normal archive intact', async () => {
    const normal = build('chrome');
    const normalBytes = await readFile(normal.archive);
    try {
        const http = build('chrome', '--test-http');
        assert.match(http.archive, /-chrome-test-http\.zip$/);
        const entries = await unpack(http.archive);
        const manifest = JSON.parse(strFromU8(entries['manifest.json']));
        assert.equal(manifest.key, JSON.parse(strFromU8((await unpack(normal.archive))['manifest.json'])).key);
        assert.deepEqual(manifest.host_permissions, ['https://*/*', 'http://127.0.0.1/*', 'http://localhost/*']);
        assert.match(manifest.content_security_policy.extension_pages, /http:\/\/127\.0\.0\.1:\* http:\/\/localhost:\*/);
        assert.deepEqual(await readFile(normal.archive), normalBytes);
    } finally {
        assert.equal(build('chrome').sha256, normal.sha256);
    }
});

test('Chrome identity rejects missing, malformed and mismatched public key configuration', async () => {
    const project=JSON.parse(await readFile(new URL('../ember.project.json',import.meta.url),'utf8'));
    assert.throws(()=>chromeIdentity({...project,chromePublicKey:undefined}),/public key/);
    assert.throws(()=>chromeIdentity({...project,chromePublicKey:project.chromePublicKey+'\n'}),/canonical base64/);
    assert.throws(()=>chromeIdentity({...project,chromeId:'a'.repeat(32)}),/ID does not match/);
});
