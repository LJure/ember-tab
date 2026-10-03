import { discoverIconCandidatesViaBackground } from '../../platform/icon-fetch-bridge.js';
import { iconCache } from '../../platform/icon-cache.js';
import { buildIconCacheKey } from '../../shared/text.js';
import { t } from '../../platform/i18n.js';

export class IconChooser {
    constructor({ button, panel, status, list, readContext, onSelected }) {
        Object.assign(this, { button, panel, status, list, readContext, onSelected });
        this.epoch = 0;
        this.objectUrls = [];
    }

    reset() {
        this.epoch++;
        for (const url of this.objectUrls) URL.revokeObjectURL(url);
        this.objectUrls = [];
        this.list?.replaceChildren();
        this.panel?.classList.add('hidden');
        if (this.button) this.button.disabled = false;
    }

    async load() {
        this.reset();
        const context = { ...this.readContext() };
        if (!context?.url || context.mode !== 'auto') return;
        const key = buildIconCacheKey(context.url);
        if (!key) return;
        const epoch = this.epoch;
        const active = () => epoch === this.epoch && this.readContext()?.url === context.url && this.readContext()?.mode === 'auto';
        this.panel.classList.remove('hidden');
        this.status.textContent = t('iconChoicesLoading');
        this.button.disabled = true;
        try {
            await iconCache.init();
            const [current, candidates] = await Promise.all([iconCache.get(key), discoverIconCandidatesViaBackground(context.url)]);
            if (!active()) return;
            const items = current?.blob ? [{ blob: current.blob, meta: current, current: true }, ...candidates] : candidates;
            const seen = new Set();
            for (const item of items) {
                const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await item.blob.arrayBuffer()))).join(',');
                if (!active()) return;
                if (seen.has(digest)) continue;
                seen.add(digest);
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'quicklink-icon-candidate';
                button.setAttribute('aria-pressed', String(Boolean(item.current)));
                const image = document.createElement('img');
                image.alt = '';
                image.src = URL.createObjectURL(item.blob);
                this.objectUrls.push(image.src);
                const label = document.createElement('span');
                const source = item.current ? t('iconChoiceCurrent') : ['google', 'vemetric'].includes(item.meta.sourceKind)
                    ? (item.meta.sourceKind === 'google' ? 'Google' : 'Vemetric')
                    : t(item.meta.sourceKind === 'chrome' ? 'iconChoiceBrowser' : 'iconChoiceWebsite');
                const vector = item.blob.type.includes('svg');
                label.textContent = source;
                const size = document.createElement('small');
                size.textContent = vector ? 'SVG' : `${item.meta.width || '?'} × ${item.meta.height || '?'}`;
                button.append(image, label, size);
                button.addEventListener('click', async () => {
                    if (!active() || this.selecting) return;
                    this.selecting = true;
                    try {
                        const saved = await iconCache.set(key, item.blob, item.meta.sourceUrl || '', { ...item.meta, userSelected: true });
                        if (!active()) return;
                        if (!saved) { this.status.textContent = t('iconCacheRefreshFailed'); return; }
                        iconCache.removeFromNegativeCache(key);
                        for (const sibling of this.list.children) sibling.setAttribute('aria-pressed', String(sibling === button));
                        this.status.textContent = t('iconChoiceApplied');
                        this.onSelected();
                    } catch {
                        if (active()) this.status.textContent = t('iconCacheRefreshFailed');
                    } finally { this.selecting = false; }
                });
                this.list.append(button);
            }
            this.status.textContent = seen.size ? t('iconChoicesHint') : t('iconChoicesEmpty');
        } catch {
            if (active()) this.status.textContent = t('iconCacheRefreshFailed');
        } finally {
            if (active()) this.button.disabled = false;
        }
    }
}
