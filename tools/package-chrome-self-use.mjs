import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from '../scripts/libs/fflate.esm.js';
import { buildExtension } from './build-extension.mjs';
import { chromeIdentity } from './chrome-identity.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const output = path.join(dist, 'chrome-self-use');
const guideNames = ['CHROME_SELF_USE.md', 'CHROME_SELF_USE_VALIDATION.md'];
const guides = await Promise.all(guideNames.map(name => readFile(path.join(root, 'docs', name))));
const runtime = await buildExtension('chrome');
const manifest = JSON.parse(await readFile(path.join(runtime.directory, 'manifest.json'), 'utf8'));
const project = JSON.parse(await readFile(path.join(root, 'ember.project.json'), 'utf8'));
const identity = chromeIdentity(project);
// The validation record is tied to its recorded runtime, never to a future build by default.
const validatedRuntimeSha256 = guides[1].toString('utf8')
    .match(/\| ember-tab-[^|]+-chrome\.zip \|[^|]+\|[^|]+\| `([a-f0-9]{64})` \|/)?.[1];
if (!validatedRuntimeSha256) throw new Error('Validation record must identify the accepted Chrome ZIP');
if (manifest.key !== identity.key) throw new Error('Runtime identity differs from the configured identity');
if (path.dirname(output) !== dist || path.dirname(dist) !== path.resolve(root)) {
    throw new Error('Delivery output must stay inside the project dist directory');
}
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(runtime.directory, path.join(output, 'chrome'), { recursive: true });
for (const [index, name] of guideNames.entries()) await writeFile(path.join(output, name), guides[index]);
await writeFile(path.join(output, 'RELEASE.json'), JSON.stringify({
    name: project.name,
    version: manifest.version,
    browser: 'chrome',
    distribution: 'self-use-unpacked',
    loadDirectory: 'chrome',
    extensionId: identity.id,
    runtime: {
        archive: path.basename(runtime.archive), files: runtime.files, bytes: runtime.bytes, sha256: runtime.sha256
    },
    validation: {
        record: guideNames[1],
        validatedRuntimeSha256,
        matchesValidatedRuntime: runtime.sha256 === validatedRuntimeSha256
    }
}, null, 2) + '\n');

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
const checksumList = Object.entries(files).map(([name, [bytes]]) =>
    `${createHash('sha256').update(bytes).digest('hex')}  ${name}\n`).join('');
await writeFile(path.join(output, 'SHA256SUMS.txt'), checksumList);
files['SHA256SUMS.txt'] = [new TextEncoder().encode(checksumList), { mtime: new Date(2020, 0, 1) }];
const archive = path.join(dist, `ember-tab-${manifest.version}-chrome-self-use.zip`);
const zip = zipSync(files, { level: 6 });
const sha256 = createHash('sha256').update(zip).digest('hex');
await writeFile(archive, zip);
await writeFile(archive + '.sha256', `${sha256}  ${path.basename(archive)}\n`);
console.log(JSON.stringify({ directory: output, archive, files: Object.keys(files).length,
    bytes: zip.length, sha256, extensionId: identity.id,
    matchesValidatedRuntime: runtime.sha256 === validatedRuntimeSha256 }, null, 2));
