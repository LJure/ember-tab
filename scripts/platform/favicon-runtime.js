// Chromium service workers have no DOM. Keep parsing in an offscreen document.
let pending;
async function ensureDocument() {
    if (pending) return pending;
    pending = (async () => {
        if (!chrome.offscreen?.createDocument) throw new Error('Offscreen API unavailable');
        const url = chrome.runtime.getURL('favicon-offscreen.html');
        const contexts = chrome.runtime.getContexts
            ? await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [url] }) : [];
        if (!contexts?.length) await chrome.offscreen.createDocument({
            url: 'favicon-offscreen.html', reasons: ['DOM_PARSER'],
            justification: 'Parse site-declared favicon metadata and verify image dimensions.'
        });
    })().catch(error => { pending = null; throw error; });
    return pending;
}

export async function runFaviconDomTask(message) {
    await ensureDocument();
    return chrome.runtime.sendMessage(message);
}
