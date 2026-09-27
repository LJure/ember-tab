import { runFaviconDomTask } from './favicon-dom.js';
export { parseManifest, parsePage, sizeHint } from './favicon-dom.js';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!['faviconOffscreenParsePage', 'faviconOffscreenParseManifest', 'faviconOffscreenInspectImage'].includes(message?.type)) return false;
    Promise.resolve().then(() => runFaviconDomTask(message)).then(sendResponse,
        error => sendResponse({valid:false, error:String(error)}));
    return true;
});
