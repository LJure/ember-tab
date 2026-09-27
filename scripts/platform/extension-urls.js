function extensionBase() {
    try {
        return new URL(chrome.runtime.getURL('/'));
    } catch {
        return null;
    }
}

export function isOwnExtensionUrl(value) {
    try {
        const url = new URL(value);
        const base = extensionBase();
        return Boolean(base && ['chrome-extension:', 'moz-extension:'].includes(base.protocol)
            && url.protocol === base.protocol && url.host === base.host && !url.username && !url.password);
    } catch {
        return false;
    }
}

export function chromeFaviconUrl(pageUrl, size = 64) {
    const base = extensionBase();
    if (base?.protocol !== 'chrome-extension:') return '';
    const url = new URL('/_favicon/', base);
    url.searchParams.set('pageUrl', pageUrl);
    url.searchParams.set('size', String(size));
    return url.href;
}

export function isOwnChromeFaviconUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'chrome-extension:' && isOwnExtensionUrl(value)
            && ['/_favicon', '/_favicon/'].includes(url.pathname);
    } catch {
        return false;
    }
}
