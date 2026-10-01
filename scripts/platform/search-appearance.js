export const SEARCH_PANEL_DEFAULTS = Object.freeze({ searchPanelOpacity: 68, searchPanelBlur: 48 });
export const SEARCH_PANEL_BOUNDS = Object.freeze({ searchPanelOpacity: 100, searchPanelBlur: 64 });

export function normalizeSearchPanelAppearance(values = {}) {
    return Object.fromEntries(Object.entries(SEARCH_PANEL_DEFAULTS).map(([key, fallback]) => {
        const value = values?.[key];
        return [key, typeof value === 'number' && Number.isFinite(value)
            ? Math.round(Math.max(0, Math.min(SEARCH_PANEL_BOUNDS[key], value))) : fallback];
    }));
}

export function applySearchPanelAppearance(element, values) {
    const appearance = normalizeSearchPanelAppearance(values);
    element.style.setProperty('--search-panel-opacity', String(appearance.searchPanelOpacity / 100));
    element.style.setProperty('--search-panel-blur', `${appearance.searchPanelBlur}px`);
    return appearance;
}
