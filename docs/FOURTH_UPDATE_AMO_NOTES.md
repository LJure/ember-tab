# AMO review notes — Ember Tab 0.1.4

Update to the existing listed ember-tab-firefox add-on, ID ember-tab@ljure.github.io, desktop Firefox 140+. Unofficial independent port of Aura Tab 3.5.3 by nil-byte, with MIT attribution and third-party licenses preserved.

Extract the matching source ZIP; with Node 24.14.1 run `node tools/build-firefox.mjs --release`. No npm install, Git checkout, account or image tools are required. Independent source extraction rebuilds the identical runtime ZIP; digests and validation are in submission.json. The root manifest is historical Chromium input, not the uploaded Firefox manifest. Readable application modules and library/license references are in THIRD_PARTY_NOTICES.md, licenses/ and docs/M6_SOURCE_REVIEW.md. Public loopback TLS fixtures are test-only, excluded from the runtime. Upload the firefox.zip, not the complete materials ZIP or a Chrome package.

Changes: the new tab page now paints the clock and wallpaper before reading extension storage, rather than blocking both behind language and theme settings. The clock starts from default formatting and updates when stored settings arrive. Quick links/Dock initialize without the previous idle-callback delay, and the startup wallpaper preview remains until the real wallpaper is painted, at a sharper preview size. This removes a cold-start interval where the page could sit at the static 00:00 placeholder with no wallpaper or Dock.

No new permissions, host permissions, data categories, providers, analytics, remote executable code or add-on ID changes. No migration or storage-schema changes. Firefox and Chrome self-use builds share the same application code.

Review: install, restart Firefox, and open the new tab page as the startup page. The clock, wallpaper and Dock should appear promptly without a multi-second 00:00 or blank-background interval. Reload and repeat with wallpapers from local, Bing, Pexels and Wallhaven sources; existing shortcuts, settings, photos, history and icon choices should be unchanged.

Validation: user trial on Firefox and the Chrome self-use build; 718 unit tests; reproducible Firefox/Chrome builds; ESLint passed. web-ext: 0 errors, 0 notices, 52 inherited warnings. Signed install/upgrade remains separate.
