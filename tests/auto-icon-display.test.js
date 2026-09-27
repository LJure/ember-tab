import {describe, expect, it, vi} from 'vitest';
import {autoIconDisplayBlob, transparentIconCrop} from '../scripts/shared/auto-icon-display.js';

function pixels(width, height, x, y, w, h, alpha = 255) {
    const data = new Uint8ClampedArray(width * height * 4);
    for(let row=y;row<y+h;row++)for(let col=x;col<x+w;col++)data[(row*width+col)*4+3]=alpha;
    return data;
}
describe('Automatic favicon transparent padding', () => {
    it('fits near-square artwork without stretching its proportions', () => {
        expect(transparentIconCrop(pixels(128,129,10,10,108,109),128,129))
            .toEqual({x:9.5,y:10,side:109});
    });
    it('keeps a wide logo centered in a square canvas', () => {
        expect(transparentIconCrop(pixels(128,128,10,38,108,52),128,128))
            .toEqual({x:10,y:10,side:108});
    });
    it('preserves opaque, empty, nearly edge-to-edge and extremely small artwork', () => {
        for(const args of [[128,128,0,0,128,128],[128,128,0,0,0,0],
            [128,128,3,3,122,122],[128,128,50,50,28,28],[128,64,10,10,100,40]]) {
            expect(transparentIconCrop(pixels(...args),args[0],args[1])).toBeNull();
        }
    });
    it('fits the visible body instead of letting faint halos keep it undersized', () => {
        const data=pixels(128,128,10,10,108,108);
        data[3]=1;
        expect(transparentIconCrop(data,128,128)).toEqual({x:10,y:10,side:108});
    });
    it('keeps visible translucent details and leaves wholly faint artwork unchanged', () => {
        const data=pixels(128,128,10,10,108,108);
        data[3]=128;
        expect(transparentIconCrop(data,128,128)).toEqual({x:0,y:0,side:118});
        expect(transparentIconCrop(pixels(128,128,10,10,108,108,127),128,128)).toBeNull();
    });
    it('leaves other formats, oversized and animated PNGs unchanged', async () => {
        const animated=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0,97,99,84,76,0,0,0,0]);
        for(const blob of [new Blob(['gif'],{type:'image/gif'}),
            new Blob([new Uint8Array(512*1024+1)],{type:'image/png'}),
            new Blob([animated],{type:'image/png'})]) {
            expect(await autoIconDisplayBlob(blob)).toBe(blob);
        }
    });
    it('falls back to original bytes when decoding fails', async () => {
        const png=new Uint8Array(45);png.set([137,80,78,71,13,10,26,10]);
        const view=new DataView(png.buffer);view.setUint32(8,13);view.setUint32(12,0x49484452);
        view.setUint32(16,128);view.setUint32(20,128);view.setUint32(37,0x49454e44);
        vi.stubGlobal('createImageBitmap',vi.fn().mockRejectedValue(new Error('decode failed')));
        try {
            const blob=new Blob([png],{type:'image/png'});
            expect(await autoIconDisplayBlob(blob)).toBe(blob);
            expect(createImageBitmap).toHaveBeenCalledOnce();
        } finally {vi.unstubAllGlobals();}
    });
    it('does not leave an icon waiting forever on a stalled decoder', async () => {
        const png=new Uint8Array(45);png.set([137,80,78,71,13,10,26,10]);
        const view=new DataView(png.buffer);view.setUint32(8,13);view.setUint32(12,0x49484452);
        view.setUint32(16,128);view.setUint32(20,128);view.setUint32(37,0x49454e44);
        vi.useFakeTimers();vi.stubGlobal('createImageBitmap',vi.fn(()=>new Promise(()=>{})));
        try {
            const blob=new Blob([png],{type:'image/png'}), result=autoIconDisplayBlob(blob);
            await vi.advanceTimersByTimeAsync(1501);
            expect(await result).toBe(blob);
        } finally {vi.useRealTimers();vi.unstubAllGlobals();}
    });
});
