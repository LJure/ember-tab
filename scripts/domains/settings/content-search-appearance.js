import { t } from '../../platform/i18n.js';
import { patchSyncSettings } from '../../platform/settings-repo.js';
import { SEARCH_PANEL_DEFAULTS, SEARCH_PANEL_BOUNDS, normalizeSearchPanelAppearance, applySearchPanelAppearance } from '../../platform/search-appearance.js';
import { escapeHtml } from '../../shared/text.js';
import { toast } from '../../shared/toast.js';
import { createSettingsBuilder } from './builder.js';

export function initSearchPanelAppearance(container) {
    let draft = { ...SEARCH_PANEL_DEFAULTS };
    let committed = { ...draft };
    const apply = values => { draft = applySearchPanelAppearance(document.documentElement, values); };
    const controls = [
        { key: 'searchPanelOpacity', id: 'macSearchPanelOpacity', label: 'settingsSearchPanelOpacity', desc: 'settingsSearchPanelOpacityDesc', unit: '%' },
        { key: 'searchPanelBlur', id: 'macSearchPanelBlur', label: 'settingsSearchPanelBlur', unit: 'px' }
    ];
    const builder = createSettingsBuilder(container, {
        sections: [{
            type: 'section', titleKey: 'settingsSearchPanelAppearance',
            rows: [
                ...controls.map(({ key, id, label, desc, unit }) => ({
                    type: 'slider', id, labelKey: label, descKey: desc,
                    controlStyle: 'flex: 1; max-width: 200px;',
                    storageKey: key, defaultValue: SEARCH_PANEL_DEFAULTS[key],
                    min: 0, max: SEARCH_PANEL_BOUNDS[key], step: 1, fillId: `${id}Fill`,
                    formatValue: value => `${value}${unit}`,
                    read: ({ storage }) => normalizeSearchPanelAppearance(storage.sync)[key],
                    bind: ({ builder }) => builder.getById(id)?.setAttribute('aria-label', t(label)),
                    onInput: ({ value }) => apply({ ...draft, [key]: value }),
                    write: async value => {
                        const normalized = normalizeSearchPanelAppearance({ ...draft, [key]: value });
                        try {
                            await patchSyncSettings({ [key]: normalized[key] });
                            committed = { ...committed, [key]: normalized[key] };
                            apply(normalized);
                        } catch (error) {
                            apply(committed);
                            await builder.load();
                            throw error;
                        }
                    }
                })),
                {
                    type: 'custom', html: `<div class="mac-search-panel-preview" role="img" aria-label="${escapeHtml(t('settingsSearchPanelPreview'))}">
                        <span class="mac-search-panel-preview-title">${escapeHtml(t('settingsSearchPanelPreview'))}</span>
                        <div class="mac-search-panel-preview-stage"><div class="mac-search-panel-preview-surface">
                            <div class="mac-search-panel-preview-label">${escapeHtml(t('searchRecent'))}</div>
                            <div class="mac-search-panel-preview-item"><span aria-hidden="true">◷</span> ember tab</div>
                            <div class="mac-search-panel-preview-item"><span aria-hidden="true">⌕</span> steam</div>
                        </div></div></div>`
                },
                {
                    type: 'custom', labelKey: 'settingsSearchPanelReset',
                    controlHtml: `<button class="mac-button" type="button" id="macSearchPanelReset">${escapeHtml(t('settingsSearchPanelReset'))}</button>`,
                    bind: ({ builder }) => {
                        const button = builder.getById('macSearchPanelReset');
                        button?.addEventListener('click', async () => {
                            button.disabled = true;
                            try {
                                await patchSyncSettings({ ...SEARCH_PANEL_DEFAULTS });
                                await builder.load();
                            } catch { toast(t('settingsSaveFailed')); }
                            finally { button.disabled = false; }
                        });
                    }
                }
            ]
        }],
        onAfterLoad: ({ storage }) => {
            committed = normalizeSearchPanelAppearance(storage.sync);
            apply(committed);
        }
    });
    void builder.init();
    return builder;
}
