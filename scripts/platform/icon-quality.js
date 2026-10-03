// Request parameters and HTML size hints do not guarantee actual image resolution.
// Dock enlargement and high-DPI displays need a real 128px image or a vector.
export function hasHighResolutionIcon(icon) {
    return Boolean(icon?.isSvg || Math.min(icon?.width || 0, icon?.height || 0) >= 128);
}

// A provider can upscale a small favicon into a 128px canvas. Prefer a usable
// site-owned original instead of assuming the larger canvas contains more detail.
export function hasUsableSiteIcon(icon) {
    return ['html-icon', 'manifest', 'apple-touch', 'conventional'].includes(icon?.sourceKind) &&
        Boolean(icon.isSvg || Math.min(icon.width || 0, icon.height || 0) >= 32);
}

function fallbackRank(icon) {
    // A provider's 128px canvas may contain an enlarged 32/48px favicon.
    // Keep vectors and genuine large browser icons, then prefer Google's
    // returned native-size fallback to Vemetric's resized raster image.
    if (icon.isSvg || (icon.sourceKind === 'chrome' && hasHighResolutionIcon(icon))) return 3;
    if (icon.sourceKind === 'google' && Math.min(icon.width || 0, icon.height || 0) >= 32) return 2;
    if (icon.sourceKind === 'vemetric') return 1;
    return 0;
}

export function isProviderPlaceholder(candidate, bytes, contentType) {
    return candidate?.sourceKind === 'vemetric' && /image\/svg\+xml/i.test(contentType || '') &&
        /\bicon-tabler-world-question\b/.test(new TextDecoder().decode(Uint8Array.from(bytes || [])));
}

export function rankIcons(results) {
    return results.filter(Boolean).sort((a, b) => {
        const sourceDifference = Number(hasUsableSiteIcon(b)) - Number(hasUsableSiteIcon(a));
        if (sourceDifference) return sourceDifference;
        if (!hasUsableSiteIcon(a)) {
            const fallbackDifference = fallbackRank(b) - fallbackRank(a);
            if (fallbackDifference) return fallbackDifference;
        }
        const qualityDifference = Number(hasHighResolutionIcon(b)) - Number(hasHighResolutionIcon(a));
        if (qualityDifference) return qualityDifference;
        if (b.score !== a.score) return b.score - a.score;
        if (a.data.length !== b.data.length) return a.data.length - b.data.length;
        return a.url.localeCompare(b.url);
    });
}

export function chooseBestIcon(results) {
    return rankIcons(results)[0] || null;
}

// Limit the manual chooser's binary response, and collapse identical files
// even when they were fetched from different URLs or source categories.
export async function uniqueIconCandidates(results, { maxCount = 8, maxBytes = 1024 * 1024 } = {}) {
    const seen = new Set();
    const icons = [];
    let bytes = 0;
    for (const icon of rankIcons(results)) {
        const data = Uint8Array.from(icon.data);
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)))
            .map(byte => byte.toString(16).padStart(2, '0')).join('');
        if (seen.has(digest) || bytes + data.length > maxBytes) continue;
        seen.add(digest);
        icons.push(icon);
        bytes += data.length;
        if (icons.length >= maxCount) break;
    }
    return icons;
}
