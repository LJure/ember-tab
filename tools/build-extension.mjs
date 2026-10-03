import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { zipSync } from '../scripts/libs/fflate.esm.js';
import { chromeIdentity } from './chrome-identity.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runtimeEntries = [
    'newtab.html', 'privacy.html', 'background-worker.js', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'licenses', 'styles', 'scripts', '_locales',
    'assets/backgrounds', 'assets/icons', 'assets/changelog.json'
];

export async function buildExtension(browser, { release = false, testHttp = false } = {}) {
    // Resolve only known targets before cleaning anything; callers cannot supply a path.
    if (!['chrome', 'firefox'].includes(browser)) throw new Error('Unsupported build target');
    const dist = path.join(root, 'dist');
    const output = path.join(dist, browser);
    const project = JSON.parse(await readFile(path.join(root, 'ember.project.json'), 'utf8'));
    const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
    const identity = browser === 'chrome' ? chromeIdentity(project) : null;
    if (release && project.releaseBlockers?.length) {
        throw new Error('Release blocked:\n- ' + project.releaseBlockers.join('\n- '));
    }
    if (path.dirname(output) !== dist || path.dirname(dist) !== path.resolve(root)) {
        throw new Error('Build output must stay inside the project dist directory');
    }
    await rm(output, { recursive: true, force: true });
    await mkdir(output, { recursive: true });

    // Keep development files and local browser profiles out of both packages.
    const entries = browser === 'chrome' ? [...runtimeEntries, 'favicon-offscreen.html'] : runtimeEntries;
    for (const entry of entries) {
        await cp(path.join(root, entry), path.join(output, entry), {
            recursive: true,
            filter: (source) => path.basename(source) !== '.DS_Store'
        });
    }

    manifest.version = project.currentVersion || project.initialVersion;
    if (browser === 'firefox') {
        delete manifest.key;
        await cp(path.join(root, 'scripts/platform/favicon-runtime-firefox.js'),
            path.join(output, 'scripts/platform/favicon-runtime.js'));
        delete manifest.minimum_chrome_version;
        delete manifest.offline_enabled;
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
    } else {
        manifest.key = identity.key;
        delete manifest.browser_specific_settings;
        manifest.minimum_chrome_version = project.minimumChromeVersion;
        manifest.background = { service_worker: 'background-worker.js', type: 'module' };
    }

    // Match the existing HTTPS policy. Plain HTTP loopback is explicitly test-only.
    manifest.host_permissions = ['https://*/*', ...(testHttp ? ['http://127.0.0.1/*', 'http://localhost/*'] : [])];
    manifest.content_security_policy.extension_pages = "script-src 'self'; object-src 'none'; img-src 'self' data: blob: https:; connect-src 'self' https: data: blob:" +
        (testHttp ? ' http://127.0.0.1:* http://localhost:*' : '') + ';';
    await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

    const browserName = browser === 'chrome' ? 'Chrome' : 'Firefox';
    // Keep browser-specific UI and privacy disclosures in the built package.
    for (const locale of ['en', 'zh_CN', 'zh_TW']) {
        const target = path.join(output, 'scripts/platform/locales', locale + '.json');
        const dict = JSON.parse(await readFile(target, 'utf8'));
        if (browser === 'chrome') {
            dict.emberAttribution = dict.emberAttribution.replaceAll('Firefox', 'Chrome').replaceAll('Mozilla', 'Google');
            dict.settingsSearchConsentRequired = {
                en: 'Check search permissions in the extension settings first.',
                zh_CN: '请先检查扩展设置中的搜索权限。',
                zh_TW: '請先檢查擴充功能設定中的搜尋權限。'
            }[locale];
        }
        await writeFile(target, JSON.stringify(dict, null, 4) + '\n');
    }
    let privacy = await readFile(path.join(output, 'privacy.html'), 'utf8');
    if (browser === 'chrome') {
        privacy = privacy.split('\n').map(line => line.includes('<strong>跨浏览器：') ? line : line.replaceAll('Firefox', 'Chrome')).join('\n')
            .replace(/Chrome 140 及以上的安装提示声明[^。]+。/, 'Chrome 的扩展权限提示不代表每项功能已开启。搜索历史与实时联想默认关闭，由您在设置中开启；搜索权限用于浏览器默认搜索，favicon 与 offscreen 权限用于获取和解析图标。')
            .replace(/Chrome 140\+ presents required transmission categories[^.]+\. Consent does not enable every feature\./, 'Chrome extension permission prompts do not enable every feature. Search history and live suggestions are off by default. The search permission supports browser-default searches; favicon and offscreen permissions support fetching and parsing icons.');
    }
    privacy = privacy.replace(/Ember Tab 0\.1\.\d+/g, 'Ember Tab ' + manifest.version);
    await writeFile(path.join(output, 'privacy.html'), privacy);
    const descriptions = {
        en: `A customizable new tab for ${browserName}. An independent port of Aura Tab by nil-byte.`,
        zh_CN: `可自定义的 ${browserName} 新标签页。基于 nil-byte 的 Aura Tab 开发的独立移植版。`,
        zh_TW: `可自訂的 ${browserName} 新分頁。基於 nil-byte 的 Aura Tab 開發的獨立移植版。`
    };
    for (const [locale, description] of Object.entries(descriptions)) {
        const target = path.join(output, '_locales', locale, 'messages.json');
        const messages = JSON.parse(await readFile(target, 'utf8'));
        messages.extName.message = project.name;
        messages.extDescription.message = description;
        await writeFile(target, JSON.stringify(messages, null, 2) + '\n');
    }
    await writeFile(path.join(output, 'NOTICE'),
        `Ember Tab is an independent ${browserName} port of Aura Tab by nil-byte.\n` +
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
    const filename = `ember-tab-${manifest.version}-${browser}${testHttp ? '-test-http' : ''}.zip`;
    await writeFile(path.join(dist, filename), zip);
    const sha256 = createHash('sha256').update(zip).digest('hex');
    await writeFile(path.join(dist, filename + '.sha256'), `${sha256}  ${filename}\n`);
    return { directory: output, archive: path.join(dist, filename), files: Object.keys(files).length, bytes: zip.length, sha256 };
}
