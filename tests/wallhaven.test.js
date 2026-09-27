import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { resetMocks } from './setup.js';

let fetchBackground, validate, calls;
const detail = (id = 'abc123') => ({ data: {
    id, purity: 'sfw', path: `https://w.wallhaven.cc/full/ab/wallhaven-${id}.jpg`,
    thumbs: { large: `https://th.wallhaven.cc/lg/ab/${id}.jpg` },
    uploader: { username: 'Uploader' }, dimension_x: 3840, dimension_y: 2160
} });
const response = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
beforeEach(async () => {
    resetMocks();
    vi.resetModules();
    const module = await import('../scripts/domains/backgrounds/source-wallhaven.js');
    fetchBackground = module.fetchWallhavenBackground;
    validate = module.validateWallhavenCollection;
    let now = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => now += 2000);
    calls = vi.fn();
    vi.stubGlobal('fetch', calls);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Wallhaven collections and credential boundaries', () => {
    it('selects across all pages including the short last page and fetches uploader details', async () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.999);
        calls.mockResolvedValueOnce(response({ data: [{ id: 'first1' }], meta: { total: 25, per_page: 24 } }))
            .mockResolvedValueOnce(response({ data: [{ id: 'abc123' }] }))
            .mockResolvedValueOnce(response(detail()));
        const bg = await fetchBackground('private-key', { username: 'Owner', collectionId: '123' });
        expect(calls).toHaveBeenCalledTimes(3);
        expect(calls.mock.calls[1][0]).toBe('https://wallhaven.cc/api/v1/collections/Owner/123?purity=100&page=2');
        for (const [url, options] of calls.mock.calls) {
            expect(url).not.toContain('private-key');
            expect(new URL(url).origin).toBe('https://wallhaven.cc');
            expect(options.headers).toEqual({ 'X-API-Key': 'private-key' });
            expect(options.redirect).toBe('error');
            expect(options.credentials).toBe('omit');
        }
        expect(bg).toMatchObject({ provider: 'wallhaven', username: 'Uploader', page: 'https://wallhaven.cc/w/abc123' });
        expect(bg.urls.full).toBe(bg.urls.small);
    });
    it('uses public collections without a key and reuses page one', async () => {
        calls.mockResolvedValueOnce(response({ data: [{ id: 'abc123' }], meta: { total: 1, per_page: 24 } }))
            .mockResolvedValueOnce(response(detail()));
        await fetchBackground('', { username: 'Owner', collectionId: '123' });
        expect(calls).toHaveBeenCalledTimes(2);
        expect(calls.mock.calls[0][1].headers).toEqual({});
    });
    it('uses random search only when both collection fields are empty', async () => {
        calls.mockResolvedValueOnce(response({ data: [{ id: 'abc123' }] })).mockResolvedValueOnce(response(detail()));
        await fetchBackground();
        expect(calls.mock.calls[0][0]).toContain('/search?purity=100&sorting=random');
    });
    it.each([{ username: 'Owner' }, { collectionId: '123' }, { username: '../search', collectionId: '123' }])('rejects incomplete or unsafe collection settings: %o', async settings => {
        await expect(fetchBackground('', settings)).rejects.toThrow();
        expect(calls).not.toHaveBeenCalled();
    });
    it.each([401, 403, 404, 500])('does not fall back to random search for a collection error %s', async status => {
        calls.mockResolvedValueOnce(response({}, status));
        await expect(fetchBackground('key', { username: 'Owner', collectionId: '1' })).rejects.toThrow();
        expect(calls).toHaveBeenCalledTimes(1);
    });
    it('honors a 429 cooldown without retrying requests', async () => {
        calls.mockResolvedValueOnce(response({}, 429, { 'Retry-After': '120' }));
        await expect(fetchBackground()).rejects.toThrow();
        await expect(fetchBackground()).rejects.toThrow();
        expect(calls).toHaveBeenCalledTimes(1);
    });
    it('does not search outside an empty collection', async () => {
        calls.mockResolvedValueOnce(response({ data: [], meta: { total: 0, per_page: 24 } }));
        await expect(fetchBackground('', { username: 'Owner', collectionId: '1' })).rejects.toThrow();
        expect(calls).toHaveBeenCalledTimes(1);
    });
    it.each(['https://unexpected.example/image.jpg', 'http://w.wallhaven.cc/image.jpg', 'https://key@w.wallhaven.cc/image.jpg'])('rejects unexpected image targets: %s', async path => {
        calls.mockResolvedValueOnce(response({ data: [{ id: 'abc123' }] }))
            .mockResolvedValueOnce(response({ data: { ...detail().data, path } }));
        await expect(fetchBackground()).rejects.toThrow();
        expect(calls).toHaveBeenCalledTimes(2);
    });
    it('rejects a detail response whose content rating changed', async () => {
        calls.mockResolvedValueOnce(response({ data: [{ id: 'abc123' }] }))
            .mockResolvedValueOnce(response({ data: { ...detail().data, purity: 'nsfw' } }));
        await expect(fetchBackground()).rejects.toThrow();
    });
    it('accepts whitespace-trimmed collection input', () => {
        expect(validate({ username: ' Owner ', collectionId: ' 12 ' })).toEqual({ username: 'Owner', collectionId: '12' });
    });
});
