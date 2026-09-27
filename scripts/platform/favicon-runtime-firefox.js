// The Firefox build places this adapter at favicon-runtime.js.
// Firefox's module event page already has a DOM; no offscreen document is needed.
export { runFaviconDomTask } from './favicon-dom.js';
