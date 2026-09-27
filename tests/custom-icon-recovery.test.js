import {afterEach,describe,it,expect,vi} from 'vitest';
import {requestCustomIcon} from '../scripts/platform/custom-icon-request.js';
import {setImageSrcWithFallback} from '../scripts/shared/favicon.js';
import {iconCache} from '../scripts/platform/icon-cache.js';

afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();});
describe('custom image recovery',()=>{
    it('shares in-flight work and limits concurrency to four',async()=>{
        const releases=[];let active=0,peak=0;
        const request=vi.fn(()=>new Promise(resolve=>{
            active++;peak=Math.max(peak,active);
            releases.push(()=>{active--;resolve({success:true});});
        }));
        const first=requestCustomIcon('queue-0',request);
        expect(requestCustomIcon('queue-0',request)).toBe(first);
        const rest=Array.from({length:5},(_,i)=>requestCustomIcon('queue-'+(i+1),request));
        expect(request).toHaveBeenCalledTimes(4);
        while(releases.length){releases.shift()();await Promise.resolve();await Promise.resolve();}
        await Promise.all([first,...rest]);expect(peak).toBe(4);expect(request).toHaveBeenCalledTimes(6);
    });
    it('retries transient failures once but never permanently caches the failure',async()=>{
        vi.useFakeTimers();
        const request=vi.fn().mockResolvedValue({success:false,error:'Request timed out'});
        const pending=requestCustomIcon('retry',request);
        await vi.advanceTimersByTimeAsync(1001);
        expect(await pending).toEqual({success:false,error:'Request timed out'});
        expect(request).toHaveBeenCalledTimes(2);
        const next=vi.fn().mockResolvedValue({success:true});
        expect(await requestCustomIcon('retry',next)).toEqual({success:true});
        expect(next).toHaveBeenCalledOnce();
    });
    it('does not retry missing or oversized images',async()=>{
        for(const error of ['HTTP 404','Response too large','Invalid image']){
            const request=vi.fn().mockResolvedValue({success:false,error});
            await requestCustomIcon(error,request);expect(request).toHaveBeenCalledOnce();
        }
    });
    it('keeps the custom image pending beyond three seconds and resolves its placeholder',async()=>{
        vi.useFakeTimers();const img=document.createElement('img');
        const pending=vi.fn(),resolved=vi.fn(),exhausted=vi.fn();
        setImageSrcWithFallback(img,['https://site.test/favicon.ico'],exhausted,{
            enableCache:false,customIconUrl:'https://images.test/custom.png',onPending:pending,onResolved:resolved
        });
        await vi.advanceTimersByTimeAsync(41000);
        expect(img.src).toBe('https://images.test/custom.png');expect(exhausted).not.toHaveBeenCalled();
        Object.defineProperty(img,'naturalWidth',{value:128});img.dispatchEvent(new Event('load'));
        expect(resolved).toHaveBeenCalledOnce();expect(pending).toHaveBeenCalledOnce();
        await vi.advanceTimersByTimeAsync(60000);expect(exhausted).not.toHaveBeenCalled();
    });
    it('displays a downloaded custom image even if cache writes fail',async()=>{
        vi.spyOn(iconCache,'init').mockResolvedValue();vi.spyOn(iconCache,'get').mockResolvedValue(null);
        vi.spyOn(iconCache,'set').mockRejectedValue(new Error('quota'));
        vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:custom');
        chrome.runtime.sendMessage.mockResolvedValue({success:true,data:[1,2,3],contentType:'image/png'});
        const img=document.createElement('img'),resolved=vi.fn();
        setImageSrcWithFallback(img,[],vi.fn(),{cacheKey:'custom-failure',customIconUrl:'https://images.test/custom.png',onResolved:resolved});
        await vi.waitFor(()=>expect(resolved).toHaveBeenCalledOnce());
        expect(img.src).toBe('blob:custom');
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({type:'fetchIcon',url:'https://images.test/custom.png',customIcon:true});
    });
});
