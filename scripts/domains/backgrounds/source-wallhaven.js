import { t } from '../../platform/i18n.js';
import { fetchWithTimeout } from '../../shared/net.js';

const API = 'https://wallhaven.cc/api/v1/';
const RATE_KEY = 'emberWallhavenNextRequest';
let nextRequest = 0;
let requestQueue = Promise.resolve();

// One shared slot per 1.5 seconds across extension pages: at most 40/minute.
// Keys are sent only to the fixed API origin, never in URLs or image requests.
async function request(path, apiKey, params = {}) {
    const run = async () => {
        const session = globalThis.chrome?.storage?.session;
        const stored = session ? await session.get(RATE_KEY) : {};
        const next = Math.max(nextRequest, Number(stored[RATE_KEY]) || 0);
        const wait = next - Date.now();
        if (wait > 1600) throw new Error(t('bgApiRateLimitWithSource', { source: 'Wallhaven' }));
        if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
        nextRequest = Date.now() + 1500;
        if (session) await session.set({ [RATE_KEY]: nextRequest });
        const url = new URL(path, API);
        for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
        const key = typeof apiKey === 'string' ? apiKey.trim() : '';
        return fetchWithTimeout(url.href, {
            credentials: 'omit', redirect: 'error',
            headers: key ? { 'X-API-Key': key } : {}
        }, 20000, async response => {
            if (response.status === 429) {
                const raw = response.headers?.get('Retry-After');
                const seconds = Number(raw);
                const retryMs = raw && Number.isFinite(seconds) ? seconds * 1000 : Date.parse(raw) - Date.now();
                nextRequest = Date.now() + Math.max(60000, Math.min(retryMs || 60000, 3600000));
                if (session) await session.set({ [RATE_KEY]: nextRequest });
                throw new Error(t('bgApiRateLimitWithSource', { source: 'Wallhaven' }));
            }
            if (response.status === 401) throw new Error(t('bgApiKeyInvalidWithSource', { source: 'Wallhaven' }));
            if (response.status === 403 || response.status === 404) throw new Error(t('wallhavenCollectionUnavailable'));
            if (!response.ok) throw new Error(t('bgApiRequestFailed', { source: 'Wallhaven', status: response.status }));
            return response.json();
        });
    };
    const locked = () => globalThis.navigator?.locks?.request
        ? navigator.locks.request('ember-tab:wallhaven-api', { mode: 'exclusive' }, run) : run();
    const pending = requestQueue.then(locked, locked);
    requestQueue = pending.catch(() => {});
    return pending;
}

export function validateWallhavenCollection(settings = {}) {
    const username = String(settings?.username || '').trim();
    const collectionId = String(settings?.collectionId || '').trim();
    if (!username && !collectionId) return null;
    if (!/^[\p{L}\p{N}_-]{1,64}$/u.test(username) || !/^[1-9][0-9]{0,11}$/.test(collectionId)) {
        throw new Error(t('wallhavenCollectionInvalid'));
    }
    return { username, collectionId };
}

function imageUrl(value, host) {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && url.hostname === host && !url.port && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
}

export async function fetchWallhavenBackground(apiKey = '', settings = {}) {
    const collection = validateWallhavenCollection(settings);
    let selected;
    if (collection) {
        const path = `collections/${encodeURIComponent(collection.username)}/${collection.collectionId}`;
        const first = await request(path, apiKey, { purity: '100', page: 1 });
        const total = Number(first.meta?.total);
        const perPage = Number(first.meta?.per_page);
        if (!Array.isArray(first.data) || !Number.isSafeInteger(total) || total <= 0) throw new Error(t('bgNoResults'));
        if (!Number.isSafeInteger(perPage) || perPage <= 0 || perPage > 100) throw new Error(t('bgApiDataError', { source: 'Wallhaven' }));
        // Select an index across the entire collection, including a partial last page.
        const index = Math.floor(Math.random() * total);
        const page = Math.floor(index / perPage) + 1;
        const result = page === 1 ? first : await request(path, apiKey, { purity: '100', page });
        selected = result.data?.[index % perPage];
    } else {
        const result = await request('search', apiKey, { purity: '100', sorting: 'random', categories: '111' });
        selected = result.data?.[0];
    }
    if (!selected || !/^[a-z0-9]{6}$/.test(selected.id)) throw new Error(t('bgNoResults'));
    const { data } = await request(`w/${selected.id}`, apiKey);
    const full = imageUrl(data?.path, 'w.wallhaven.cc');
    if (data?.id !== selected.id || data?.purity !== 'sfw' || !full) throw new Error(t('bgApiDataError', { source: 'Wallhaven' }));
    return {
        format: 'image', provider: 'wallhaven', id: data.id,
        urls: { full, small: full, thumb: imageUrl(data.thumbs?.large, 'th.wallhaven.cc') || full },
        downloadUrl: full,
        username: String(data.uploader?.username || ''),
        userUrl: `https://wallhaven.cc/w/${data.id}`,
        page: `https://wallhaven.cc/w/${data.id}`,
        color: data.colors?.[0], width: data.dimension_x, height: data.dimension_y
    };
}

export function createWallhavenProvider(settings = {}) {
    return { name: 'Wallhaven', requiresApiKey: false, fetchRandom: apiKey => fetchWallhavenBackground(apiKey, settings) };
}
