import { SUGGESTION_SOURCES, normalizeSearchQuery } from './search-data.js';

const PROVIDERS = Object.freeze({
    bing: { url: 'https://api.bing.com/osjson.aspx', params: { query: '' }, key: 'query' },
    google: { url: 'https://suggestqueries.google.com/complete/search', params: { client: 'firefox' }, key: 'q' },
    baidu: { url: 'https://suggestion.baidu.com/su', params: { action: 'opensearch' }, key: 'wd', encoding: 'gb18030' },
    duckduckgo: { url: 'https://duckduckgo.com/ac/', params: { type: 'list' }, key: 'q' },
    brave: { url: 'https://search.brave.com/api/suggest', params: {}, key: 'q' },
    yahoo: { url: 'https://search.yahoo.com/sugg/gossip/gossip-us-ura/', params: { output: 'sd1' }, key: 'command' },
    yandex: { url: 'https://suggest.yandex.com/suggest-ya.cgi', params: { v: '4' }, key: 'part' },
    naver: { url: 'https://ac.search.naver.com/nx/ac', params: { st: '100', r_format: 'json', r_enc: 'UTF-8', r_unicode: '0', t_koreng: '1', ans: '2', run: '2' }, key: 'q' }
});
const MAX_BYTES = 64 * 1024;

export function resolveSuggestionProvider(engine, source = 'bing') {
    if (['default', 'sogou', 'ecosia'].includes(engine)) return SUGGESTION_SOURCES.includes(source) ? source : 'bing';
    return Object.hasOwn(PROVIDERS, engine) ? engine : null;
}

export function parseSuggestions(provider, data) {
    const values = provider === 'yahoo' ? data?.r?.map(item => item?.k)
        : provider === 'naver' ? data?.items?.[0]?.map(item => item?.[0])
            : Array.isArray(data) ? data[1] : [];
    if (!Array.isArray(values)) return [];
    return [...new Set(values.slice(0, 100).map(normalizeSearchQuery).filter(value => value && value.length <= 256))].slice(0, 8);
}

export async function hasSearchTermsConsent() {
    const firefox = globalThis.browser;
    if (!firefox?.runtime?.getManifest()?.browser_specific_settings?.gecko?.data_collection_permissions) return true;
    try { return await firefox.permissions.contains({ data_collection: ['searchTerms'] }); }
    catch { return false; }
}

export class SearchSuggestionClient {
    constructor() { this.cache = new Map(); this.cooldowns = new Map(); }
    clear() { this.cache.clear(); }

    async get(provider, input, signal) {
        const query = normalizeSearchQuery(input);
        if (!Object.hasOwn(PROVIDERS, provider) || !query || query.length > 256 || signal?.aborted || !(await hasSearchTermsConsent())) return [];
        if (signal?.aborted) return [];
        const cacheKey = `${provider}:${query}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.at < 60000) return cached.items;
        if ((this.cooldowns.get(provider) || 0) > Date.now()) return [];
        const config = PROVIDERS[provider];
        const url = new URL(config.url);
        url.search = new URLSearchParams({ ...config.params, [config.key]: query }).toString();
        const controller = new AbortController();
        const abort = () => controller.abort();
        signal?.addEventListener('abort', abort, { once: true });
        const timer = setTimeout(abort, 3000);
        try {
            const response = await fetch(url.href, { signal: controller.signal, credentials: 'omit', redirect: 'error', headers: { Accept: 'application/json' } });
            if (!response.ok) {
                this.cooldowns.set(provider, Date.now() + (response.status === 429 ? 60000 : 5000));
                return [];
            }
            if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Oversized suggestions');
            const reader = response.body.getReader();
            const chunks = [];
            let size = 0;
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    size += value.length;
                    if (size > MAX_BYTES) { await reader.cancel(); throw new Error('Oversized suggestions'); }
                    chunks.push(value);
                }
            } finally { reader.releaseLock(); }
            const bytes = new Uint8Array(size);
            let offset = 0;
            for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
            const items = parseSuggestions(provider, JSON.parse(new TextDecoder(config.encoding || 'utf-8').decode(bytes)));
            if (controller.signal.aborted) return [];
            if (this.cache.size >= 100) this.cache.delete(this.cache.keys().next().value);
            this.cache.set(cacheKey, { at: Date.now(), items });
            return items;
        } catch {
            if (!controller.signal.aborted) this.cooldowns.set(provider, Date.now() + 5000);
            return [];
        } finally {
            clearTimeout(timer);
            signal?.removeEventListener('abort', abort);
        }
    }
}
