import { describe, expect, it } from 'vitest';
import {
    getApplyOptions,
    getPrepareTimeoutMs,
    isOnlineBackgroundType,
    resolveRenderMode,
    shouldPreloadNextBackground
} from '../scripts/domains/backgrounds/controller-actions.js';

describe('background policy', () => {
    it('should detect online source types', () => {
        expect(isOnlineBackgroundType('unsplash')).toBe(false);
        expect(isOnlineBackgroundType('pixabay')).toBe(false);
        expect(isOnlineBackgroundType('wallhaven')).toBe(true);
        expect(isOnlineBackgroundType('pexels')).toBe(true);
        expect(isOnlineBackgroundType('bing')).toBe(true);
        expect(isOnlineBackgroundType('files')).toBe(false);
    });

    it('should increase prepare timeout for online source when smart crop is enabled', () => {
        const settings = { type: 'pexels', smartCropEnabled: true };
        expect(getPrepareTimeoutMs(settings, 140, 'pexels')).toBe(360);
        expect(getPrepareTimeoutMs(settings, 700, 'pexels')).toBe(700);
    });

    it('should keep timeout unchanged when smart crop is disabled or source is local', () => {
        expect(getPrepareTimeoutMs({ type: 'pexels', smartCropEnabled: false }, 140, 'pexels')).toBe(140);
        expect(getPrepareTimeoutMs({ type: 'files', smartCropEnabled: true }, 140, 'files')).toBe(140);
    });

    it('should resolve render mode and apply options consistently', () => {
        expect(resolveRenderMode({ type: 'pexels', smartCropEnabled: true }, 'pexels')).toBe('single-stage');
        expect(resolveRenderMode({ type: 'files', smartCropEnabled: true }, 'files')).toBe('progressive');
        expect(getApplyOptions({ type: 'pexels', smartCropEnabled: true }, 'pexels')).toEqual({
            renderMode: 'single-stage'
        });
    });

    it('should disable preload only for tabs frequency on online sources', () => {
        expect(shouldPreloadNextBackground({ type: 'pexels', frequency: 'tabs' }, 'pexels')).toBe(false);
        expect(shouldPreloadNextBackground({ type: 'wallhaven', frequency: 'tabs' }, 'wallhaven')).toBe(false);
        expect(shouldPreloadNextBackground({ type: 'bing', frequency: 'tabs' }, 'bing')).toBe(false);
        expect(shouldPreloadNextBackground({ type: 'files', frequency: 'tabs' }, 'files')).toBe(true);
        expect(shouldPreloadNextBackground({ type: 'pexels', frequency: 'hour' }, 'pexels')).toBe(true);
    });
    it('never speculatively prefetches Wallhaven collection images', () => {
        for (const frequency of ['never', 'tabs', 'hour', 'day']) {
            expect(shouldPreloadNextBackground({ type: 'wallhaven', frequency })).toBe(false);
        }
    });
});
