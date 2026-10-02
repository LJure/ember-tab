import { afterEach, describe, expect, it, vi } from 'vitest';
import { LayoutManager } from '../scripts/domains/layout.js';
import { beginBackgroundRefresh, clearBackgroundRefresh, isBackgroundRefreshing } from '../scripts/domains/backgrounds/refresh-activity.js';
import { backgroundApplyMethods } from '../scripts/domains/backgrounds/image-pipeline.js';

let layout;
afterEach(() => { layout?.destroy(); layout = null; vi.restoreAllMocks(); vi.useRealTimers(); });
async function start(system) {
    document.body.innerHTML = '<div class="layout-container"></div><div id="searchContainer"><input id="searchInput"></div><button id="refreshBgBtn"><svg></svg></button>';
    layout = new LayoutManager({ backgroundSystem: system });
    await layout.init();
    vi.useFakeTimers();
    return document.getElementById('refreshBgBtn');
}

describe('wallpaper refresh indicator', () => {
    it('keeps automatic and overlapping updates spinning and cancels an obsolete cooldown', async () => {
        const system = {};
        const button = await start(system);
        const first = beginBackgroundRefresh(system);
        const second = beginBackgroundRefresh(system);
        expect(button.classList.contains('refreshing')).toBe(true);
        expect(button.getAttribute('aria-busy')).toBe('true');
        first();
        await vi.advanceTimersByTimeAsync(700);
        expect(button.classList.contains('refreshing')).toBe(true);
        second();
        await vi.advanceTimersByTimeAsync(250);
        const third = beginBackgroundRefresh(system);
        await vi.advanceTimersByTimeAsync(600);
        expect(button.classList.contains('refreshing')).toBe(true);
        third();
        await vi.advanceTimersByTimeAsync(500);
        expect(button.classList.contains('refreshing')).toBe(false);
        expect(button.getAttribute('aria-busy')).toBe('false');
    });
    it('hydrates activity already in progress before layout mounts', async () => {
        const system = {};
        const finish = beginBackgroundRefresh(system);
        const button = await start(system);
        expect(button.classList.contains('refreshing')).toBe(true);
        finish();
        await vi.advanceTimersByTimeAsync(500);
        expect(button.classList.contains('refreshing')).toBe(false);
    });
    it('releases activity when a refresh fails and ignores late completion after teardown', async () => {
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
        const system = { _loadMutex: { isLocked: true }, loadBackground: vi.fn().mockRejectedValue(new Error('offline')) };
        const button = await start(system);
        await expect(backgroundApplyMethods.refresh.call(system)).rejects.toThrow('offline');
        expect(isBackgroundRefreshing(system)).toBe(false);
        await vi.advanceTimersByTimeAsync(500);
        expect(button.classList.contains('refreshing')).toBe(false);
        const finish = beginBackgroundRefresh(system);
        clearBackgroundRefresh(system);
        finish(); finish();
        expect(isBackgroundRefreshing(system)).toBe(false);
    });
    it('keeps readiness and multiple manual clicks busy until every request finishes', async () => {
        let ready, first, second;
        const system = { whenReady: () => new Promise(resolve => { ready = resolve; }), refresh: vi.fn()
            .mockImplementationOnce(() => new Promise(resolve => { first = resolve; }))
            .mockImplementationOnce(() => new Promise(resolve => { second = resolve; })) };
        const button = await start(system);
        const one = layout.refreshBackground();
        expect(button.classList.contains('refreshing')).toBe(true);
        ready(); await Promise.resolve();
        const two = layout.refreshBackground();
        ready(); await Promise.resolve();
        first(); await one;
        await vi.advanceTimersByTimeAsync(600);
        expect(button.classList.contains('refreshing')).toBe(true);
        second(); await two;
        await vi.advanceTimersByTimeAsync(500);
        expect(button.classList.contains('refreshing')).toBe(false);
    });
});
