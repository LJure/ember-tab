import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { zipSync, unzipSync, strToU8, strFromU8 } from '../scripts/libs/fflate.esm.js';

// Synthetic data only. Never read an installed browser profile or user backup.
const output = new URL('../.local/fixtures/', import.meta.url);
await mkdir(output, { recursive: true });
const write = (name, data) => writeFile(new URL(name, output), data);

const tree = [{ id: 'root________', title: '', type: 'folder', children: [
    { id: 'toolbar_____', title: 'Bookmarks Toolbar', type: 'folder', children: [
        { id: 'sample-1', type: 'bookmark', title: '示例 A', url: 'https://example.com/a' },
        { id: 'sample-separator', type: 'separator', title: '' },
        { id: 'sample-folder', type: 'folder', title: '嵌套目录', children: [
            { id: 'sample-2', type: 'bookmark', title: 'Example B', url: 'https://example.org/b?q=test%20value' }
        ] },
        { id: 'sample-empty', type: 'folder', title: '空目录', children: [] }
    ] },
    { id: 'menu________', title: 'Bookmarks Menu', type: 'folder', children: [
        { id: 'sample-duplicate', type: 'bookmark', title: '重复 A', url: 'https://example.com/a' }
    ] },
    { id: 'unfiled_____', title: 'Other Bookmarks', type: 'folder', children: [] }
] }];
await write('firefox-bookmark-tree.json', JSON.stringify(tree, null, 2) + '\n');
await write('bookmarks.html', `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Ember Tab synthetic bookmarks</TITLE><H1>Ember Tab synthetic bookmarks</H1>
<DL><p><DT><H3>Ember Tab sample</H3><DL><p>
<DT><A HREF="https://example.com/a">示例 A</A><HR>
<DT><H3>嵌套目录</H3><DL><p><DT><A HREF="https://example.org/b?q=test%20value">Example B</A></DL><p>
<DT><H3>空目录</H3><DL><p></DL><p>
<DT><A HREF="https://example.com/a">重复 A</A>
</DL><p></DL><p>\n`);
await write('wallpaper.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="#20242b"/><rect x="100" y="100" width="1400" height="700" fill="#d97942"/><circle cx="1100" cy="350" r="160" fill="#f6d393"/><path d="M0 900L550 400L950 900Z" fill="#536a60"/><text x="140" y="790" font-size="48" fill="white">Ember Tab synthetic fixture 1600 x 900</text></svg>\n`);

const sync = {
    interfaceLanguage: 'zh_CN', uiTheme: 'dark', clockFormat: '24',
    preferredSearchEngine: 'default', quicklinksEnabled: true,
    quicklinksItems: ['qlink_sample_a', 'qlink_sample_b'],
    quicklinksActiveSet: 'set1',
    quicklinksChunkSet_set1_index: ['quicklinksChunkSet_set1_0'],
    quicklinksChunkSet_set1_0: {
        qlink_sample_a: { _id: 'qlink_sample_a', title: '示例 A', url: 'https://example.com/a', icon: '' },
        qlink_sample_b: { _id: 'qlink_sample_b', title: 'Example B', url: 'https://example.org/b', icon: '' }
    }
};
const files = {
    'meta.json': strToU8(JSON.stringify({
        schema: 'aura-tab-webdav-backup', schemaVersion: 1,
        exportedAt: '2026-09-27T00:00:00.000Z', extensionVersion: '3.5.3',
        notes: 'Synthetic M1 fixture, not exported by a real Aura Tab installation.'
    })),
    'storage/sync.json': strToU8(JSON.stringify(sync)),
    'storage/local.json': strToU8('{}'),
    'idb/icon-cache/index.json': strToU8('[]'),
    'idb/toolbar-icon/index.json': strToU8('[]'),
    'idb/assets/index.json': strToU8('[]'),
    'idb/local-files/index.json': strToU8('[]')
};
const fixedOptions = { level: 6, mtime: new Date('2020-01-01T12:00:00') };
await write('synthetic-backup.zip', zipSync(files, fixedOptions));
await write('invalid-schema-backup.zip', zipSync({ ...files,
    'meta.json': strToU8(JSON.stringify({ schema: 'not-aura-tab', schemaVersion: 1 }))
}, fixedOptions));
const missingStorage = { ...files };
delete missingStorage['storage/sync.json'];
await write('missing-storage-backup.zip', zipSync(missingStorage, fixedOptions));

// Verify the saved archive itself; this does not claim browser restore success.
const saved = await readFile(new URL('synthetic-backup.zip', output));
const decoded = unzipSync(saved);
if (Object.keys(decoded).length !== 7 ||
    JSON.parse(strFromU8(decoded['meta.json'])).schema !== 'aura-tab-webdav-backup' ||
    JSON.parse(strFromU8(decoded['storage/sync.json'])).quicklinksItems.length !== 2) {
    throw new Error('Synthetic fixture verification failed');
}
const report = {
    fixture: 'synthetic-backup.zip', entries: Object.keys(decoded),
    sha256: createHash('sha256').update(saved).digest('hex'),
    verification: 'ZIP structure and synthetic data only; browser restore is pending M4.'
};
await write('fixture-report.json', JSON.stringify(report, null, 2) + '\n');

for (const channel of ['firefox-stable', 'firefox-esr']) {
    const profile = new URL(`../.local/profiles/${channel}/`, import.meta.url);
    await mkdir(profile, { recursive: true });
    // Preserve an existing test profile if this preparation is run again.
    await writeFile(new URL('user.js', profile),
        '// Ember Tab isolated test profile; do not sign in with a personal account.\n' +
        'user_pref("browser.shell.checkDefaultBrowser", false);\n' +
        'user_pref("browser.startup.page", 0);\n', { flag: 'wx' })
        .catch(error => { if (error.code !== 'EEXIST') throw error; });
}
console.log(`Prepared and verified synthetic fixtures: ${fileURLToPath(output)}`);
