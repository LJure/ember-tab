import { describe, it, expect } from 'vitest';
import { getProvider } from '../scripts/domains/backgrounds/source-remote.js';
describe('Provider availability', () => {
    it('removes Unsplash and Pixabay and supports Wallhaven without a mandatory key', () => {
        expect(getProvider('unsplash')).toBeNull();
        expect(getProvider('pixabay')).toBeNull();
        expect(getProvider('wallhaven').requiresApiKey).toBe(false);
    });
});
