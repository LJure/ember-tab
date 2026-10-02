import { DisposableComponent } from '../platform/lifecycle.js';
import { t } from '../platform/i18n.js';
import { SEARCH_LOCAL_DEFAULTS, SEARCH_LOCAL_KEYS, SEARCH_HISTORY_KEY, getSearchPreferences, requestSearchHistory } from '../platform/search-data.js';
import { SearchSuggestionClient, resolveSuggestionProvider } from '../platform/search-suggestions.js';
import { toast } from '../shared/toast.js';
import { SEARCH_PANEL_DEFAULTS, applySearchPanelAppearance } from '../platform/search-appearance.js';

function icon(history = false) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    const circle = document.createElementNS(svg.namespaceURI, 'circle');
    circle.setAttribute('cx', history ? '12' : '10');
    circle.setAttribute('cy', history ? '12' : '10');
    circle.setAttribute('r', history ? '9' : '7');
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', history ? 'M12 6v6l4 2' : 'M15 15l6 6');
    svg.append(circle, path);
    return svg;
}

export class SearchDropdown extends DisposableComponent {
    constructor(search) {
        super();
        this.search = search;
        this.input = search.searchInput;
        this.container = search.searchContainer;
        this.preferences = { ...SEARCH_LOCAL_DEFAULTS };
        this.private = chrome.extension?.inIncognitoContext === true;
        this.client = new SearchSuggestionClient();
        this.version = 0;
        this.preferencesVersion = 0;
        this.appearanceVersion = 0;
        this.items = [];
        this.activeIndex = -1;
        this.composing = false;
        // A new tab focuses the input automatically; only explicit interaction opens suggestions.
        this.engaged = false;
        this.animations = new Map();
    }

    init() {
        this.panel = document.createElement('div');
        this.panel.className = 'search-suggestions';
        this.panel.hidden = true;
        this.panel.setAttribute('aria-hidden', 'true');
        this.panel.inert = true;
        this.header = document.createElement('div');
        this.header.className = 'search-suggestions-label';
        this.list = document.createElement('div');
        this.list.id = 'searchSuggestions';
        this.list.setAttribute('role', 'listbox');
        this.panel.append(this.header, this.list);
        this.submitButton = document.createElement('button');
        this.submitButton.className = 'search-action search-submit';
        this.submitButton.type = 'button';
        this.submitButton.append(icon());
        this.container.append(this.submitButton);
        // Keep the panel outside the search box and animated layout layers
        // so its own glass filter can sample the wallpaper in Firefox.
        document.body.append(this.panel);
        this.input.autocomplete = 'off';
        this.input.setAttribute('role', 'combobox');
        this.input.setAttribute('aria-autocomplete', 'list');
        this.input.setAttribute('aria-controls', this.list.id);
        this.input.setAttribute('aria-expanded', 'false');
        this.translate();
        this._events.add(window, 'languageChanged', () => { this.translate(); this.refresh(); });
        this._events.add(this.input, 'input', () => {
            this.engaged = true;
            this.submitting = false;
            if (!this.composing) this.refresh();
        });
        this._events.add(this.input, 'compositionstart', () => { this.engaged = true; this.composing = true; this.close(); });
        this._events.add(this.input, 'compositionend', () => { this.engaged = true; this.composing = false; this.refresh(); });
        this._events.add(this.input, 'focus', () => { this.submitting = false; this.refresh(); });
        this._events.add(this.container, 'pointerdown', event => {
            if (!event.target.closest('button')) {
                this.engaged = true;
                this.submitting = false;
                this.refresh();
            }
        });
        const focusout = event => { if (!this.contains(event.relatedTarget)) this.dismiss(); };
        this._events.add(this.container, 'focusout', focusout);
        this._events.add(this.panel, 'focusout', focusout);
        this._events.add(document, 'pointerdown', event => {
            if (!this.contains(event.target)) this.dismiss();
        });
        this._events.add(window, 'blur', () => this.dismiss());
        this._events.add(window, 'resize', () => this.fitPanel());
        this._events.add(this.container.parentElement, 'transitionend', () => this.fitPanel());
        this._events.add(this.panel, 'pointerdown', event => {
            if (event.target.closest('button')) event.preventDefault();
        });
        this._events.add(this.panel, 'mouseover', event => {
            const row = event.target.closest('[data-index]');
            if (row) this.highlight(Number(row.dataset.index));
        });
        this._events.add(this.panel, 'click', event => {
            const row = event.target.closest('[data-index]');
            const item = row && this.items[Number(row.dataset.index)];
            if (!item) return;
            if (event.target.closest('.search-history-delete')) {
                requestSearchHistory('delete', item.query).then(() => {
                    // A late deletion must not steal focus or reopen a dismissed panel.
                    if (this.isDestroyed || !this.engaged || !this.contains(document.activeElement)) return;
                    this.input.focus();
                    this.refresh();
                })
                    .catch(() => toast(t('settingsSaveFailed')));
            } else if (event.target.closest('.search-suggestion-choice')) {
                this.input.value = item.query;
                this.search.submitQuery(item.query);
            }
        });
        this._events.add(this.submitButton, 'click', () => this.search.submitQuery());
        this._getStorageManager().register('search-local', (changes, area) => {
            if (area !== 'local' || !SEARCH_LOCAL_KEYS.some(key => changes[key])) return;
            this.client.clear();
            if (Object.keys(SEARCH_LOCAL_DEFAULTS).some(key => changes[key])) {
                this.close();
                this.loadPreferences();
            }
            else if (changes[SEARCH_HISTORY_KEY]) this.refresh();
        });
        this._getStorageManager().register('search-appearance', (changes, area) => {
            if (area === 'sync' && Object.keys(SEARCH_PANEL_DEFAULTS).some(key => changes[key])) this.loadAppearance();
        });
        const permissions = globalThis.browser?.permissions;
        if (permissions?.onRemoved) {
            const removed = () => { this.close(); this.client.clear(); };
            permissions.onRemoved.addListener(removed);
            this._addDisposable(() => permissions.onRemoved.removeListener(removed));
        }
        this._markInitialized();
        this.loadPreferences();
        this.loadAppearance();
    }

    translate() {
        this.input.setAttribute('aria-label', t('searchPlaceholder'));
        this.submitButton.setAttribute('aria-label', t('searchSubmit'));
        this.list.setAttribute('aria-label', t('searchSuggestionsList'));
    }

    async loadPreferences() {
        const version = ++this.preferencesVersion;
        try {
            const values = await getSearchPreferences();
            if (this.isDestroyed || version !== this.preferencesVersion) return;
            this.preferences = values;
            this.refresh();
        } catch { this.close(); }
    }

    async loadAppearance() {
        const version = ++this.appearanceVersion;
        try {
            const appearance = await chrome.storage.sync.get(SEARCH_PANEL_DEFAULTS);
            if (!this.isDestroyed && version === this.appearanceVersion) applySearchPanelAppearance(document.documentElement, appearance);
        } catch { /* CSS defaults preserve readability when settings cannot be read. */ }
    }

    cancel() {
        this.version++;
        this._timers.clearTimeout('suggestions');
        this.controller?.abort();
        this.controller = null;
    }

    contains(target) {
        return this.container.contains(target) || this.panel.contains(target);
    }

    dismiss() {
        this.engaged = false;
        this.close();
    }

    close() {
        this.cancel();
        this.items = [];
        this.activeIndex = -1;
        this.hidePanel();
    }

    hidePanel() {
        const wasOpen = !this.panel.hidden;
        const style = wasOpen ? getComputedStyle(this.panel) : null;
        const from = style ? { opacity: style.opacity, transform: style.transform } : null;
        this.panel.hidden = true;
        this.panel.setAttribute('aria-hidden', 'true');
        this.panel.inert = true;
        this.input.setAttribute('aria-expanded', 'false');
        this.input.removeAttribute('aria-activedescendant');
        if (wasOpen) {
            this.panel.classList.add('closing');
            this.animate(this.panel, [from, { opacity: 0, transform: 'translateY(-6px) scale(0.98)' }], 160,
                () => this.panel.classList.remove('closing'));
        }
    }

    async refresh() {
        if (this.isDestroyed) return;
        this.cancel();
        this.highlight(-1);
        if (!this.engaged || this.private || this.submitting || this.composing || this.search.isOpen || !this.contains(document.activeElement)) {
            this.close();
            return;
        }
        const version = this.version;
        const query = this.input.value.trim();
        const current = () => !this.isDestroyed && this.engaged && version === this.version && this.input.value.trim() === query && this.contains(document.activeElement);
        let history = [];
        if (this.preferences.searchHistoryEnabled) {
            try { history = (await requestSearchHistory('list')).filter(item => item.toLocaleLowerCase().includes(query.toLocaleLowerCase())); }
            catch { /* History failures never block ordinary search. */ }
        }
        if (!current()) return;
        // Keep the current surface while the next remote result is pending.
        if (history.length || !query || !this.preferences.searchSuggestionsEnabled || this.panel.hidden) this.render(history, []);
        if (!query || !this.preferences.searchSuggestionsEnabled) return;
        const provider = resolveSuggestionProvider(this.search.currentEngine, this.preferences.searchSuggestionSource);
        this.controller = new AbortController();
        const signal = this.controller.signal;
        this._timers.setTimeout('suggestions', async () => {
            if (!current()) return;
            const remote = await this.client.get(provider, query, signal);
            if (current() && !signal.aborted && this.preferences.searchSuggestionsEnabled) this.render(history, remote, provider);
        }, 280);
    }

    render(history, remote, provider) {
        const wasOpen = !this.panel.hidden;
        const oldHeight = wasOpen ? this.panel.getBoundingClientRect().height : 0;
        const previous = new Map([...this.list.children].map(row => [row._searchKey, { row, top: row.getBoundingClientRect().top }]));
        const panelStyle = getComputedStyle(this.panel);
        const from = { opacity: panelStyle.opacity, transform: panelStyle.transform };
        // Only content changes interrupt content animations. Closing/reopening is reversible.
        for (const { row } of previous.values()) this.animations.get(row)?.cancel();
        const panelAnimation = this.animations.get(this.panel);
        if (panelAnimation?.effect.getKeyframes().some(frame => 'height' in frame)) panelAnimation.cancel();
        const seen = new Set();
        const local = history.slice(0, remote.length ? 4 : 8).map(query => ({ query, kind: 'history' }));
        this.items = [...local, ...remote.map(query => ({ query, kind: 'suggestion' }))]
            .filter(item => { if (seen.has(item.query)) return false; seen.add(item.query); return true; }).slice(0, 8);
        this.activeIndex = -1;
        this.input.removeAttribute('aria-activedescendant');
        this.header.textContent = remote.length ? t('searchSuggestionsFrom', { engine: this.search.searchEngines[provider]?.label || provider }) : t('searchRecent');
        if (!this.items.length) {
            this.hidePanel();
            return;
        }
        const rows = this.items.map((item, index) => {
            const key = `${item.kind}:${item.query}`;
            const row = previous.get(key)?.row || this.createRow(item);
            row._searchKey = key;
            row.dataset.index = String(index);
            row.classList.remove('selected');
            const choice = row.querySelector('[role="option"]');
            choice.id = `searchSuggestion${index}`;
            choice.setAttribute('aria-selected', 'false');
            if (item.kind === 'history') row.querySelector('.search-history-delete').setAttribute('aria-label', t('searchDeleteHistory', { query: item.query }));
            return row;
        });
        // Restore input focus before removing the focused delete button.
        if ([...previous.values()].some(({ row }) => !rows.includes(row) && row.contains(document.activeElement))) this.input.focus();
        for (const { row, top } of previous.values()) {
            if (rows.includes(row)) continue;
            const rect = row.getBoundingClientRect();
            const panelRect = this.panel.getBoundingClientRect();
            row.remove();
            if (wasOpen && rect.height) {
                row.className = 'search-suggestion-row search-suggestion-exit';
                row.removeAttribute('data-index');
                row.querySelector('[role="option"]').removeAttribute('id');
                row.setAttribute('aria-hidden', 'true');
                row.inert = true;
                Object.assign(row.style, { position: 'absolute', top: `${top - panelRect.top + this.panel.scrollTop}px`, left: '8px', width: `${rect.width}px`, pointerEvents: 'none' });
                this.panel.append(row);
                this.animate(row, [{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: 'translateX(10px)' }], 150, () => row.remove());
            }
        }
        rows.forEach((row, index) => {
            if (this.list.children[index] !== row) this.list.insertBefore(row, this.list.children[index] || null);
        });
        this.panel.hidden = false;
        this.panel.inert = false;
        this.panel.setAttribute('aria-hidden', 'false');
        this.panel.classList.remove('closing');
        this.input.setAttribute('aria-expanded', 'true');
        this.fitPanel();
        if (!wasOpen) {
            this.animate(this.panel, [this.animations.has(this.panel) ? from : { opacity: 0, transform: 'translateY(-8px) scale(0.97)' },
                { opacity: 1, transform: 'translateY(0) scale(1)' }], 250);
        } else {
            const height = this.panel.getBoundingClientRect().height;
            if (Math.abs(oldHeight - height) > 1) this.animate(this.panel, [{ height: `${oldHeight}px` }, { height: `${height}px` }], 220);
            rows.forEach(row => {
                const old = previous.get(row._searchKey);
                const delta = old ? old.top - row.getBoundingClientRect().top : 0;
                if (old && Math.abs(delta) > 1) this.animate(row, [{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }], 220);
                else if (!old) this.animate(row, [{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], 180);
            });
        }
    }

    animate(element, frames, duration, done = () => {}) {
        this.animations.get(element)?.cancel();
        if (!element.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            done();
            return;
        }
        const animation = element.animate(frames, { duration, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' });
        this.animations.set(element, animation);
        const finish = () => {
            if (this.animations.get(element) === animation) {
                this.animations.delete(element);
                done();
            }
        };
        animation.onfinish = finish;
        animation.oncancel = finish;
    }

    createRow(item) {
        const row = document.createElement('div');
        row.className = 'search-suggestion-row';
        const choice = document.createElement('button');
        choice.type = 'button';
        choice.className = 'search-suggestion-choice';
        choice.tabIndex = -1;
        choice.setAttribute('role', 'option');
        choice.setAttribute('aria-selected', 'false');
        const text = document.createElement('span');
        text.textContent = item.query;
        choice.append(icon(item.kind === 'history'), text);
        row.append(choice);
        if (item.kind === 'history') {
            const remove = document.createElement('button');
            remove.className = 'search-history-delete';
            remove.type = 'button';
            remove.textContent = '×';
            remove.setAttribute('aria-label', t('searchDeleteHistory', { query: item.query }));
            row.append(remove);
        }
        return row;
    }

    fitPanel() {
        if (this.panel.hidden) return;
        const input = this.container.getBoundingClientRect();
        this.panel.style.top = `${input.bottom + 10}px`;
        this.panel.style.left = `${input.left}px`;
        this.panel.style.width = `${input.width}px`;
        const rect = this.panel.getBoundingClientRect();
        let bottom = window.innerHeight - 16;
        const dock = document.getElementById('quicklinksContainer')?.getBoundingClientRect();
        if (dock?.height && dock.top > rect.top && dock.left < rect.right && dock.right > rect.left) bottom = Math.min(bottom, dock.top - 12);
        this.panel.style.maxHeight = `${Math.max(88, Math.min(420, window.innerHeight * 0.45, bottom - rect.top))}px`;
    }

    highlight(index, scroll = false) {
        this.activeIndex = index;
        this.list.querySelectorAll('.search-suggestion-row').forEach((row, rowIndex) => {
            const selected = rowIndex === index;
            row.classList.toggle('selected', selected);
            row.querySelector('[role="option"]').setAttribute('aria-selected', String(selected));
        });
        if (index >= 0) {
            this.input.setAttribute('aria-activedescendant', `searchSuggestion${index}`);
            if (scroll) this.list.children[index]?.scrollIntoView?.({ block: 'nearest' });
        }
        else this.input.removeAttribute('aria-activedescendant');
    }

    handleKey(event) {
        if (event.isComposing || this.composing || event.keyCode === 229) return true;
        if (this.search.isOpen) return true;
        if (event.key === 'Escape' && !this.panel.hidden) {
            event.preventDefault(); event.stopPropagation(); this.dismiss(); return true;
        }
        if (event.key === 'ArrowDown' && this.panel.hidden) {
            event.preventDefault(); event.stopPropagation();
            this.engaged = true;
            this.submitting = false;
            this.refresh().then(() => { if (this.items.length) this.highlight(0, true); });
            return true;
        }
        if (this.items.length && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
            event.preventDefault(); event.stopPropagation();
            const index = this.activeIndex < 0 ? (event.key === 'ArrowDown' ? 0 : this.items.length - 1)
                : (this.activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + this.items.length) % this.items.length;
            this.highlight(index, true);
            return true;
        }
        if (event.key === 'Enter' && this.activeIndex >= 0) {
            event.preventDefault(); event.stopPropagation();
            this.input.value = this.items[this.activeIndex].query;
            this.search.submitQuery();
            return true;
        }
        return false;
    }

    async record(query) {
        this.engaged = false;
        this.submitting = true;
        this.close();
        if (this.private || !this.preferences.searchHistoryEnabled) return;
        try { await requestSearchHistory('add', query); }
        catch { /* A failed history write must not stop a search. */ }
    }

    destroy() {
        if (this.isDestroyed) return;
        this.close();
        for (const animation of this.animations.values()) animation.cancel();
        this.animations.clear();
        this.client.clear();
        this.panel.remove(); this.submitButton.remove();
        super.destroy();
    }
}
