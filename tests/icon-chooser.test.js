import { Blob } from 'node:buffer';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IconChooser } from '../scripts/domains/quicklinks/icon-chooser.js';
import { iconCache } from '../scripts/platform/icon-cache.js';
import { discoverIconCandidatesViaBackground } from '../scripts/platform/icon-fetch-bridge.js';
import { preferSecureIconPageUrl } from '../scripts/platform/icon-network.js';
import { uniqueIconCandidates } from '../scripts/platform/icon-quality.js';

vi.mock('../scripts/platform/icon-fetch-bridge.js', () => ({ discoverIconCandidatesViaBackground: vi.fn() }));
vi.mock('../scripts/platform/i18n.js', () => ({ t: key => key }));
const candidate = (byte, size = 128) => ({ blob: new Blob([new Uint8Array(64).fill(byte)], { type: 'image/png' }), meta: { width: size, height: size, sourceKind: 'google', sourceUrl: 'https://icons.test/' + byte } });
let context, chooser, selected;
beforeEach(() => {
    vi.stubGlobal('crypto', webcrypto);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:' + Math.random());
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(iconCache, 'init').mockResolvedValue();
    vi.spyOn(iconCache, 'get').mockResolvedValue(null);
    vi.spyOn(iconCache, 'set').mockResolvedValue(true);
    vi.spyOn(iconCache, 'removeFromNegativeCache').mockImplementation(() => {});
    context = { url: 'http://news.qq.com/', mode: 'auto' };
    document.body.innerHTML = '<button id="button"></button><section id="panel" class="hidden"><p id="status"></p><div id="list"></div></section>';
    selected = vi.fn();
    chooser = new IconChooser({ ...Object.fromEntries(['button', 'panel', 'status', 'list'].map(id => [id, document.getElementById(id)])), readContext: () => context, onSelected: selected });
    discoverIconCandidatesViaBackground.mockResolvedValue([candidate(1), candidate(2)]);
});
afterEach(() => { chooser.reset(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('manual icon choice', () => {
    it('browsing preserves the cache; clicking stores exact selected bytes and local preference', async () => {
        await chooser.load();
        expect(chooser.list.children).toHaveLength(2);
        expect(iconCache.set).not.toHaveBeenCalled();
        chooser.list.children[1].click();
        await vi.waitFor(() => expect(selected).toHaveBeenCalledOnce());
        const [, blob, source, meta] = iconCache.set.mock.calls[0];
        expect(Array.from(new Uint8Array(await blob.arrayBuffer()))).toEqual(Array(64).fill(2));
        expect(source).toBe('https://icons.test/2');
        expect(meta.userSelected).toBe(true);
        expect(chooser.list.children[1].getAttribute('aria-pressed')).toBe('true');
        chooser.reset();
        expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    });
    it('keeps a current icon when providers fail, and deduplicates identical candidate bytes', async () => {
        const current = candidate(1);
        iconCache.get.mockResolvedValue({ blob: current.blob, ...current.meta });
        await chooser.load();
        expect(chooser.list.children).toHaveLength(2);
        expect(chooser.list.children[0].textContent).toContain('iconChoiceCurrent');
        discoverIconCandidatesViaBackground.mockResolvedValue([]);
        await chooser.load();
        expect(chooser.list.children).toHaveLength(1);
    });
    it('discards responses after closing, changing the URL or switching icon mode', async () => {
        for (const change of [() => chooser.reset(), () => { context.url = 'https://other.test/'; }, () => { context.mode = 'text'; }]) {
            context = { url: 'http://news.qq.com/', mode: 'auto' };
            let finish;
            discoverIconCandidatesViaBackground.mockReturnValue(new Promise(resolve => { finish = resolve; }));
            const pending = chooser.load();
            await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
            change(); finish([candidate(2)]); await pending;
            expect(chooser.list.children).toHaveLength(0);
        }
        expect(iconCache.set).not.toHaveBeenCalled();
    });
    it('does not mark a failed cache write as applied', async () => {
        iconCache.set.mockResolvedValue(false);
        await chooser.load(); chooser.list.children[0].click();
        await vi.waitFor(() => expect(chooser.status.textContent).toBe('iconCacheRefreshFailed'));
        expect(selected).not.toHaveBeenCalled();
    });
});
describe('discovery bounds and secure URLs', () => {
    it('tries HTTPS for public default-port HTTP URLs while preserving local and explicit-port targets', () => {
        expect(preferSecureIconPageUrl('http://news.qq.com/a?q=1')).toBe('https://news.qq.com/a?q=1');
        for (const url of ['http://127.0.0.1/a', 'http://10.0.0.2/a', 'http://[::1]/', 'http://localhost/a', 'http://host.local/a', 'http://example.com:8080/a', 'https://example.com/a']) expect(preferSecureIconPageUrl(url)).toBe(url);
    });
    it('deduplicates by content and limits chooser count and total binary size', async () => {
        const icon = (byte, source = 'google') => ({ sourceKind: source, width: 128, height: 128, data: [byte, byte], score: 50, url: `https://test/${source}/${byte}` });
        const results = [icon(1), icon(1, 'vemetric'), icon(2), icon(3)];
        expect((await uniqueIconCandidates(results)).map(x => x.data[0])).toEqual([1, 2, 3]);
        expect(await uniqueIconCandidates(results, { maxCount: 2 })).toHaveLength(2);
        expect(await uniqueIconCandidates(results, { maxBytes: 3 })).toHaveLength(1);
    });
});
