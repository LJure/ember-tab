import { describe, it, expect, vi } from 'vitest';
import { setStorageData } from './setup.js';
import { SEARCH_HISTORY_KEY, createSearchHistoryHandler, SEARCH_LOCAL_KEYS } from '../scripts/platform/search-data.js';
import { BackupManager } from '../scripts/platform/backup-manager.js';

const sender = { id: 'test-extension' };
describe('local search history privacy and concurrent changes', () => {
    it('serializes add/delete from multiple pages without reviving a deleted entry', async () => {
        setStorageData({ searchHistoryEnabled: true }, 'local');
        const handle = createSearchHistoryHandler(chrome.storage.local, sender.id);
        await Promise.all([
            handle({ action: 'add', query: 'first' }, sender),
            handle({ action: 'add', query: 'second' }, sender),
            handle({ action: 'delete', query: 'first' }, sender),
            handle({ action: 'add', query: 'third' }, sender)
        ]);
        expect((await handle({ action: 'list' }, sender)).items).toEqual(['third', 'second']);
        expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    });
    it('deduplicates and limits history to the 100 most recently submitted queries', async () => {
        setStorageData({ searchHistoryEnabled: true }, 'local');
        const handle = createSearchHistoryHandler(chrome.storage.local, sender.id);
        await Promise.all(Array.from({ length: 102 }, (_, index) => handle({ action: 'add', query: `query${index}` }, sender)));
        const items = (await handle({ action: 'add', query: 'query50' }, sender)).items;
        expect(items).toHaveLength(100);
        expect(items[0]).toBe('query50');
        expect(items).not.toContain('query0');
        expect(new Set(items).size).toBe(100);
    });
    it('does not read history when off or in private mode, but can explicitly clear retained history', async () => {
        setStorageData({ [SEARCH_HISTORY_KEY]: ['retained'] }, 'local');
        const handle = createSearchHistoryHandler(chrome.storage.local, sender.id);
        expect((await handle({ action: 'list' }, sender)).items).toEqual([]);
        expect(chrome.storage.local.get).not.toHaveBeenCalledWith({ [SEARCH_HISTORY_KEY]: [] });
        chrome.storage.local.get.mockClear();
        await handle({ action: 'list' }, { ...sender, tab: { incognito: true } });
        await handle({ action: 'clear' }, { id: 'foreign-extension' });
        expect(chrome.storage.local.get).not.toHaveBeenCalled();
        expect(chrome.storage.local.remove).not.toHaveBeenCalled();
        await handle({ action: 'clear' }, sender);
        expect((await chrome.storage.local.get(SEARCH_HISTORY_KEY))[SEARCH_HISTORY_KEY]).toBeUndefined();
    });
    it('continues after a failed write without blocking future operations', async () => {
        setStorageData({ searchHistoryEnabled: true }, 'local');
        const handle = createSearchHistoryHandler(chrome.storage.local, sender.id);
        chrome.storage.local.set.mockRejectedValueOnce(new Error('disk'));
        await expect(handle({ action: 'add', query: 'failed' }, sender)).rejects.toThrow();
        expect((await handle({ action: 'add', query: 'success' }, sender)).items).toEqual(['success']);
    });
});

describe('all ZIP backup paths share search data exclusion', () => {
    it('excludes history and local opt-in switches even if a foreign snapshot put them in sync', async () => {
        const privateData = { emberSearchHistory: ['private query'], searchHistoryEnabled: true, searchSuggestionsEnabled: true, searchSuggestionSource: 'brave' };
        setStorageData({ marker: 'sync', ...privateData });
        setStorageData({ marker: 'local', webdavConfig: { password: 'private' }, ...privateData }, 'local');
        const manager = new BackupManager();
        const files = new Map();
        vi.spyOn(manager, '_addFileToZip').mockImplementation((_zipper, name, data) => files.set(name, new TextDecoder().decode(data)));
        vi.spyOn(manager, '_exportIDBToZipStream').mockResolvedValue({ entries: 0, totalSize: 0 });
        chrome.runtime.getManifest = vi.fn(() => ({ version: '0.1.1' }));
        await manager._appendBackupDataToZipper({}, {});
        expect(JSON.parse(files.get('storage/local.json'))).toEqual({ marker: 'local' });
        expect(JSON.parse(files.get('storage/sync.json'))).toEqual({ marker: 'sync' });
        expect(files.get('storage/local.json')).not.toContain('private query');
    });
    it('rejects incoming search fields while preserving current local history and opt-ins during restore', async () => {
        const preserved = { emberSearchHistory: ['this device'], searchHistoryEnabled: false, searchSuggestionsEnabled: false, searchSuggestionSource: 'brave' };
        setStorageData(preserved, 'local');
        const manager = new BackupManager();
        vi.spyOn(manager, '_openDatabase').mockResolvedValue({ close() {} });
        for (const name of ['_clearStagingDb', '_streamUnzipToStaging', '_deleteStagingDb']) vi.spyOn(manager, name).mockResolvedValue();
        vi.spyOn(manager, '_getStagingFile').mockResolvedValue({ text: async () => JSON.stringify({ schema: 'aura-tab-webdav-backup', schemaVersion: 1 }) });
        vi.spyOn(manager, '_validateStagingIntegrity').mockResolvedValue(true);
        vi.spyOn(manager, '_importIDBFromStaging').mockResolvedValue(0);
        vi.spyOn(manager, '_parseRequiredStagingJsonObject').mockResolvedValue({ ordinary: 1, ...Object.fromEntries(SEARCH_LOCAL_KEYS.map(key => [key, 'incoming'])) });
        expect(await manager._restoreFromBackup({ size: 1 })).toMatchObject({ success: true });
        expect(await chrome.storage.local.get(null)).toEqual({ ...preserved, ordinary: 1 });
        expect(await chrome.storage.sync.get(null)).toEqual({ ordinary: 1 });
    });
});
