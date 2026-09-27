import { afterEach, describe, expect, it, vi } from 'vitest';
import { chromeFaviconUrl, isOwnChromeFaviconUrl, isOwnExtensionUrl } from '../scripts/platform/extension-urls.js';
import { isAllowedIconFetchUrl } from '../scripts/platform/icon-fetch-bridge.js';
import { getFaviconUrlCandidates } from '../scripts/shared/favicon.js';
import { parsePage } from '../scripts/platform/favicon-dom.js';

afterEach(() => vi.restoreAllMocks());
const runtime = scheme => vi.spyOn(chrome.runtime, 'getURL').mockImplementation(p => `${scheme}://own-id/${p.replace(/^\//, '')}`);
describe('Firefox resource and favicon boundaries', () => {
    it('does not generate Chrome favicon URLs in Firefox', () => {
        runtime('moz-extension');
        expect(chromeFaviconUrl('https://example.com')).toBe('');
        expect(getFaviconUrlCandidates('https://example.com')).toEqual([
            'https://example.com/apple-touch-icon.png', 'https://example.com/favicon.ico', 'https://example.com/favicon.png'
        ]);
        expect(isAllowedIconFetchUrl('moz-extension://own-id/_favicon/')).toBe(false);
    });
    it.each(['moz-extension', 'chrome-extension'])('allows only this extension resource for %s', scheme => {
        runtime(scheme);
        expect(isOwnExtensionUrl(`${scheme}://own-id/assets/backgrounds/default.jpg`)).toBe(true);
        expect(isOwnExtensionUrl(`${scheme}://other-id/assets/backgrounds/default.jpg`)).toBe(false);
        expect(isOwnExtensionUrl('javascript:alert(1)')).toBe(false);
    });
    it('keeps the exact Chrome favicon endpoint, rejects prefix lookalikes', () => {
        runtime('chrome-extension');
        expect(isOwnChromeFaviconUrl(chromeFaviconUrl('https://example.com', 128))).toBe(true);
        for (const value of ['chrome-extension://own-id/_favicon-secret', 'chrome-extension://own-id/_favicon/../manifest.json',
            'chrome-extension://other-id/_favicon/', 'moz-extension://own-id/_favicon/']) {
            expect(isAllowedIconFetchUrl(value)).toBe(false);
        }
    });
    it('resolves document base URLs and bounds metadata fan-out', () => {
        const result = parsePage('<base href="/images/"><link rel="icon" href="icon.svg">' +
            Array.from({length: 100}, (_, i) => `<link rel="manifest" href="${i}.json"><link rel="icon" href="${i}.png">`).join(''), 'https://example.com/a/page');
        expect(result.candidates[0].url).toBe('https://example.com/images/icon.svg');
        expect(result.candidates).toHaveLength(64);
        expect(result.manifests).toHaveLength(3);
    });
});
