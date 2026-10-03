const FETCH_ICON_MESSAGE = 'fetchIcon';
const DISCOVER_ICON_MESSAGE = 'discoverIcon';

import { isOwnChromeFaviconUrl } from './extension-urls.js';

export function isAllowedIconFetchUrl(url) {
    if (typeof url !== 'string') return false;
    const value = url.trim();
    if (!value) return false;

    if (value.startsWith('blob:') || value.startsWith('data:')) {
        return false;
    }

    try {
        const parsed = new URL(value);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return true;
        }

        return isOwnChromeFaviconUrl(value);
    } catch {
        return false;
    }
}

export function normalizeIconBinaryPayload(data) {
    try {
        if (data instanceof ArrayBuffer) {
            return new Uint8Array(data);
        }
        if (ArrayBuffer.isView(data)) {
            return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        }
        if (Array.isArray(data)) {
            return Uint8Array.from(data);
        }
    } catch {
        return null;
    }
    return null;
}

export async function fetchIconPayloadViaBackground(url, { customIcon = false } = {}) {
    if (!isAllowedIconFetchUrl(url)) return null;

    let response;
    try {
        response = await chrome.runtime.sendMessage({ type: FETCH_ICON_MESSAGE, url, ...(customIcon ? { customIcon: true } : {}) });
    } catch {
        return null;
    }
    if (!response?.success || !response.data) return null;

    const bytes = normalizeIconBinaryPayload(response.data);
    if (!bytes || bytes.byteLength === 0) return null;

    return {
        bytes,
        contentType: response.contentType || 'image/png'
    };
}

export async function fetchIconBlobViaBackground(url, options) {
    const payload = await fetchIconPayloadViaBackground(url, options);
    if (!payload) return null;

    const blob = new Blob([payload.bytes], { type: payload.contentType });
    return blob.size > 0 ? blob : null;
}

export async function discoverIconViaBackground(pageUrl) {
    if (!isAllowedIconFetchUrl(pageUrl)) return null;
    let response;
    try {
        response = await chrome.runtime.sendMessage({ type: DISCOVER_ICON_MESSAGE, url: pageUrl });
    } catch {
        return null;
    }
    if (!response?.success || !response.data) return null;
    const bytes = normalizeIconBinaryPayload(response.data);
    if (!bytes?.byteLength) return null;
    const blob = new Blob([bytes], { type: response.contentType || 'image/png' });
    if (!blob.size) return null;
    return { blob, meta: response.meta || {} };
}

export async function discoverIconCandidatesViaBackground(pageUrl) {
    if (!isAllowedIconFetchUrl(pageUrl)) return [];
    try {
        const response = await chrome.runtime.sendMessage({ type: DISCOVER_ICON_MESSAGE, url: pageUrl, includeCandidates: true });
        if (!response?.success || !Array.isArray(response.candidates)) return [];
        return response.candidates.slice(0, 8).flatMap(candidate => {
            const bytes = normalizeIconBinaryPayload(candidate.data);
            if (!bytes?.byteLength || bytes.byteLength > 512 * 1024) return [];
            return [{ blob: new Blob([bytes], { type: candidate.contentType || 'image/png' }), meta: candidate.meta || {} }];
        });
    } catch {
        return [];
    }
}
