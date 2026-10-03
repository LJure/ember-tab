import assert from 'node:assert/strict';
import { cp, lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync, unzipSync } from '../scripts/libs/fflate.esm.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const project = JSON.parse(await readFile(path.join(root, 'ember.project.json'), 'utf8'));
const version = project.currentVersion;
assert(/^\d+\.\d+\.\d+$/.test(version));
const dist = path.join(root, 'dist');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
assert.equal(git(['status', '--porcelain']), '', 'Commit release source before packaging');
const commit = git(['rev-parse', 'HEAD']);
const expected = process.argv.find(arg => arg.startsWith('--runtime-sha256='))?.split('=')[1];
assert(/^[a-f0-9]{64}$/.test(expected || ''), 'Supply the validated runtime SHA-256');
const runtimeName = `ember-tab-${version}-firefox.zip`;
const sourceName = `ember-tab-${version}-source.zip`;
const runtime = await readFile(path.join(dist, runtimeName));
assert.equal(sha(runtime), expected);
const runtimeFiles = unzipSync(runtime);
const manifest = JSON.parse(new TextDecoder().decode(runtimeFiles['manifest.json']));
assert.equal(manifest.version, version);
assert.equal(manifest.browser_specific_settings.gecko.id, project.geckoId);
assert.deepEqual(manifest.host_permissions, ['https://*/*']);
assert(!manifest.content_security_policy.extension_pages.includes('http:'));
assert(!Object.keys(runtimeFiles).some(name => /(?:^|\/)(?:tools|tests|\.local)(?:\/|$)|probe|test-http/.test(name)));

// Historical upstream screenshots do not participate in the reproducible build.
const excluded = /^(?:assets\/other\/(?:Dock\.png|case\.jpg|desktop\.png|launchpad\.png|photo\.jpg|setting\.jpg)|docs\/images\/(?:desktop\.png|dock\.png|icon128\.png|launchpad\.png|photo\.jpg|setting\.jpg))$/;
const files = {};
for (const name of git(['ls-files', '-z']).split('\0').filter(Boolean).sort((a, b) => a.localeCompare(b, 'en'))) {
    if (excluded.test(name)) continue;
    assert(!/^(?:\.git\/|\.local\/|node_modules\/|dist\/|\.codex\/)|(?:^|\/)\.env(?:\.|$)/.test(name), `Private source path: ${name}`);
    assert(!(await lstat(path.join(root, name))).isSymbolicLink(), `Source symlink: ${name}`);
    files[name] = [new Uint8Array(await readFile(path.join(root, name))), { mtime: new Date(2020, 0, 1) }];
}
const source = zipSync(files, { level: 6 });
assert(source.length <= 200 * 1024 * 1024);
await writeFile(path.join(dist, sourceName), source);
for (const [name, bytes] of [[runtimeName, runtime], [sourceName, source]]) {
    await writeFile(path.join(dist, name + '.sha256'), `${sha(bytes)}  ${name}\n`);
}
const verify = path.join(root, '.local', `source-verify-${version}-${commit.slice(0, 8)}`);
await mkdir(verify, { recursive: true });
for (const [name, bytes] of Object.entries(unzipSync(source))) {
    const target = path.resolve(verify, name);
    assert(target.startsWith(verify + path.sep));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
}
const rebuild = execFileSync(process.execPath, ['tools/build-firefox.mjs', '--release'], { cwd: verify, encoding: 'utf8' });
assert.equal(sha(await readFile(path.join(verify, 'dist', runtimeName))), expected);
await writeFile(path.join(root, `.local/source-rebuild-${version}.log`), rebuild);
const validation = JSON.parse(await readFile(path.join(root, 'docs/THIRD_UPDATE_VALIDATION.json'), 'utf8'));
assert.equal(validation.version, version);
assert.equal(validation.runtime.sha256, expected);
assert.equal(validation.status, 'passed');
const submission = {
    version, commit, signed: false, submitted: false,
    amo: { slug: 'ember-tab-firefox', channel: 'listed', status: 'manual-submission-pending', publicVersionVerified: validation.amo.publicVersion, verifiedAt: validation.amo.verifiedAt },
    runtime: { file: runtimeName, sha256: expected, bytes: runtime.length, files: Object.keys(runtimeFiles).length },
    source: { file: sourceName, sha256: sha(source), bytes: source.length, files: Object.keys(files).length },
    sourceRebuild: { byteIdentical: true, command: 'node tools/build-firefox.mjs --release', node: process.version, npmRequired: false, gitRequired: false },
    validation
};
const submissionName = `ember-tab-${version}-submission.json`;
await writeFile(path.join(dist, submissionName), JSON.stringify(submission, null, 2) + '\n');
const amo = path.join(dist, 'amo', version);
await mkdir(amo, { recursive: true });
assert.equal((await readdir(amo)).length, 0, 'Use a fresh version materials directory');
for (const name of [runtimeName, sourceName]) await cp(path.join(dist, name), path.join(amo, name));
await cp(path.join(dist, submissionName), path.join(amo, 'submission.json'));
await cp(path.join(root, 'assets/icons/icon128.png'), path.join(amo, 'icon128.png'));
await cp(path.join(root, 'docs/store/05-icon-choices.png'), path.join(amo, '05-icon-choices.png'));
await cp(path.join(root, 'docs/THIRD_UPDATE_STORE_GUIDE.md'), path.join(amo, 'upload-guide.md'));
const reviewer = (await readFile(path.join(root, 'docs/THIRD_UPDATE_AMO_NOTES.md'), 'utf8')).replace(/^#.*\r?\n\r?\n/, '');
assert(reviewer.length < 3000);
await writeFile(path.join(amo, 'reviewer-notes.txt'), reviewer);
const changelog = JSON.parse(await readFile(path.join(root, 'assets/changelog.json'), 'utf8'))[version];
for (const [locale, key] of [['zh-CN', 'zh_CN'], ['en-US', 'en'], ['zh-TW', 'zh_TW']]) {
    await writeFile(path.join(amo, `version-notes-${locale}.txt`), changelog[key].map(line => '- ' + line).join('\n') + '\n');
}
const privacy = (await readFile(path.join(root, 'dist/firefox/privacy.html'), 'utf8'))
    .replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<\/(?:p|li|h1|h2|section)>/gi, '\n\n').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&')
    .replace(/\n\s*\n\s*\n/g, '\n\n').trim();
await writeFile(path.join(amo, 'privacy-policy.txt'), privacy + '\n');
await writeFile(path.join(amo, 'screenshot-captions.txt'), '简体中文：自动图标候选选择，显示多个来源和实际尺寸。隔离 Firefox 配置，所有图标均为本地测试素材。\n\nEnglish: Choose from available automatic icons with source labels and actual sizes. Disposable Firefox profile with local test artwork.\n');
const materials = {};
let sums = '';
for (const name of (await readdir(amo)).sort()) {
    const bytes = await readFile(path.join(amo, name));
    materials[name] = [new Uint8Array(bytes), { mtime: new Date(2020, 0, 1) }];
    sums += `${sha(bytes)}  ${name}\n`;
}
await writeFile(path.join(amo, 'SHA256SUMS.txt'), sums);
materials['SHA256SUMS.txt'] = [new TextEncoder().encode(sums), { mtime: new Date(2020, 0, 1) }];
const materialsName = `ember-tab-${version}-amo-materials.zip`;
const bundle = zipSync(materials, { level: 6 });
await writeFile(path.join(dist, materialsName), bundle);
await writeFile(path.join(dist, materialsName + '.sha256'), `${sha(bundle)}  ${materialsName}\n`);
const body = await readFile(path.join(root, 'docs/THIRD_UPDATE_RELEASE_NOTES.md'), 'utf8');
await writeFile(path.join(root, '.local/third-update-release-body.md'), body + `\nRuntime SHA-256: \`${expected}\`\n\nSource SHA-256: \`${sha(source)}\`\n`);
console.log(JSON.stringify({ ...submission, materials: { file: materialsName, sha256: sha(bundle), bytes: bundle.length, files: Object.keys(materials).length } }, null, 2));
