import { describe, it, expect } from 'vitest';
import { getProvider } from '../scripts/domains/backgrounds/source-remote.js';
describe('Provider availability', () => {
    it('supports Unsplash with a required key, Wallhaven without one and no Pixabay', () => {
        expect(getProvider('unsplash').requiresApiKey).toBe(true);
        expect(getProvider('pixabay')).toBeNull();
        expect(getProvider('wallhaven').requiresApiKey).toBe(false);
    });
});
