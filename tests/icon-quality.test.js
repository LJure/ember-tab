import { describe, expect, it } from 'vitest';
import { chooseBestIcon, hasHighResolutionIcon, hasUsableSiteIcon, isProviderPlaceholder } from '../scripts/platform/icon-quality.js';

const icon = (source, size, score, extra = {}) => ({
    url: `https://example.com/${source}`, sourceKind: source === 'declared' ? 'html-icon' : source === 'provider' ? 'vemetric' : source,
    width: size, height: size, score, data: [1, 2, 3], ...extra
});
describe('automatic favicon resolution', () => {
    it('does not treat a requested 128px Chrome icon that decodes to 64px as high resolution', () => {
        expect(hasHighResolutionIcon(icon('chrome', 64, 73, { sizeHint: 128 }))).toBe(false);
        expect(hasHighResolutionIcon(icon('provider', 128, 52))).toBe(true);
        expect(hasHighResolutionIcon(icon('wide', 128, 90, { height: 16 }))).toBe(false);
        expect(hasHighResolutionIcon(icon('vector', 16, 90, { isSvg: true }))).toBe(true);
    });
    it('prefers a provider image over a low-resolution Chrome fallback', () => {
        const chrome = icon('chrome', 64, 73, { sizeHint: 128 });
        const provider = icon('provider', 128, 52);
        expect(chooseBestIcon([chrome, provider])).toBe(provider);
    });
    it('preserves source priority among sufficient images and retains a usable small fallback', () => {
        const declared = icon('declared', 144, 95);
        const provider = icon('provider', 128, 52);
        const chrome = icon('chrome', 64, 73);
        expect(chooseBestIcon([provider, declared])).toBe(declared);
        expect(chooseBestIcon([null, chrome])).toBe(chrome);
        expect(chooseBestIcon([null])).toBeNull();
    });
    it.each([32, 48, 64, 80])('keeps a native %ipx site icon ahead of a provider-upscaled 128px image', size => {
        const declared = icon('declared', size, 86);
        const enlarged = icon('provider', 128, 52);
        expect(hasUsableSiteIcon(declared)).toBe(true);
        expect(hasUsableSiteIcon(enlarged)).toBe(false);
        expect(chooseBestIcon([enlarged, declared])).toBe(declared);
    });
    it('does not confuse a Chrome cache fallback with a usable site-owned original', () => {
        expect(hasUsableSiteIcon(icon('chrome', 64, 73))).toBe(false);
        expect(hasUsableSiteIcon(icon('conventional', 64, 56))).toBe(true);
        expect(hasUsableSiteIcon(icon('declared', 32, 80))).toBe(true);
        expect(hasUsableSiteIcon(icon('declared', 16, 70))).toBe(false);
    });
    it.each([32, 48])('prefers a native %ipx Google fallback to a resized provider raster and Chrome fallback', size => {
        const google = icon('google', size, 33);
        expect(chooseBestIcon([icon('chrome', 64, 73), icon('provider', 128, 52), google])).toBe(google);
    });
    it('retains a genuine browser high-resolution icon or provider vector and ignores tiny Google fallbacks', () => {
        const google = icon('google', 48, 33);
        const chrome = icon('chrome', 128, 78);
        const vector = icon('provider', 24, 57, { isSvg: true });
        expect(chooseBestIcon([google, chrome])).toBe(chrome);
        expect(chooseBestIcon([google, vector])).toBe(vector);
        const provider = icon('provider', 128, 52);
        expect(chooseBestIcon([icon('google', 16, 23), provider])).toBe(provider);
    });
    it('rejects the observed provider SVG placeholder without rejecting genuine site vectors', () => {
        const bytes = new TextEncoder().encode('<svg class="icon-tabler-world-question"/>');
        expect(isProviderPlaceholder(icon('provider', 24, 57), bytes, 'image/svg+xml')).toBe(true);
        expect(isProviderPlaceholder(icon('declared', 24, 95), bytes, 'image/svg+xml')).toBe(false);
        expect(isProviderPlaceholder(icon('provider', 128, 57), new TextEncoder().encode('<svg><path d="M0 0"/></svg>'), 'image/svg+xml')).toBe(false);
    });
});
