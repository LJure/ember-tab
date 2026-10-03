import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchLimited, fetchPageMetadata } from '../scripts/platform/icon-network.js';
import { parsePage } from '../scripts/platform/favicon-dom.js';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('bounded favicon page metadata', () => {
    it('parses early favicon links from an oversized HTML response without retaining its full body', async () => {
        const text = '<link rel="icon" sizes="144x144" href="/clear.png">' + 'x'.repeat(1000);
        vi.stubGlobal('fetch', vi.fn(async () => new Response(text, {
            headers: { 'content-type': 'text/html', 'content-length': String(text.length) }
        })));
        const response = await fetchPageMetadata('https://example.com/', 100);
        expect(response).toMatchObject({ ok: true, truncated: true });
        expect(response.bytes).toHaveLength(100);
        const parsed = parsePage(new TextDecoder().decode(Uint8Array.from(response.bytes)), response.finalUrl);
        expect(parsed.candidates[0]).toMatchObject({ url: 'https://example.com/clear.png', sizeHint: 144 });
        expect(await fetchLimited('https://example.com/icon.png', 'image/*', 100)).toMatchObject({ ok: false, error: 'Response too large' });
    });
    it('cancels an oversized stream at the prefix boundary and does not read its remainder', async () => {
        const read = vi.fn().mockResolvedValueOnce({ value: new Uint8Array(40).fill(65) });
        const cancel = vi.fn().mockResolvedValue();
        const releaseLock = vi.fn();
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, headers: new Headers({ 'content-type': 'text/html' }),
            body: { getReader: () => ({ read, cancel, releaseLock }) }
        })));
        const response = await fetchPageMetadata('https://example.com/', 20);
        expect(response.bytes).toHaveLength(20);
        expect(read).toHaveBeenCalledTimes(1);
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(releaseLock).toHaveBeenCalledTimes(1);
    });
    it('still times out a stalled page body', async () => {
        vi.useFakeTimers();
        vi.stubGlobal('fetch', vi.fn(async (_url, { signal }) => ({ ok: true, headers: new Headers(),
            body: { getReader: () => ({ read: () => new Promise((_resolve, reject) => {
                signal.addEventListener('abort', () => reject(new Error('abort')));
            }), releaseLock: vi.fn() }) }
        })));
        const response = fetchPageMetadata('https://example.com/', 100, 50);
        await vi.advanceTimersByTimeAsync(51);
        expect(await response).toMatchObject({ ok: false, error: 'Request timed out' });
    });
});
