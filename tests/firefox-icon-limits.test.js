import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchLimited } from '../scripts/platform/icon-network.js';
import { inspectImage } from '../scripts/platform/favicon-dom.js';
import { setImageSrcWithFallback } from '../scripts/shared/favicon.js';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('bounded icon work', () => {
    it('rejects an oversized streamed body and aborts the request', async () => {
        let signal;
        const releaseLock = vi.fn();
        vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
            signal=options.signal;
            return {ok:true,headers:new Headers({'content-type':'image/png'}),body:{getReader:()=>({
                read:vi.fn().mockResolvedValueOnce({value:new Uint8Array(20)}),releaseLock
            })}};
        }));
        expect(await fetchLimited('https://example.com/icon','image/*',10)).toMatchObject({ok:false,error:'Response too large'});
        expect(signal.aborted).toBe(true);expect(releaseLock).toHaveBeenCalled();
    });
    it('does not clear the timeout as soon as response headers arrive', async () => {
        vi.useFakeTimers();
        vi.stubGlobal('fetch', vi.fn(async (_url,{signal}) => ({ok:true,headers:new Headers(),body:{getReader:()=>({
            read:()=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('abort')))),releaseLock:vi.fn()
        })}})));
        const result=fetchLimited('https://example.com/icon','image/*',100,100);
        await vi.advanceTimersByTimeAsync(101);
        expect(await result).toMatchObject({ok:false,error:'Request timed out'});
    });
    it('bounds image decoding and revokes the blob URL', async () => {
        vi.useFakeTimers();
        vi.stubGlobal('Image',class { set src(_value) {} });
        vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:test');
        const revoke=vi.spyOn(URL,'revokeObjectURL');
        const result=inspectImage([1,2,3],'image/png');
        await vi.advanceTimersByTimeAsync(3001);
        expect((await result).valid).toBe(false);
        expect(revoke).toHaveBeenCalledWith('blob:test');
    });
    it('exhausts stalled image fallbacks exactly once', async () => {
        vi.useFakeTimers();
        const img=document.createElement('img');const exhausted=vi.fn();
        setImageSrcWithFallback(img,['https://example.com/a.png','https://example.com/b.png'],exhausted,{enableCache:false});
        await vi.advanceTimersByTimeAsync(6001);
        expect(exhausted).toHaveBeenCalledTimes(1);
        expect(img.hasAttribute('src')).toBe(false);
        await vi.advanceTimersByTimeAsync(9000);
        expect(exhausted).toHaveBeenCalledTimes(1);
    });
});
