import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { zipSync } from '../scripts/libs/fflate.esm.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const output = path.join(dist, 'firefox');
const project = JSON.parse(await readFile(path.join(root, 'ember.project.json'), 'utf8'));
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
if (process.argv.includes('--release') && project.releaseBlockers?.length) {
    throw new Error('Release blocked:\n- ' + project.releaseBlockers.join('\n- '));
}

// Only clean the fixed generated directory; never accept a caller-supplied path.
if (path.dirname(output) !== dist || path.dirname(dist) !== path.resolve(root)) {
    throw new Error('Build output must stay inside the project dist directory');
}
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

// Runtime allowlist: keep development files and local browser data out of the ZIP.
for (const entry of [
    'newtab.html', 'privacy.html', 'background-worker.js', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'licenses', 'styles', 'scripts', '_locales',
    'assets/backgrounds', 'assets/icons', 'assets/changelog.json'
]) {
    await cp(path.join(root, entry), path.join(output, entry), {
        recursive: true,
        filter: (source) => path.basename(source) !== '.DS_Store'
    });
}

// Replace the Chromium offscreen adapter with Firefox's DOM event-page adapter.
await cp(path.join(root, 'scripts/platform/favicon-runtime-firefox.js'),
    path.join(output, 'scripts/platform/favicon-runtime.js'));

delete manifest.minimum_chrome_version;
delete manifest.offline_enabled;
manifest.version = project.initialVersion;
manifest.permissions = manifest.permissions.filter(p => !['favicon', 'offscreen'].includes(p));
manifest.background = { scripts: ['background-worker.js'], type: 'module' };
manifest.browser_specific_settings = {
    gecko: {
        id: project.geckoId, strict_min_version: project.minimumFirefoxVersion,
        data_collection_permissions: {
            required: ['authenticationInfo', 'bookmarksInfo', 'browsingActivity', 'searchTerms', 'websiteContent']
        }
    }
};
// Network features accept arbitrary HTTPS servers, but not plaintext remote data.
// Loopback is available only in an explicitly generated local integration-test build.
const testHttp = process.argv.includes('--test-http');
manifest.host_permissions = ['https://*/*', ...(testHttp ? ['http://127.0.0.1/*', 'http://localhost/*'] : [])];
manifest.content_security_policy.extension_pages = "script-src 'self'; object-src 'none'; img-src 'self' data: blob: https:; connect-src 'self' https: data: blob:" +
    (testHttp ? ' http://127.0.0.1:* http://localhost:*' : '') + ';';
await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

const descriptions = {
    en: 'A customizable new tab for Firefox. An independent port of Aura Tab by nil-byte.',
    zh_CN: '可自定义的 Firefox 新标签页。基于 nil-byte 的 Aura Tab 开发的独立移植版。',
    zh_TW: '可自訂的 Firefox 新分頁。基於 nil-byte 的 Aura Tab 開發的獨立移植版。'
};
for (const [locale, description] of Object.entries(descriptions)) {
    const target = path.join(output, '_locales', locale, 'messages.json');
    const messages = JSON.parse(await readFile(target, 'utf8'));
    messages.extName.message = project.name;
    messages.extDescription.message = description;
    await writeFile(target, JSON.stringify(messages, null, 2) + '\n');
}
await writeFile(path.join(output, 'NOTICE'),
    'Ember Tab is an independent Firefox port of Aura Tab by nil-byte.\n' +
    `Upstream: ${project.upstream}\nBaseline: ${project.upstreamCommit}\n` +
    `Port: ${project.repository}\nThe upstream MIT license is preserved in LICENSE.\n`);

const files = {};
async function collect(directory, prefix = '') {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
        const name = prefix + entry.name;
        const source = path.join(directory, entry.name);
        if (entry.isDirectory()) await collect(source, name + '/');
        else files[name] = [new Uint8Array(await readFile(source)), { mtime: new Date(2020, 0, 1) }];
    }
}
await collect(output);
const zip = zipSync(files, { level: 6 });
const filename = `ember-tab-${manifest.version}-firefox${testHttp ? '-test-http' : ''}.zip`;
await writeFile(path.join(dist, filename), zip);
const sha256 = createHash('sha256').update(zip).digest('hex');
await writeFile(path.join(dist, filename + '.sha256'), `${sha256}  ${filename}\n`);
console.log(JSON.stringify({ directory: output, archive: path.join(dist, filename), files: Object.keys(files).length, bytes: zip.length, sha256 }, null, 2));
