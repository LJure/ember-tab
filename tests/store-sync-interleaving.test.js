import { afterEach, describe, expect, it, vi } from 'vitest';
import { getStorageData, setStorageData } from './setup.js';

let store;
const item = id => ({ _id: id, title: id, url: `https://example.com/${id}`, createdAt: 1 });
const generation = (id, entries) => ({
    [`quicklinksChunkSet_${id}_index`]: [`quicklinksChunkSet_${id}_0`],
    [`quicklinksChunkSet_${id}_0`]: Object.fromEntries(entries.map(entry => [entry._id, entry]))
});
async function start() {
    vi.resetModules();
    setStorageData({ storageVersion: 6, quicklinksItems: ['qlink_old'],
        quicklinksDockPins: ['qlink_old'], quicklinksActiveSet: 'old',
        ...generation('old', [item('qlink_old')]) }, 'sync');
    store = (await import('../scripts/domains/quicklinks/store.js')).store;
    await store.init();
}
afterEach(() => store?.destroy());

describe('Sync delivery interleaving', () => {
    it('retains remote staging chunks during an unrelated local commit', async () => {
        await start();
        const remote = generation('remote', [item('qlink_remote')]);
        await chrome.storage.sync.set(remote);
        await store.addItem({title: 'Local', url: 'https://local.example'});
        for (const [key, value] of Object.entries(remote)) {
            expect(getStorageData('sync')[key]).toEqual(value);
        }
        expect(getStorageData('sync').quicklinksChunkSet_old_index).toBeUndefined();
    });

    it('skips old cleanup when Sync has switched the active generation', async () => {
        await start();
        const before = getStorageData('sync');
        await store._cleanupObsoleteStorage('local', ['quicklinksChunkSet_old_index', 'quicklinksChunkSet_old_0']);
        expect(getStorageData('sync')).toEqual(before);
    });

    it.each(['list-first', 'chunks-first', 'missing-child'])('%s preserves view and blocks writes until references arrive', async mode => {
        await start();
        const beforeIds = store.getAllItems().map(entry => entry._id);
        const remote = generation('remote', [item('qlink_remote')]);
        if (mode === 'list-first') {
            await chrome.storage.sync.set({quicklinksItems: ['qlink_remote']});
        } else if (mode === 'chunks-first') {
            await chrome.storage.sync.set({...remote, quicklinksActiveSet: 'remote'});
        } else {
            const folder = {_id: 'qfolder_remote', type: 'folder', title: 'Folder', children: ['qlink_remote']};
            await chrome.storage.sync.set({...generation('remote', [folder]),
                quicklinksItems: [folder._id], quicklinksActiveSet: 'remote'});
        }
        await store.loadData();
        expect(store._syncSnapshotIncomplete).toBe(true);
        expect(store.getAllItems().map(entry => entry._id)).toEqual(beforeIds);
        const incomplete = getStorageData('sync');
        await expect(store._commit({apply: ({items}) => ({items, dockPins: []})}))
            .rejects.toThrow('SYNC_SNAPSHOT_INCOMPLETE');
        expect(getStorageData('sync')).toEqual(incomplete);
        await chrome.storage.sync.set({...remote, quicklinksItems: ['qlink_remote'], quicklinksActiveSet: 'remote'});
        await store.loadData();
        expect(store._syncSnapshotIncomplete).toBe(false);
        expect(store.getItem('qlink_remote')).toBeTruthy();
    });
});
