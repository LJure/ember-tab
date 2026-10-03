import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchLimited } from '../scripts/platform/icon-network.js';

afterEach(() => { vi.unstubAllGlobals(); });
const png = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13];
function mockResponse(bytes, type = '') {
    vi.stubGlobal('chrome', { runtime: { getURL: () => 'chrome-extension://ember-test/' } });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(Uint8Array.from(bytes), {
        headers: type ? { 'content-type': type } : {}
    })));
}
describe('Chrome favicon MIME compatibility', () => {
    it('recognizes a PNG without MIME headers only at this extension favicon endpoint', async () => {
        mockResponse(png);
        expect(await fetchLimited('chrome-extension://ember-test/_favicon/?pageUrl=https://example.com', 'image/*', 100))
            .toMatchObject({ ok: true, contentType: 'image/png', bytes: png });
    });
    it.each([
        'https://example.com/favicon.png',
        'chrome-extension://another-extension/_favicon/?pageUrl=https://example.com',
        'chrome-extension://ember-test/other.png'
    ])('does not infer MIME for %s', async url => {
        mockResponse(png);
        expect((await fetchLimited(url, 'image/*', 100)).contentType).toBe('');
    });
    it('does not reclassify invalid bytes or override an explicit MIME header', async () => {
        const url = 'chrome-extension://ember-test/_favicon/?pageUrl=https://example.com';
        mockResponse([1, 2, 3]);
        expect((await fetchLimited(url, 'image/*', 100)).contentType).toBe('');
        mockResponse(png, 'text/plain');
        expect((await fetchLimited(url, 'image/*', 100)).contentType).toBe('text/plain');
    });
});
