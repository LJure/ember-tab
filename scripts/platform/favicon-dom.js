const PARSE_PAGE_MESSAGE = 'faviconOffscreenParsePage';
const PARSE_MANIFEST_MESSAGE = 'faviconOffscreenParseManifest';
const INSPECT_IMAGE_MESSAGE = 'faviconOffscreenInspectImage';

function toHttpUrl(value, baseUrl) {
    try {
        const url = new URL(value, baseUrl);
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
    } catch {
        return '';
    }
}

function sizeHint(value) {
    if (typeof value !== 'string') return 0;
    return value.split(/\s+/).reduce((largest, token) => {
        const match = /^(\d+)x(\d+)$/i.exec(token);
        return match ? Math.max(largest, Number(match[1]), Number(match[2])) : largest;
    }, 0);
}

function parsePage(html, pageUrl, { colorScheme = 'light' } = {}) {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const baseUrl = toHttpUrl(doc.querySelector('base[href]')?.getAttribute('href') || pageUrl, pageUrl) || pageUrl;
    const candidates = [];
    const manifests = [];
    doc.querySelectorAll('link[href]').forEach((link) => {
        const rels = (link.getAttribute('rel') || '').toLowerCase().split(/\s+/).filter(Boolean);
        const themeMedia = (link.getAttribute('media') || '').trim()
            .match(/^\(\s*prefers-color-scheme\s*:\s*(light|dark)\s*\)$/i);
        if (themeMedia && themeMedia[1].toLowerCase() !== colorScheme) return;
        const href = toHttpUrl(link.getAttribute('href'), baseUrl);
        if (!href) return;
        if (rels.includes('manifest')) {
            manifests.push(href);
            return;
        }
        const sourceKind = rels.includes('icon')
            ? 'html-icon'
            : (rels.includes('apple-touch-icon') ? 'apple-touch' : '');
        if (!sourceKind) return;
        candidates.push({
            url: href,
            sourceKind,
            sizeHint: sizeHint(link.getAttribute('sizes') || ''),
            purpose: ''
        });
    });
    return { candidates: candidates.slice(0, 64), manifests: [...new Set(manifests)].slice(0, 3) };
}

function parseManifest(text, manifestUrl) {
    let manifest;
    try {
        manifest = JSON.parse(String(text || ''));
    } catch {
        return [];
    }
    if (!Array.isArray(manifest?.icons)) return [];
    return manifest.icons.flatMap((icon) => {
        const purpose = typeof icon?.purpose === 'string' ? icon.purpose.toLowerCase() : '';
        if (purpose.split(/\s+/).includes('monochrome')) return [];
        const url = toHttpUrl(icon?.src, manifestUrl);
        if (!url) return [];
        return [{
            url,
            sourceKind: 'manifest',
            sizeHint: sizeHint(icon?.sizes || ''),
            purpose
        }];
    });
}

export { parseManifest, parsePage, sizeHint };

export async function inspectImage(bytes, contentType) {
    try {
        const blob = new Blob([Uint8Array.from(bytes || [])], { type: contentType || 'image/png' });
        const isSvg = /image\/svg\+xml/i.test(blob.type);
        const objectUrl = URL.createObjectURL(blob);
        try {
            const image = new Image();
            await new Promise((resolve, reject) => {
                const timer = setTimeout(() => { image.src = ''; reject(new Error('Image decode timed out')); }, 3000);
                image.onload = () => { clearTimeout(timer); resolve(); };
                image.onerror = () => { clearTimeout(timer); reject(new Error('Invalid image')); };
                image.src = objectUrl;
            });
            return { valid: true, width: image.naturalWidth || 0, height: image.naturalHeight || 0, isSvg };
        } finally {
            URL.revokeObjectURL(objectUrl);
        }
    } catch {
        return { valid: false, width: 0, height: 0, isSvg: false };
    }
}

export function runFaviconDomTask(message) {
    if (message?.type === PARSE_PAGE_MESSAGE) {
        return parsePage(message.html, message.pageUrl, { colorScheme: message.colorScheme });
    }
    if (message?.type === PARSE_MANIFEST_MESSAGE) {
        return parseManifest(message.text, message.manifestUrl);
    }
    if (message?.type === INSPECT_IMAGE_MESSAGE) {
        return inspectImage(message.bytes, message.contentType);
    }
    throw new Error('Unknown favicon DOM task');
}
