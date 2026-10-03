import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { modalLayer } from '../scripts/platform/modal-layer.js';
import { ImmersiveViewer } from '../scripts/domains/photos/immersive-viewer.js';

vi.mock('../scripts/domains/backgrounds/image-pipeline.js', () => ({
    blobUrlManager: { releaseScope: vi.fn() }
}));

describe('immersive photo modal', () => {
    let viewer, overlay, element, dismissAlbum;
    const removers = [];
    beforeEach(() => {
        modalLayer.destroy();
        document.body.innerHTML = '<div id="album"><div id="photosImmersiveViewer"><button id="immersiveClose">Close</button></div></div>';
        overlay = document.getElementById('album');
        element = document.getElementById('photosImmersiveViewer');
        viewer = new ImmersiveViewer({
            _window: overlay, _overlay: overlay, _getModalId: () => 'photos-window',
            _events: { add(target, type, handler, options) {
                target.addEventListener(type, handler, options);
                removers.push(() => target.removeEventListener(type, handler, options));
            } },
            _timers: { clearTimeout: vi.fn() }
        });
        vi.spyOn(viewer, '_buildImageList').mockImplementation(async () => {
            viewer._currentImageList = [{ id: 'fixture', source: 'local' }];
        });
        vi.spyOn(viewer, '_loadCurrentImage').mockResolvedValue();
        vi.spyOn(viewer, '_resetToolbarTimer').mockImplementation(() => {});
        dismissAlbum = vi.fn(() => {
            viewer.hide();
            modalLayer.unregister('photos-window');
        });
        modalLayer.register('photos-window', modalLayer.constructor.LEVEL.OVERLAY, overlay, dismissAlbum);
        viewer.bindEvents();
    });
    afterEach(() => {
        viewer.destroy();
        for (const remove of removers.splice(0)) remove();
        modalLayer.destroy();
        document.body.style.overflow = '';
    });
    const escape = () => document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape', bubbles: true, cancelable: true
    }));

    it('first Escape returns to the album; second Escape closes the album', async () => {
        await viewer.show('fixture', 'local');
        escape();
        expect(element.classList.contains('is-visible')).toBe(false);
        expect(modalLayer.has('photos-immersive')).toBe(false);
        expect(modalLayer.has('photos-window')).toBe(true);
        expect(dismissAlbum).not.toHaveBeenCalled();
        escape();
        expect(dismissAlbum).toHaveBeenCalledTimes(1);
    });
    it('close button restores the album layer and body scrolling', async () => {
        await viewer.show('fixture', 'local');
        expect(Number(overlay.style.zIndex)).toBeGreaterThanOrEqual(500);
        document.getElementById('immersiveClose').click();
        expect(Number(overlay.style.zIndex)).toBeLessThan(500);
        expect(document.body.style.overflow).toBe('');
        expect(modalLayer.shouldHandleClick(modalLayer.constructor.LEVEL.OVERLAY)).toBe(true);
        expect(dismissAlbum).not.toHaveBeenCalled();
    });
    it('closing the parent cleans up its nested viewer registration', async () => {
        await viewer.show('fixture', 'local');
        dismissAlbum();
        expect(modalLayer.has('photos-window')).toBe(false);
        expect(modalLayer.has('photos-immersive')).toBe(false);
        expect(element.classList.contains('is-visible')).toBe(false);
    });
    it('destroy removes the viewer modal without dismissing the album', async () => {
        await viewer.show('fixture', 'local');
        viewer.destroy();
        expect(modalLayer.has('photos-immersive')).toBe(false);
        expect(modalLayer.has('photos-window')).toBe(true);
        expect(dismissAlbum).not.toHaveBeenCalled();
    });
});
