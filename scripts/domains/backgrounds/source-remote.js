import { createWallhavenProvider } from './source-wallhaven.js';
import { API_CONFIG } from './types.js';
import { t } from '../../platform/i18n.js';
import { fetchWithRetry } from '../../shared/net.js';

const PEXELS_RANDOM_PAGE_MAX = 25;
const BING_ENDPOINT = 'https://www.bing.com/HPImageArchive.aspx';
const BING_DEFAULT_MARKET = 'en-US';

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalizeQuery(query) {
    if (typeof query !== 'string') return '';
    const trimmed = query.trim();
    return trimmed.length > 0 ? trimmed : '';
}

function normalizeLocaleToMarket(locale) {
    if (typeof locale !== 'string') return '';
    const normalized = locale.trim().replace(/_/g, '-');
    if (!normalized) return '';

    const parts = normalized.split('-').filter(Boolean);
    const language = String(parts[0] || '').toLowerCase();
    if (!/^[a-z]{2,3}$/.test(language)) return '';

    const region = parts.find((part, index) => index > 0 && /^[a-z]{2}$/i.test(part));
    if (!region) return '';

    return `${language}-${region.toUpperCase()}`;
}

function resolveBingMarket() {
    const uiLanguage = (typeof chrome !== 'undefined' && typeof chrome.i18n?.getUILanguage === 'function')
        ? chrome.i18n.getUILanguage()
        : '';
    const navigatorLanguage = (typeof navigator !== 'undefined' && typeof navigator.language === 'string')
        ? navigator.language
        : '';

    return (
        normalizeLocaleToMarket(uiLanguage) ||
        normalizeLocaleToMarket(navigatorLanguage) ||
        BING_DEFAULT_MARKET
    );
}

function appendImageParams(baseUrl, params) {
    if (!baseUrl || typeof baseUrl !== 'string') return baseUrl;

    try {
        const u = new URL(baseUrl);
        for (const [key, value] of Object.entries(params || {})) {
            if (value === undefined || value === null || value === '') continue;
            u.searchParams.set(key, String(value));
        }
        return u.toString();
    } catch {
        const serialized = new URLSearchParams(
            Object.entries(params || {}).filter(([, value]) => value !== undefined && value !== null && value !== '')
                .map(([key, value]) => [key, String(value)])
        ).toString();
        if (!serialized) return baseUrl;
        return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${serialized}`;
    }
}

async function fetchWithProviderRetry(url, options = {}) {
    try {
        return await fetchWithRetry(url, options, {
            timeoutMs: API_CONFIG.timeout,
            retryCount: API_CONFIG.retryCount,
            retryDelayMs: API_CONFIG.retryDelay,
            shouldRetry: (res) => res.status >= 500
        });
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new Error(t('bgRequestTimeout'), { cause: error });
        }
        throw error;
    }
}

function getHeaderValue(response, key) {
    if (!response?.headers?.get) return '';
    return response.headers.get(key) || response.headers.get(key.toLowerCase()) || '';
}

function isRateLimitDetail(text) {
    if (!text || typeof text !== 'string') return false;
    const normalized = text.toLowerCase();
    return normalized.includes('rate limit') ||
        normalized.includes('too many requests') ||
        normalized.includes('quota exceeded') ||
        normalized.includes('limit exceeded');
}

function isAuthFailureDetail(text) {
    if (!text || typeof text !== 'string') return false;
    const normalized = text.toLowerCase();
    return normalized.includes('invalid access key') ||
        normalized.includes('invalid api key') ||
        normalized.includes('invalid token') ||
        normalized.includes('access token is invalid') ||
        normalized.includes('unauthorized');
}

async function readErrorText(response) {
    try {
        return (await response.text()).trim();
    } catch {
        return '';
    }
}

async function handleApiError(response, source, { treatForbiddenAsInvalid = true } = {}) {
    if (response.status === 401) {
        throw new Error(t('bgApiKeyInvalidWithSource', { source }));
    }

    if (response.status === 429) {
        throw new Error(t('bgApiRateLimitWithSource', { source }));
    }

    if (response.status === 403) {
        const remainingRaw = getHeaderValue(response, 'X-Ratelimit-Remaining');
        const remaining = Number.parseInt(remainingRaw, 10);
        if (Number.isFinite(remaining) && remaining <= 0) {
            throw new Error(t('bgApiRateLimitWithSource', { source }));
        }

        const detail = await readErrorText(response);
        if (isRateLimitDetail(detail)) {
            throw new Error(t('bgApiRateLimitWithSource', { source }));
        }
        if (isAuthFailureDetail(detail)) {
            throw new Error(t('bgApiKeyInvalidWithSource', { source }));
        }

        if (treatForbiddenAsInvalid) {
            throw new Error(t('bgApiKeyInvalidWithSource', { source }));
        }
        throw new Error(t('bgApiRequestFailed', { source, status: response.status }));
    }

    if (!response.ok) {
        throw new Error(t('bgApiRequestFailed', { source, status: response.status }));
    }
}

function validateApiKey(apiKey, source) {
    if (!apiKey || typeof apiKey !== 'string') {
        throw new Error(t('bgApiKeyRequiredWithSource', { source }));
    }
    if (apiKey.trim().length < 10) {
        throw new Error(t('bgApiKeyFormatInvalid', { source }));
    }
}

function pickRandomItem(items) {
    if (!Array.isArray(items) || items.length === 0) return null;
    return items[Math.floor(Math.random() * items.length)] || null;
}

function buildPexelsUrls(photo) {
    const baseUrl = photo?.src?.original || photo?.src?.large2x || photo?.src?.large || photo?.src?.landscape;

    if (!baseUrl) {
        return {
            full: photo?.src?.large2x || photo?.src?.large || photo?.src?.landscape,
            small: photo?.src?.landscape || photo?.src?.medium
        };
    }

    return {
        full: baseUrl,
        small: appendImageParams(baseUrl, {
            w: 1280,
            auto: 'compress',
            cs: 'tinysrgb',
            fm: 'webp'
        })
    };
}

async function fetchPexelsCuratedPhotos(apiKey, page, perPage) {
    const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage)
    });

    const response = await fetchWithProviderRetry(
        `https://api.pexels.com/v1/curated?${params}`,
        { headers: { 'Authorization': apiKey.trim() } }
    );

    await handleApiError(response, 'Pexels');

    const data = await response.json();
    return Array.isArray(data?.photos) ? data.photos : [];
}

async function fetchPexelsSearchPhotos(apiKey, query, page, perPage) {
    const params = new URLSearchParams({
        query,
        page: String(page),
        per_page: String(perPage),
        locale: 'en-US'
    });

    const response = await fetchWithProviderRetry(
        `https://api.pexels.com/v1/search?${params}`,
        { headers: { 'Authorization': apiKey.trim() } }
    );

    await handleApiError(response, 'Pexels');

    const data = await response.json();
    return Array.isArray(data?.photos) ? data.photos : [];
}

export const pexelsProvider = {
    name: 'Pexels',
    requiresApiKey: true,

    async fetchRandom(apiKey, query) {
        validateApiKey(apiKey, 'Pexels');

        const normalizedQuery = normalizeQuery(query);
        const randomPage = randomInt(1, PEXELS_RANDOM_PAGE_MAX);
        const perPage = 80;

        let photos = normalizedQuery
            ? await fetchPexelsSearchPhotos(apiKey, normalizedQuery, randomPage, perPage)
            : await fetchPexelsCuratedPhotos(apiKey, randomPage, perPage);

        if (normalizedQuery && photos.length === 0 && randomPage !== 1) {
            photos = await fetchPexelsSearchPhotos(apiKey, normalizedQuery, 1, perPage);
        }

        if (!photos || photos.length === 0) {
            throw new Error(t('bgNoResults'));
        }

        const randomPhoto = pickRandomItem(photos);
        if (!randomPhoto) {
            throw new Error(t('bgNoResults'));
        }

        const urls = buildPexelsUrls(randomPhoto);
        const originalUrl = randomPhoto?.src?.original || urls.full;

        return {
            format: 'image',
            id: String(randomPhoto.id || `pexels-${Date.now()}`),
            urls,
            downloadUrl: originalUrl,
            username: randomPhoto.photographer,
            provider: 'pexels',
            userUrl: randomPhoto.photographer_url || '',
            page: randomPhoto.url,
            color: randomPhoto.avg_color,
            width: Number.isFinite(randomPhoto.width) ? randomPhoto.width : undefined,
            height: Number.isFinite(randomPhoto.height) ? randomPhoto.height : undefined
        };
    }
};

function buildBingUrls(image) {
    const urlPath = typeof image?.url === 'string' ? image.url : '';
    const urlBase = typeof image?.urlbase === 'string' ? image.urlbase : '';

    if (urlBase) {
        const queryJoiner = urlBase.includes('?') ? '&' : '?';
        return {
            full: `https://www.bing.com${urlBase}_UHD.jpg${queryJoiner}rf=LaDigue_UHD.jpg&pid=hp`,
            small: `https://www.bing.com${urlBase}_1366x768.jpg${queryJoiner}rf=LaDigue_1366x768.jpg&pid=hp`
        };
    }

    const full = urlPath ? `https://www.bing.com${urlPath}` : '';
    return { full, small: full };
}

export const bingProvider = {
    name: 'Bing',
    requiresApiKey: false,

    async fetchRandom() {
        const market = resolveBingMarket();
        const params = new URLSearchParams({
            format: 'js',
            idx: '0',
            n: '1',
            mkt: market
        });

        const response = await fetchWithProviderRetry(`${BING_ENDPOINT}?${params}`);
        if (!response.ok) {
            throw new Error(t('bgApiRequestFailed', { source: 'Bing', status: response.status }));
        }

        const data = await response.json();
        const image = Array.isArray(data?.images) ? data.images[0] : null;
        if (!image) {
            throw new Error(t('bgNoResults'));
        }

        const urls = buildBingUrls(image);
        if (!urls.full || !urls.small) {
            throw new Error(t('bgApiDataError', { source: 'Bing' }));
        }

        const startDate = String(image.startdate || '').trim();
        return {
            format: 'image',
            id: `bing-${startDate || Date.now()}-${market.toLowerCase()}`,
            urls,
            downloadUrl: urls.full,
            username: image.copyright || 'Bing',
            page: 'https://www.bing.com',
            color: image?.dominantColor || undefined
        };
    }
};

export function getProvider(type, settings = {}) {
    switch (type) {
        case 'wallhaven': return createWallhavenProvider(settings.wallhaven);
        case 'pexels': return pexelsProvider;
        case 'bing': return bingProvider;
        default: return null;
    }
}
