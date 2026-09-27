// Normalize only static PNG favicons for display. Keep the cached original,
// custom images, animation and non-transparent artwork intact.
const MAX_SIDE = 1024;
// Very faint halos and antialiasing are not the perceived edge of an icon.
// Including every nonzero alpha pixel leaves padded app icons visibly smaller.
const MIN_VISIBLE_ALPHA = 128;
const previews = new WeakMap();

function isStaticPng(bytes) {
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (!signature.every((value, i) => bytes[i] === value)) return false;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let offset = 8; offset + 12 <= bytes.length;) {
        const length = view.getUint32(offset);
        const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
        if (type === 'acTL') return false;
        if (type === 'IEND') return true;
        offset += length + 12;
    }
    return false;
}

export function transparentIconCrop(data, width, height) {
    let left = width, top = height, right = -1, bottom = -1;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (data[(y * width + x) * 4 + 3] < MIN_VISIBLE_ALPHA) continue;
            left = Math.min(left, x); right = Math.max(right, x);
            top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
    }
    if (right < left) return null;
    const side = Math.max(right - left + 1, bottom - top + 1);
    // Only adjust a clearly padded, near-square icon; no aggressive enlargement.
    const shortSide = Math.min(width, height), longSide = Math.max(width, height);
    if (shortSide / longSide < 0.9 || side > shortSide * 0.95 || side < longSide * 0.5) return null;
    return {
        x: Math.max(0, Math.min(width - side, (left + right + 1 - side) / 2)),
        y: Math.max(0, Math.min(height - side, (top + bottom + 1 - side) / 2)),
        side
    };
}

async function createPreview(blob) {
    if (blob.type !== 'image/png' || blob.size > 512 * 1024) return blob;
    let bitmap;
    try {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (!isStaticPng(bytes) || bytes.length < 33) return blob;
        const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        if (header.getUint32(12) !== 0x49484452 || header.getUint32(16) > MAX_SIDE || header.getUint32(20) > MAX_SIDE) return blob;
        bitmap = await createImageBitmap(blob);
        const {width, height} = bitmap;
        if (!width || !height || width > MAX_SIDE || height > MAX_SIDE) return blob;
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const context = canvas.getContext('2d', {willReadFrequently: true});
        context.drawImage(bitmap, 0, 0);
        const crop = transparentIconCrop(context.getImageData(0, 0, width, height).data, width, height);
        if (!crop) return blob;
        canvas.width = canvas.height = crop.side;
        context.drawImage(bitmap, crop.x, crop.y, crop.side, crop.side, 0, 0, crop.side, crop.side);
        return await new Promise(resolve => canvas.toBlob(result => resolve(result || blob), 'image/png'));
    } catch {
        return blob; // Analysis failure must never hide an otherwise valid icon.
    } finally {
        bitmap?.close();
    }
}

export function autoIconDisplayBlob(blob) {
    if (!(blob instanceof Blob)) return Promise.resolve(blob);
    if (!previews.has(blob)) {
        previews.set(blob, new Promise(resolve => {
            const timer = setTimeout(() => resolve(blob), 1500);
            createPreview(blob).then(result => { clearTimeout(timer); resolve(result); }, () => {
                clearTimeout(timer); resolve(blob);
            });
        }));
    }
    return previews.get(blob);
}
