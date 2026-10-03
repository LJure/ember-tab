import { isOwnChromeFaviconUrl } from './extension-urls.js';

// Public HTTP shortcuts often have HTTPS counterparts. Use those for discovery
// without changing navigation or requesting additional HTTP host permissions.
export function preferSecureIconPageUrl(value) {
    const url = new URL(value);
    const host = url.hostname;
    const local = !host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') ||
        /\.(localhost|local|test|invalid|example)$/i.test(host);
    if (url.protocol === 'http:' && !local && !url.port) url.protocol = 'https:';
    return url.href;
}

// Keep the deadline active through body consumption, and stop oversized streams
// before buffering the entire response in the extension process.
export async function fetchLimited(url, accept, maxBytes, timeoutMs = 3000) {
    return fetchBounded(url, accept, maxBytes, timeoutMs, false);
}

// Favicon links often precede a large inline application payload. A bounded HTML
// prefix still contains useful metadata; image and manifest bodies must remain complete.
export async function fetchPageMetadata(url, maxBytes, timeoutMs = 3000) {
    return fetchBounded(url, 'text/html,application/xhtml+xml', maxBytes, timeoutMs, true);
}

async function fetchBounded(url, accept, maxBytes, timeoutMs, allowPartial) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            method: 'GET', credentials: 'omit', headers: { Accept: accept }, signal: controller.signal
        });
        if (!response.ok) { controller.abort(); return { ok: false, error: `HTTP ${response.status}` }; }
        if (!allowPartial && Number(response.headers.get('content-length') || 0) > maxBytes) {
            controller.abort();
            return { ok: false, error: 'Response too large' };
        }
        const chunks = [];
        let length = 0;
        let truncated = false;
        const reader = response.body?.getReader();
        if (reader) {
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    if (allowPartial && value.byteLength >= maxBytes - length) {
                        chunks.push(value.subarray(0, maxBytes - length));
                        length = maxBytes;
                        truncated = true;
                        await reader.cancel();
                        controller.abort();
                        break;
                    }
                    length += value.byteLength;
                    if (length > maxBytes) {
                        controller.abort();
                        return { ok: false, error: 'Response too large' };
                    }
                    chunks.push(value);
                }
            } finally {
                reader.releaseLock();
            }
        } else {
            if (allowPartial) {
                controller.abort();
                return { ok: false, error: 'Streaming response unavailable' };
            }
            const data = new Uint8Array(await response.arrayBuffer());
            length = data.byteLength;
            if (length > maxBytes && !allowPartial) return { ok: false, error: 'Response too large' };
            truncated = length > maxBytes;
            length = Math.min(length, maxBytes);
            chunks.push(data.subarray(0, length));
        }
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        let contentType = response.headers.get('content-type') || '';
        // Chrome's own favicon endpoint can omit MIME headers even for a PNG.
        // Do not infer image types for arbitrary remote hosts or other extensions.
        if (!contentType && isOwnChromeFaviconUrl(url) &&
            [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) {
            contentType = 'image/png';
        }
        return { ok: true, bytes: Array.from(bytes), contentType, finalUrl: response.url || url, ...(truncated ? { truncated: true } : {}) };
    } catch (error) {
        return { ok: false, error: controller.signal.aborted ? 'Request timed out' : String(error) };
    } finally {
        clearTimeout(timer);
    }
}
