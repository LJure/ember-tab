export const SEARCH_HISTORY_KEY = 'emberSearchHistory';
export const SEARCH_HISTORY_MESSAGE = 'emberSearchHistory';
export const SEARCH_LOCAL_DEFAULTS = Object.freeze({
    searchHistoryEnabled: false,
    searchSuggestionsEnabled: false,
    searchSuggestionSource: 'bing'
});
export const SEARCH_LOCAL_KEYS = Object.freeze([SEARCH_HISTORY_KEY, ...Object.keys(SEARCH_LOCAL_DEFAULTS)]);
export const SUGGESTION_SOURCES = Object.freeze(['bing', 'google', 'baidu', 'duckduckgo', 'brave']);
export const SEARCH_HISTORY_LIMIT = 100;

export function normalizeSearchQuery(value) {
    // Strip storage/network control characters, never interpret them as code.
    // eslint-disable-next-line no-control-regex
    return typeof value === 'string' ? value.trim().replace(/[\u0000-\u001f\u007f]/g, '') : '';
}

export function sanitizeSearchHistory(value) {
    const queries = Array.isArray(value) ? value.map(normalizeSearchQuery) : [];
    return [...new Set(queries.filter(query => query && query.length <= 512))].slice(0, SEARCH_HISTORY_LIMIT);
}

export function withoutSearchLocalData(data) {
    return Object.fromEntries(Object.entries(data).filter(([key]) => !SEARCH_LOCAL_KEYS.includes(key)));
}

export async function getSearchPreferences() {
    const values = await chrome.storage.local.get(SEARCH_LOCAL_DEFAULTS);
    return {
        searchHistoryEnabled: values.searchHistoryEnabled === true,
        searchSuggestionsEnabled: values.searchSuggestionsEnabled === true,
        searchSuggestionSource: SUGGESTION_SOURCES.includes(values.searchSuggestionSource) ? values.searchSuggestionSource : 'bing'
    };
}

// One background queue serializes writes from all new-tab pages. Reads are
// queued as well so a completed deletion is never followed by a stale read.
export function createSearchHistoryHandler(storage, extensionId) {
    let chain = Promise.resolve();
    return (message, sender) => {
        if (sender?.id !== extensionId || sender?.tab?.incognito || sender?.incognito) {
            return Promise.resolve({ success: false, items: [] });
        }
        const task = chain.then(async () => {
            if (message.action === 'clear') {
                await storage.remove(SEARCH_HISTORY_KEY);
                return { success: true, items: [] };
            }
            const enabled = (await storage.get({ searchHistoryEnabled: false })).searchHistoryEnabled === true;
            if (!enabled) return { success: true, items: [] };
            const data = await storage.get({ [SEARCH_HISTORY_KEY]: [] });
            let items = sanitizeSearchHistory(data[SEARCH_HISTORY_KEY]);
            const query = normalizeSearchQuery(message.query);
            if (message.action === 'add' && query && query.length <= 512) {
                items = sanitizeSearchHistory([query, ...items]);
                await storage.set({ [SEARCH_HISTORY_KEY]: items });
            } else if (message.action === 'delete') {
                items = items.filter(item => item !== query);
                await storage.set({ [SEARCH_HISTORY_KEY]: items });
            } else if (message.action !== 'list') {
                return { success: false, items: [] };
            }
            return { success: true, items };
        });
        chain = task.catch(() => {});
        return task;
    };
}

export async function requestSearchHistory(action, query) {
    if (chrome.extension?.inIncognitoContext) return [];
    const result = await chrome.runtime.sendMessage({ type: SEARCH_HISTORY_MESSAGE, action, query });
    if (!result?.success) throw new Error('Search history unavailable');
    return sanitizeSearchHistory(result.items);
}
