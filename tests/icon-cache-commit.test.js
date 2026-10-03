import { afterEach, describe, expect, it, vi } from 'vitest';
import { IconCacheManager } from '../scripts/platform/icon-cache.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function pendingWrite() {
    const manager = new IconCacheManager();
    const request = {};
    const tx = { objectStore: () => ({ put: () => request }) };
    vi.spyOn(manager, '_openDb').mockResolvedValue({ transaction: () => tx });
    vi.stubGlobal('requestIdleCallback', vi.fn());
    return { manager, tx, request };
}
describe('icon cache durable writes', () => {
    it('does not report a saved icon until its write transaction commits', async () => {
        const { manager, tx, request } = pendingWrite();
        let settled = false;
        const result = manager.set('fixture', new Blob([new Uint8Array(128)]), 'https://example.com/icon.png');
        void result.then(() => { settled = true; });
        await Promise.resolve();
        request.onsuccess?.();
        await Promise.resolve();
        expect(settled).toBe(false);
        tx.oncomplete();
        await expect(result).resolves.toBe(true);
        manager.destroy();
    });
    it('reports failure if the transaction aborts after the put request succeeds', async () => {
        const { manager, tx, request } = pendingWrite();
        const result = manager.set('fixture', new Blob([new Uint8Array(128)]), 'https://example.com/icon.png');
        await Promise.resolve();
        request.onsuccess?.();
        tx.error = new Error('fixture aborted');
        tx.onabort();
        await expect(result).resolves.toBe(false);
        manager.destroy();
    });
});
