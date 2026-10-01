import { afterEach, describe, it, expect, vi } from 'vitest';
import { resolveSuggestionProvider, parseSuggestions, SearchSuggestionClient } from '../scripts/platform/search-suggestions.js';
import { SUGGESTION_SOURCES } from '../scripts/platform/search-data.js';

function response(data, status = 200) {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    let read = false;
    return { ok: status === 200, status, headers: { get: () => null }, body: { getReader: () => ({
        read: async () => read ? { done: true } : (read = true, { done: false, value: bytes }),
        cancel: vi.fn(), releaseLock: vi.fn()
    }) } };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('suggestion provider mapping and request boundaries', () => {
    it('uses only the five approved sources for default/Sogou/Ecosia and follows all eight other engines', () => {
        expect(SUGGESTION_SOURCES).toEqual(['bing', 'google', 'baidu', 'duckduckgo', 'brave']);
        for (const engine of ['default', 'sogou', 'ecosia']) expect(resolveSuggestionProvider(engine, 'brave')).toBe('brave');
        for (const engine of ['google', 'bing', 'baidu', 'duckduckgo', 'brave', 'yahoo', 'yandex', 'naver']) expect(resolveSuggestionProvider(engine, 'bing')).toBe(engine);
        expect(resolveSuggestionProvider('unknown', 'bing')).toBeNull();
        expect(resolveSuggestionProvider('default', 'sogou')).toBe('bing');
    });
    it('sanitizes every response shape, duplicates, oversized and non-string suggestions', () => {
        expect(parseSuggestions('bing', ['q', ['x', 'x', {}, ' ', 'a'.repeat(257)]])).toEqual(['x']);
        expect(parseSuggestions('yahoo', { r: [{ k: 'yahoo' }] })).toEqual(['yahoo']);
        expect(parseSuggestions('naver', { items: [[['naver']]] })).toEqual(['naver']);
        expect(parseSuggestions('google', { malicious: 'data' })).toEqual([]);
    });
    it('encodes queries, omits cookies, rejects redirects and caches only in memory', async () => {
        const fetch = vi.fn(async () => response('["q",["<img src=x>","other"]]'));
        vi.stubGlobal('fetch', fetch);
        const client = new SearchSuggestionClient();
        expect(await client.get('bing', 'a & b')).toEqual(['<img src=x>', 'other']);
        expect(fetch.mock.calls[0][0]).toContain('query=a+%26+b');
        expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: 'omit', redirect: 'error' });
        await client.get('bing', 'a & b');
        expect(fetch).toHaveBeenCalledOnce();
        expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
    it('decodes Baidu GBK without corrupting Chinese suggestions', async () => {
        const bytes = new Uint8Array([...new TextEncoder().encode('["q",["'), 0xb9, 0xd9, 0xcd, 0xf8, ...new TextEncoder().encode('"]]')]);
        vi.stubGlobal('fetch', vi.fn(async () => response(bytes)));
        expect(await new SearchSuggestionClient().get('baidu', 'steam')).toEqual(['官网']);
    });
    it('does not request when search-term consent is absent or the input is empty/oversized', async () => {
        const fetch = vi.fn();
        vi.stubGlobal('fetch', fetch);
        vi.stubGlobal('browser', { runtime: { getManifest: () => ({ browser_specific_settings: { gecko: { data_collection_permissions: {} } } }) }, permissions: { contains: async () => false } });
        const client = new SearchSuggestionClient();
        await client.get('bing', 'private');
        await client.get('bing', '');
        await client.get('bing', 'x'.repeat(257));
        expect(fetch).not.toHaveBeenCalled();
    });
    it('backs off on 429 and never silently requests another service', async () => {
        const fetch = vi.fn(async () => response('', 429));
        vi.stubGlobal('fetch', fetch);
        const client = new SearchSuggestionClient();
        expect(await client.get('bing', 'first')).toEqual([]);
        await client.get('bing', 'second');
        expect(fetch).toHaveBeenCalledOnce();
        expect(fetch.mock.calls[0][0]).toContain('api.bing.com');
    });
    it('rejects oversized streamed responses and non-JSON responses without executing code', async () => {
        const fetch = vi.fn().mockResolvedValueOnce(response(new Uint8Array(65537))).mockResolvedValueOnce(response('window.attack()'));
        vi.stubGlobal('fetch', fetch);
        const client = new SearchSuggestionClient();
        expect(await client.get('google', 'q')).toEqual([]);
        expect(await client.get('bing', 'q')).toEqual([]);
    });
    it('aborts a pending fetch at the timeout and on caller cancellation', async () => {
        vi.useFakeTimers();
        vi.stubGlobal('fetch', vi.fn((_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('abort'))))));
        const client = new SearchSuggestionClient();
        const timeout = client.get('bing', 'timeout');
        await vi.advanceTimersByTimeAsync(3001);
        expect(await timeout).toEqual([]);
        const controller = new AbortController();
        const pending = client.get('google', 'cancel', controller.signal);
        await vi.advanceTimersByTimeAsync(0);
        controller.abort();
        expect(await pending).toEqual([]);
    });
});
