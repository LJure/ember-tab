import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { unzipSync, strFromU8 } from '../scripts/libs/fflate.esm.js';

const root = fileURLToPath(new URL('../', import.meta.url));
test('Firefox package is reproducible, attributed and contains only runtime files', async () => {
    const upstreamBefore = await readFile(new URL('../manifest.json', import.meta.url), 'utf8');
    const build = () => JSON.parse(execFileSync(process.execPath, ['tools/build-firefox.mjs'], { cwd: root, encoding: 'utf8' }));
    const first = build();
    assert.throws(() => execFileSync(process.execPath, ['tools/build-firefox.mjs', '--release'], {
        cwd: root, encoding: 'utf8', stdio: 'pipe'
    }), /Release blocked/);
    const second = build();
    assert.equal(first.sha256, second.sha256);
    assert.equal(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'), upstreamBefore);
    const entries = unzipSync(new Uint8Array(await readFile(second.archive)));
    const manifest = JSON.parse(strFromU8(entries['manifest.json']));
    assert.equal(manifest.version, '0.1.0');
    assert.equal(manifest.browser_specific_settings.gecko.id, 'ember-tab@ljure.github.io');
    assert.equal(manifest.browser_specific_settings.gecko.strict_min_version, '140.0');
    assert.deepEqual(manifest.host_permissions, ['https://*/*']);
    assert.match(manifest.content_security_policy.extension_pages, /connect-src 'self' https: data: blob:;/);
    assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions.required,
        ['authenticationInfo', 'bookmarksInfo', 'browsingActivity', 'searchTerms', 'websiteContent']);
    assert.deepEqual(manifest.background, { scripts: ['background-worker.js'], type: 'module' });
    for (const unsupported of ['favicon', 'offscreen']) assert.ok(!manifest.permissions.includes(unsupported));
    assert.equal(manifest.minimum_chrome_version, undefined);
    assert.equal(manifest.offline_enabled, undefined);
    assert.equal(strFromU8(entries.LICENSE), await readFile(new URL('../LICENSE', import.meta.url), 'utf8'));
    assert.match(strFromU8(entries.NOTICE), /nil-byte/);
    assert.match(strFromU8(entries['privacy.html']), /WebDAV/);
    assert.match(strFromU8(entries['THIRD_PARTY_NOTICES.md']), /0\.8\.3/);
    for (const name of ['fflate', 'interactjs', 'sortablejs', 'heroicons']) {
        assert.match(strFromU8(entries[`licenses/${name}.txt`]), /Permission is hereby granted/);
    }
    for (const size of [16, 48, 128]) {
        const png = Buffer.from(entries[`assets/icons/icon${size}.png`]);
        assert.equal(png.readUInt32BE(16), size);
        assert.equal(png.readUInt32BE(20), size);
    }
    for (const locale of ['en', 'zh_CN', 'zh_TW']) {
        assert.equal(JSON.parse(strFromU8(entries[`_locales/${locale}/messages.json`])).extName.message, 'Ember Tab');
    }
    for (const name of Object.keys(entries)) {
        assert.match(name, /^(manifest\.json|newtab\.html|privacy\.html|background-worker\.js|LICENSE|NOTICE|THIRD_PARTY_NOTICES\.md|licenses\/|styles\/|scripts\/|_locales\/|assets\/(backgrounds\/|icons\/|changelog\.json))/);
        assert.ok(!name.split('/').includes('..'));
        assert.ok(!/node_modules|\.local\/|\.github\/|assets\/other\//.test(name));
    }
    assert.ok(entries[manifest.chrome_url_overrides.newtab]);
    assert.equal(strFromU8(entries['scripts/platform/favicon-runtime.js']),
        await readFile(new URL('../scripts/platform/favicon-runtime-firefox.js', import.meta.url), 'utf8'));
    assert.ok(!strFromU8(entries['scripts/platform/favicon-runtime.js']).includes('chrome.offscreen'));
    for (const script of manifest.background.scripts) assert.ok(entries[script]);
});
