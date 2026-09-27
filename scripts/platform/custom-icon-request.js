// Explicit user images may live on slow hosts. Keep automatic site discovery
// fast, while sharing bounded custom-image work across extension pages.
export const CUSTOM_ICON_TIMEOUT_MS = 60000;
const inFlight = new Map();
const waiting = [];
let active = 0;

export function requestCustomIcon(url, request) {
    if (inFlight.has(url)) return inFlight.get(url);
    const promise = (async () => {
        if (active >= 4) await new Promise(resolve => waiting.push(resolve));
        else active++;
        try {
            let result = await request();
            if (!result.success && /timed out|fetch|network|HTTP (429|5\d\d)/i.test(result.error || '')) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                result = await request();
            }
            return result;
        } finally {
            const next = waiting.shift();
            if (next) next();
            else active--;
        }
    })();
    inFlight.set(url, promise);
    void promise.finally(() => inFlight.delete(url)).catch(() => {});
    return promise;
}
