import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setStorageData } from './setup.js';
import { initSearchPanelAppearance } from '../scripts/domains/settings/content-search-appearance.js';
import { SEARCH_PANEL_DEFAULTS, normalizeSearchPanelAppearance } from '../scripts/platform/search-appearance.js';

let container, builder;
beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
});
afterEach(() => {
    builder?.dispose(); builder = null; container.remove();
    document.documentElement.style.removeProperty('--search-panel-opacity');
    document.documentElement.style.removeProperty('--search-panel-blur');
});
async function start(values) {
    setStorageData(values, 'sync');
    builder = initSearchPanelAppearance(container);
    await vi.waitFor(() => expect(builder.state.values.size).toBe(2));
}
function change(id, value, event = 'change') {
    const control = document.getElementById(id);
    control.value = value;
    control.dispatchEvent(new Event(event));
}
describe('search panel appearance', () => {
    it('clamps finite settings and rejects invalid restored values before constructing CSS', () => {
        expect(normalizeSearchPanelAppearance({ searchPanelOpacity: -1, searchPanelBlur: 100 })).toEqual({ searchPanelOpacity: 0, searchPanelBlur: 64 });
        expect(normalizeSearchPanelAppearance({ searchPanelOpacity: Infinity, searchPanelBlur: '48px);url(https://example.com)' })).toEqual(SEARCH_PANEL_DEFAULTS);
        expect(normalizeSearchPanelAppearance({ searchPanelOpacity: null })).toEqual(SEARCH_PANEL_DEFAULTS);
    });
    it('previews while dragging and persists only the changed appearance value on release', async () => {
        await start({ searchPanelOpacity: 68, searchPanelBlur: 48, searchSuggestionsEnabled: false });
        change('macSearchPanelOpacity', 85, 'input');
        expect(document.documentElement.style.getPropertyValue('--search-panel-opacity')).toBe('0.85');
        expect(chrome.storage.sync.set).not.toHaveBeenCalled();
        change('macSearchPanelOpacity', 85);
        await vi.waitFor(() => expect(chrome.storage.sync.set).toHaveBeenCalledWith({ searchPanelOpacity: 85 }));
        expect((await chrome.storage.sync.get('searchPanelBlur')).searchPanelBlur).toBe(48);
        expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
    it('loads saved values, supports zero blur and restores both defaults without touching other settings', async () => {
        await start({ searchPanelOpacity: 94, searchPanelBlur: 0, uiTheme: 'dark' });
        expect(document.getElementById('macSearchPanelOpacity').value).toBe('94');
        expect(document.documentElement.style.getPropertyValue('--search-panel-blur')).toBe('0px');
        document.getElementById('macSearchPanelReset').click();
        await vi.waitFor(() => expect(chrome.storage.sync.set).toHaveBeenCalledWith({ ...SEARCH_PANEL_DEFAULTS }));
        await vi.waitFor(() => expect(document.getElementById('macSearchPanelOpacity').value).toBe('68'));
        expect((await chrome.storage.sync.get('uiTheme')).uiTheme).toBe('dark');
        expect(document.getElementById('macSearchPanelBlur').value).toBe('48');
    });
    it('rolls back a failed save so the preview does not pretend the value was saved', async () => {
        await start({ searchPanelOpacity: 68, searchPanelBlur: 48 });
        const log = vi.spyOn(console, 'error').mockImplementation(() => {});
        chrome.storage.sync.set.mockRejectedValueOnce(new Error('quota'));
        change('macSearchPanelBlur', 30, 'input');
        change('macSearchPanelBlur', 30);
        await vi.waitFor(() => expect(log).toHaveBeenCalled());
        expect(document.documentElement.style.getPropertyValue('--search-panel-blur')).toBe('48px');
        expect(document.getElementById('macSearchPanelBlur').value).toBe('48');
        log.mockRestore();
    });
});
