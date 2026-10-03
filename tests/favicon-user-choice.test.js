import { afterEach, expect, it, vi } from 'vitest';
import { setImageSrcWithFallback } from '../scripts/shared/favicon.js';
import { iconCache } from '../scripts/platform/icon-cache.js';

afterEach(() => vi.restoreAllMocks());
it('a late automatic discovery does not overwrite a newer manual choice', async () => {
    const selected = new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"/>'], { type: 'image/svg+xml' });
    vi.spyOn(iconCache, 'init').mockResolvedValue();
    vi.spyOn(iconCache, 'isInNegativeCache').mockReturnValue(false);
    vi.spyOn(iconCache, 'get').mockResolvedValueOnce(null).mockResolvedValue({ blob: selected, userSelected: true });
    const write = vi.spyOn(iconCache, 'set').mockResolvedValue(true);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => blob === selected ? 'blob:selected' : 'blob:automatic');
    let finish;
    chrome.runtime.sendMessage.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const img = document.createElement('img');
    const resolved = vi.fn();
    setImageSrcWithFallback(img, [], vi.fn(), { cacheKey: 'late-icon', pageUrl: 'https://example.com/', onResolved: resolved });
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    finish({ success: true, data: Array.from(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')), contentType: 'image/svg+xml' });
    await vi.waitFor(() => expect(resolved).toHaveBeenCalledOnce());
    expect(img.src).toBe('blob:selected');
    expect(write).not.toHaveBeenCalled();
});
