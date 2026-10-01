# AMO review notes — Ember Tab 0.1.1

Update to the existing listed add-on `ember-tab-firefox`; ID `ember-tab@ljure.github.io`. Desktop Firefox 140+, not Android. Independently maintained, unofficial port of Aura Tab 3.5.3 by nil-byte; upstream MIT copyright is preserved.

Extract the matching source ZIP and run `node tools/build-firefox.mjs --release` with Node 24.14.1. No npm install, Git checkout, image tools, account credentials or secrets are needed to build. Expected runtime SHA-256: `ffaca1f29339240df43a8137fc662abfa67fe57f3345b8ba1b135a05a5a47820`. Root manifest is Chromium history; submit only `dist/ember-tab-0.1.1-firefox.zip`. Third-party fflate, Interact.js and SortableJS versions/licenses are in `THIRD_PARTY_NOTICES.md` and `licenses/`. Readable ES modules; no new remote code.

Changes: original Photos/Settings JPEGs restored unchanged from the recorded Aura baseline; optional local history and live suggestions; opacity/blur controls in Appearance; search submission to a new tab clears/unfocuses the original input.

Both new search features default off. History: max 100 submitted queries, deduplicated, delete-one/clear-all; stored only in local extension storage. History and the two feature switches/source choice are excluded from Firefox Sync, ZIP, WebDAV and migration; restore preserves device-local values. Private windows neither read/write history nor request suggestions. Appearance numbers use normal sync/backup settings and contain no search terms.

Enabled suggestions send typed terms only to the selected provider, over HTTPS, without cookies, redirects or remote scripts, with timeout/response-size limits. Firefox searchTerms data-transfer consent is checked. Eight directly supported engines follow the plugin search-box selection; browser-default/Sogou/Ecosia use the independent source choice (Bing/Google/Baidu/DDG/Brave). A suggestion still searches using the original engine. No silent provider fallback. Full bilingual privacy text is supplied for the listing privacy field and bundled in `privacy.html`.

Review: Settings > General > Search enables either feature and selects independent source; search in a disposable profile, hover a history row to delete. Appearance > Search history and suggestions adjusts both panels and resets their style. New-tab autofocus stays collapsed. Submit with new-tab results enabled, return to Ember and confirm empty/unfocused input.

Validation: 671 unit tests; Firefox 157.0 / ESR 140.16.0 isolated checks; web-ext 0 errors, 0 notices, 52 existing warnings. User trial passed. Signed installation/upgrade acceptance is separate and not claimed complete. See `docs/FIRST_UPDATE_IMPLEMENTATION.md` for evidence and inherited limits.
