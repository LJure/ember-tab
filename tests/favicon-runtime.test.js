import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); });
afterEach(() => { vi.unstubAllGlobals(); });
function runtimeMock(contexts = []) {
    const api = {
        runtime: {
            getURL: value => 'chrome-extension://ember-test/' + value,
            getContexts: vi.fn(async () => contexts),
            sendMessage: vi.fn(async message => ({ valid: true, request: message.type }))
        },
        offscreen: { createDocument: vi.fn(async () => { contexts.push({ contextId: 'fixture' }); }) }
    };
    vi.stubGlobal('chrome', api);
    return api;
}
describe('Chrome offscreen document lifecycle', () => {
    it('creates one document for a concurrent burst of DOM tasks', async () => {
        const api = runtimeMock();
        const { runFaviconDomTask } = await import('../scripts/platform/favicon-runtime.js');
        const results = await Promise.all(Array.from({ length: 16 }, () => runFaviconDomTask({ type: 'faviconOffscreenInspectImage' })));
        expect(results.every(value => value.valid)).toBe(true);
        expect(api.offscreen.createDocument).toHaveBeenCalledTimes(1);
        expect(api.runtime.sendMessage).toHaveBeenCalledTimes(16);
    });
    it('recreates a document removed between tasks', async () => {
        const contexts = [];
        const api = runtimeMock(contexts);
        const { runFaviconDomTask } = await import('../scripts/platform/favicon-runtime.js');
        await runFaviconDomTask({ type: 'faviconOffscreenParsePage' });
        contexts.length = 0;
        await runFaviconDomTask({ type: 'faviconOffscreenParsePage' });
        expect(api.offscreen.createDocument).toHaveBeenCalledTimes(2);
    });
    it('reuses an existing document after the worker module restarts', async () => {
        const api = runtimeMock([{ contextId: 'already-open' }]);
        const { runFaviconDomTask } = await import('../scripts/platform/favicon-runtime.js');
        await runFaviconDomTask({ type: 'faviconOffscreenParsePage' });
        expect(api.offscreen.createDocument).not.toHaveBeenCalled();
    });
    it('allows the next request to retry after creation fails', async () => {
        const api = runtimeMock();
        api.offscreen.createDocument.mockRejectedValueOnce(new Error('fixture failure'));
        const { runFaviconDomTask } = await import('../scripts/platform/favicon-runtime.js');
        await expect(runFaviconDomTask({ type: 'faviconOffscreenParsePage' })).rejects.toThrow('fixture failure');
        await expect(runFaviconDomTask({ type: 'faviconOffscreenParsePage' })).resolves.toMatchObject({ valid: true });
        expect(api.offscreen.createDocument).toHaveBeenCalledTimes(2);
    });
});
