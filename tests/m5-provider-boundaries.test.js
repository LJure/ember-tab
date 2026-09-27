import { describe, it, expect, vi, afterEach } from 'vitest';
import { getProvider, unsplashProvider } from '../scripts/domains/backgrounds/source-remote.js';

afterEach(() => vi.unstubAllGlobals());
describe('M5 provider boundaries', () => {
    it('removes paused Pixabay from production provider selection', () => {
        expect(getProvider('pixabay')).toBeNull();
        expect(getProvider('unsplash')).toBe(unsplashProvider);
    });
    it('does not forward an Unsplash key to a response-supplied external download host', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({
            id:'photo', urls:{raw:'https://images.unsplash.com/photo'},
            user:{name:'Photographer', links:{html:'https://unsplash.com/@photographer'}},
            links:{html:'https://unsplash.com/photos/photo',download_location:'https://unexpected.example/collect'}
        })});
        vi.stubGlobal('fetch',fetchMock);
        const photo = await unsplashProvider.fetchRandom('test-key-1234567890');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(photo.userUrl).toContain('utm_source=ember_tab');
        expect(photo.page).toContain('utm_medium=referral');
    });
});
