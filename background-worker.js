import { fetchLimited } from './scripts/platform/icon-network.js';
import { runFaviconDomTask } from './scripts/platform/favicon-runtime.js';
import { chromeFaviconUrl, isOwnChromeFaviconUrl } from './scripts/platform/extension-urls.js';
import { createBackgroundSettingsDefaults } from './scripts/platform/settings-contract.js';
import { resolveEffectiveFrequency } from './scripts/domains/backgrounds/refresh-policy.js';

const ALARM_NAME = 'refreshBackground';
const FETCH_ICON_MESSAGE = 'fetchIcon';
const DISCOVER_ICON_MESSAGE = 'discoverIcon';
const OFFSCREEN_PARSE_PAGE_MESSAGE = 'faviconOffscreenParsePage';
const OFFSCREEN_PARSE_MANIFEST_MESSAGE = 'faviconOffscreenParseManifest';
const OFFSCREEN_INSPECT_IMAGE_MESSAGE = 'faviconOffscreenInspectImage';
const SHOW_CHANGELOG_MESSAGE = 'showChangelog';
const MAX_ICON_BYTES = 512 * 1024;
const MAX_PAGE_BYTES = 512 * 1024;

const MAX_PRIMARY_CANDIDATES = 12;
let autoRefreshSyncChain = Promise.resolve();


chrome.runtime.onInstalled.addListener(async (details) => {
    try {
        // Clear old timers, resync
        await chrome.alarms.clear(ALARM_NAME);
        await syncAutoRefresh();

        // Initialize default settings on first install
        if (details.reason === 'install') {
            const { backgroundSettings } = await chrome.storage.sync.get({ backgroundSettings: undefined });
            if (!backgroundSettings) {
                await chrome.storage.sync.set({
                    backgroundSettings: createBackgroundSettingsDefaults()
                });
            }
        }

        // Trigger changelog notification broadcast after update
        if (details.reason === 'update') {
            try {
                const version = chrome.runtime.getManifest()?.version || ''
                await chrome.runtime.sendMessage({ type: SHOW_CHANGELOG_MESSAGE, version })
            } catch (error) {
                if (!isExpectedConnectionError(error)) {
                    console.error('[SW] showChangelog broadcast error:', error);
                }
            }
        }
    } catch (error) {
        console.error('[SW] onInstalled error:', error);
    }
});

chrome.runtime.onStartup.addListener(() => {
    syncAutoRefresh().catch(error => {
        console.error('[SW] onStartup error:', error);
    });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== ALARM_NAME) return;

    try {
        const { backgroundSettings } = await chrome.storage.sync.get({ backgroundSettings: null });
        const backgroundType = backgroundSettings?.type || 'files';
        const effectiveFrequency = resolveEffectiveFrequency(
            backgroundType,
            backgroundSettings?.frequency || 'never'
        );

        // Local images and solid colors do not need timed refresh
        if (backgroundType === 'files' || backgroundType === 'color') {
            return;
        }
        if (effectiveFrequency === 'never' || effectiveFrequency === 'tabs') {
            return;
        }

        await notifyRefreshBackground();
    } catch (error) {
        if (!isExpectedConnectionError(error)) {
            console.error('[SW] Alarm handler error:', error);
        }
    }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const handler = message?.type === FETCH_ICON_MESSAGE
        ? handleFetchIcon(message.url)
        : message?.type === DISCOVER_ICON_MESSAGE
            ? handleDiscoverIcon(message.url)
            : null;
    if (!handler) return false;
    handler
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: String(error) }));
    return true;
});

/**
 * Proxy icon fetching (bypass CORS restrictions)
 * @param {string} url - Icon URL
 * @returns {Promise<{ success: boolean, data?: ArrayBuffer, contentType?: string, error?: string }>}
 */
async function handleFetchIcon(url) {
    // Validate URL parameter
    if (!url || typeof url !== 'string') {
        return { success: false, error: 'Invalid URL parameter' };
    }

    // Validate URL format
    let parsedUrl;
    try {
        parsedUrl = new URL(url);

        const isHttp = parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
        const isOwnFaviconApi = isOwnChromeFaviconUrl(url);

        if (!isHttp && !isOwnFaviconApi) {
            return { success: false, error: 'Unsupported URL protocol' };
        }
    } catch {
        return { success: false, error: 'Invalid URL format' };
    }

    const result = await fetchLimited(url, 'image/*', MAX_ICON_BYTES);
    if (!result.ok) return { success: false, error: result.error };
    if (!result.contentType.toLowerCase().startsWith('image/')) return { success: false, error: 'Not an image' };
    const inspection = await runFaviconDomTask({type: OFFSCREEN_INSPECT_IMAGE_MESSAGE, bytes: result.bytes, contentType: result.contentType});
    if (!inspection?.valid) return { success: false, error: 'Invalid image' };
    return { success: true, data: result.bytes, contentType: result.contentType };
}

function isHttpUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function fallbackCandidates(pageUrl) {
    const page = new URL(pageUrl);
    const hostname = page.hostname.replace(/^www\./i, '');
    const chromeCandidates = [128, 64].flatMap(size => {
        const url = chromeFaviconUrl(pageUrl, size);
        return url ? [{url, sourceKind: 'chrome', sizeHint: size, purpose: ''}] : [];
    });
    return {
        primary: [
            ...chromeCandidates,
            { url: `${page.origin}/favicon.ico`, sourceKind: 'conventional', sizeHint: 0, purpose: '' },
            { url: `${page.origin}/favicon.png`, sourceKind: 'conventional', sizeHint: 0, purpose: '' },
            { url: `${page.origin}/apple-touch-icon.png`, sourceKind: 'conventional', sizeHint: 0, purpose: '' }
        ],
        providers: hostname && hostname.includes('.') && !/^[\d.]+$/.test(hostname) && !hostname.includes(':') && !/\.(localhost|local|test|invalid|example)$/i.test(hostname) ? [
            { url: `https://favicon.vemetric.com/${encodeURIComponent(hostname)}?size=128`, sourceKind: 'vemetric', sizeHint: 128, purpose: '' },
            { url: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`, sourceKind: 'google', sizeHint: 128, purpose: '' }
        ] : []
    };
}

function scoreIcon(candidate, inspection, contentType, byteLength) {
    const sourceScores = {
        'html-icon': 55, manifest: 50, 'apple-touch': 42, chrome: 38, conventional: 25, vemetric: 12, google: 8
    };
    const type = String(contentType || '').toLowerCase();
    const formatScore = inspection.isSvg ? 15 : (type.includes('png') || type.includes('webp')) ? 10 : type.includes('icon') ? 6 : 0;
    const purposeScore = !candidate.purpose || candidate.purpose.split(/\s+/).includes('any') ? 5 : 2;
    const pixels = Math.max(inspection.width || 0, inspection.height || 0);
    const sizeScore = inspection.isSvg ? 25 : pixels >= 128 ? 25 : pixels >= 64 ? 20 : pixels >= 32 ? 10 : 0;
    return (sourceScores[candidate.sourceKind] || 0) + formatScore + purposeScore + sizeScore + (byteLength ? 0 : 0);
}

function dedupeCandidates(candidates) {
    const seen = new Set();
    return candidates.filter((candidate) => {
        if (!candidate?.url || seen.has(candidate.url)) return false;
        seen.add(candidate.url);
        return true;
    });
}

async function inspectCandidate(candidate) {
    if (!isHttpUrl(candidate.url) && !isOwnChromeFaviconUrl(candidate.url)) return null;
    const response = await fetchLimited(candidate.url, 'image/*', MAX_ICON_BYTES);
    if (!response.ok || !response.contentType.toLowerCase().startsWith('image/')) return null;
    const inspection = await runFaviconDomTask({
        type: OFFSCREEN_INSPECT_IMAGE_MESSAGE, bytes: response.bytes, contentType: response.contentType
    });
    if (!inspection?.valid) return null;
    const pixels = Math.max(inspection.width || 0, inspection.height || 0);
    return {
        ...candidate,
        data: response.bytes,
        contentType: response.contentType,
        width: inspection.width || 0,
        height: inspection.height || 0,
        isSvg: Boolean(inspection.isSvg),
        score: scoreIcon(candidate, inspection, response.contentType, response.bytes.length),
        lowResolution: !inspection.isSvg && pixels < 32
    };
}

function chooseBestIcon(results) {
    return results.filter(Boolean).sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const aAboveTarget = Math.max(a.width, a.height) >= 128 ? 1 : 0;
        const bAboveTarget = Math.max(b.width, b.height) >= 128 ? 1 : 0;
        if (bAboveTarget !== aAboveTarget) return bAboveTarget - aAboveTarget;
        if (a.data.length !== b.data.length) return a.data.length - b.data.length;
        return a.url.localeCompare(b.url);
    })[0] || null;
}

async function handleDiscoverIcon(pageUrl) {
    if (!isHttpUrl(pageUrl)) return { success: false, error: 'Invalid page URL' };
    try {
        const page = await fetchLimited(pageUrl, 'text/html,application/xhtml+xml', MAX_PAGE_BYTES);
        const parsed = page.ok && /(?:text\/html|application\/xhtml\+xml)/i.test(page.contentType)
            ? await runFaviconDomTask({ type: OFFSCREEN_PARSE_PAGE_MESSAGE, html: new TextDecoder().decode(Uint8Array.from(page.bytes)), pageUrl: page.finalUrl })
            : { candidates: [], manifests: [] };
        const manifestCandidates = (await Promise.all((parsed?.manifests || []).slice(0, 3).map(async manifestUrl => {
            const manifest = await fetchLimited(manifestUrl, 'application/manifest+json,application/json', MAX_PAGE_BYTES);
            if (!manifest.ok) return [];
            const candidates = await runFaviconDomTask({
                type: OFFSCREEN_PARSE_MANIFEST_MESSAGE,
                text: new TextDecoder().decode(Uint8Array.from(manifest.bytes)), manifestUrl: manifest.finalUrl
            });
            return Array.isArray(candidates) ? candidates : [];
        }))).flat();
        const fallback = fallbackCandidates(pageUrl);
        const primary = dedupeCandidates([...(parsed?.candidates || []), ...manifestCandidates, ...fallback.primary])
            .sort((a, b) => (b.sizeHint || 0) - (a.sizeHint || 0)).slice(0, MAX_PRIMARY_CANDIDATES);
        let valid = (await Promise.all(primary.map(inspectCandidate))).filter((result) => result && !result.lowResolution);
        if (valid.length === 0) {
            valid = (await Promise.all(fallback.providers.map(inspectCandidate))).filter(Boolean);
        }
        const best = chooseBestIcon(valid);
        if (!best) return { success: false, error: 'No valid favicon found' };
        return {
            success: true, data: best.data, contentType: best.contentType,
            meta: {
                sourceKind: best.sourceKind, sourceUrl: best.url, width: best.width, height: best.height,
                score: best.score, purpose: best.purpose || '', discoveryVersion: 1
            }
        };
    } catch (error) {
        return { success: false, error: String(error) };
    }
}

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync' || !changes.backgroundSettings) return;

    const { oldValue, newValue } = changes.backgroundSettings;
    const newSettings = newValue;
    if (!newSettings || typeof newSettings !== 'object') return;

    const oldFreq = (oldValue && typeof oldValue === 'object') ? oldValue.frequency : undefined;
    const newFreq = newSettings.frequency;
    const oldType = (oldValue && typeof oldValue === 'object') ? oldValue.type : undefined;
    const newType = newSettings.type;
    if (oldFreq === newFreq && oldType === newType) return;

    syncAutoRefresh().catch(error => {
        console.error('[SW] Storage change sync error:', error);
    });
});

function isExpectedConnectionError(error) {
    if (!error) return false;
    const message = error.message || String(error);
    return (
        message.includes('Could not establish connection') ||
        message.includes('Receiving end does not exist') ||
        message.includes('The message port closed')
    );
}

async function notifyRefreshBackground() {
    try {
        await chrome.runtime.sendMessage({ type: ALARM_NAME });
    } catch (error) {
        if (!isExpectedConnectionError(error)) {
            throw error;
        }
    }
}

async function syncAutoRefresh() {
    autoRefreshSyncChain = autoRefreshSyncChain
        .then(async () => {
            const { backgroundSettings } = await chrome.storage.sync.get({ backgroundSettings: null });
            const interval = backgroundSettings?.frequency || 'never';
            const backgroundType = backgroundSettings?.type || 'files';
            await applyAutoRefresh(interval, backgroundType);
        })
        .catch((error) => {
            console.error('[SW] syncAutoRefresh error:', error);
        });

    return autoRefreshSyncChain;
}

async function applyAutoRefresh(interval, backgroundType) {
    const effectiveInterval = resolveEffectiveFrequency(backgroundType, interval);

    // First clear existing timers
    await chrome.alarms.clear(ALARM_NAME);

    // These cases do not need background timers
    if (
        effectiveInterval === 'never' ||
        effectiveInterval === 'tabs' ||
        backgroundType === 'files' ||
        backgroundType === 'color'
    ) {
        return;
    }

    let periodInMinutes;
    switch (effectiveInterval) {
        case 'hour':
            periodInMinutes = 60;
            break;
        case 'day':
            periodInMinutes = 24 * 60;
            break;
        default:
            return;
    }

    // Chrome MV3 minimum interval is 1 minute, all values here satisfy this
    await chrome.alarms.create(ALARM_NAME, {
        periodInMinutes,
        // Set initial trigger delay to avoid triggering immediately after startup
        delayInMinutes: Math.min(3, periodInMinutes)
    });
}
