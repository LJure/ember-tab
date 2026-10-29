/**
 * Quick links local cache tests
 *
 * The Dock paints from localStorage before chrome.storage.sync answers on a
 * cold browser start. These tests cover cache persistence, synchronous
 * hydration, expiry and version guards.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setStorageData } from './setup.js';

const CACHE_KEY = 'aura:quicklinks-cache:v1';

async function freshStore() {
    vi.resetModules();
    const mod = await import('../scripts/domains/quicklinks/store.js');
    return mod.store;
}

function seedItems(count, { dockPins = [] } = {}) {
    const ids = [];
    const chunk = {};
    const data = {
        storageVersion: 6,
        quicklinksDockPins: dockPins,
        quicklinksItems: []
    };

    for (let i = 0; i < count; i++) {
        const id = `qlink_${String(i).padStart(3, '0')}`;
        ids.push(id);
        chunk[id] = {
            _id: id,
            title: `Item ${i}`,
            url: `https://example.com/${i}`,
            icon: '',
            createdAt: Date.now() - i
        };
    }

    data.quicklinksItems = ids;
    data.quicklinksActiveSet = 'seed_cache_test';
    data.quicklinksChunkSet_seed_cache_test_index = ['quicklinksChunkSet_seed_cache_test_0'];
    data.quicklinksChunkSet_seed_cache_test_0 = chunk;
    setStorageData(data, 'sync');

    return ids;
}

describe('Quick links local cache', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('persists a cache after a successful load', async () => {
        const ids = seedItems(2, { dockPins: ['qlink_000'] });
        const store = await freshStore();

        await store.init();

        const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
        expect(cached.v).toBe(1);
        expect(cached.itemsStructure).toEqual(expect.arrayContaining(ids));
        expect(cached.dockPins).toEqual(['qlink_000']);
        expect(cached.items.map((item) => item._id)).toEqual(expect.arrayContaining(ids));
        expect(cached.settings.enabled).toBe(true);
    });

    it('hydrates links and dock pins before storage resolves', async () => {
        seedItems(3, { dockPins: ['qlink_000', 'qlink_001'] });
        const first = await freshStore();
        await first.init();

        const second = await freshStore();
        const hydrated = second.hydrateFromCache();

        expect(hydrated).toBe(true);
        expect(second.getAllItems().map((item) => item._id)).toEqual(
            expect.arrayContaining(['qlink_000', 'qlink_001', 'qlink_002'])
        );
        expect(second.getDockItems().map((item) => item._id)).toEqual(['qlink_000', 'qlink_001']);
        expect(second.settings.enabled).toBe(true);
    });

    it('ignores a cache older than fourteen days', async () => {
        seedItems(1);
        const first = await freshStore();
        await first.init();

        const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
        cached.ts = Date.now() - 15 * 24 * 60 * 60 * 1000;
        localStorage.setItem(CACHE_KEY, JSON.stringify(cached));

        const second = await freshStore();
        expect(second.hydrateFromCache()).toBe(false);
        expect(second.getAllItems()).toEqual([]);
    });

    it('ignores an unknown cache version', async () => {
        seedItems(1);
        const first = await freshStore();
        await first.init();

        const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
        cached.v = 99;
        localStorage.setItem(CACHE_KEY, JSON.stringify(cached));

        const second = await freshStore();
        expect(second.hydrateFromCache()).toBe(false);
        expect(second.getDockItems()).toEqual([]);
    });

    it('survives malformed cache data', async () => {
        localStorage.setItem(CACHE_KEY, '{not-json');

        const store = await freshStore();
        expect(store.hydrateFromCache()).toBe(false);
        expect(store.getAllItems()).toEqual([]);
    });
});
