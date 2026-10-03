# AMO review notes — Ember Tab 0.1.3

Update to the existing listed ember-tab-firefox add-on, ID ember-tab@ljure.github.io, desktop Firefox 140+. Unofficial independent port of Aura Tab 3.5.3 by nil-byte, with MIT attribution and third-party licenses preserved.

Extract the matching source ZIP; with Node 24.14.1 run `node tools/build-firefox.mjs --release`. No npm install, Git checkout, account or image tools are required. Independent source extraction rebuilds the identical runtime ZIP; digests and validation are in submission.json. The root manifest is historical Chromium input, not the uploaded Firefox manifest. Readable application modules and library/license references are in THIRD_PARTY_NOTICES.md, licenses/ and docs/M6_SOURCE_REVIEW.md. Public loopback TLS fixtures are test-only, excluded from the runtime. Upload the firefox.zip, not the complete materials ZIP or a Chrome package.

Changes: bounded early metadata parsing for large pages; usable site icons outrank larger provider rasters; light/dark favicon media follows the current theme; a known Vemetric placeholder SVG is filtered. Public default-port HTTP shortcuts try HTTPS for discovery without changing saved navigation URLs or requesting HTTP permissions. Image/manifest byte and time limits remain enforced.

Choose Icon in the automatic icon editor explicitly fetches multiple website and existing Google/Vemetric candidates, showing source and decoded size. Opening the chooser does not replace the cache; clicking applies the raw image locally. Ordinary saves/reloads and late automatic results preserve the choice. Refresh Icon Cache resets it to automatic. Closing/changing the editor invalidates pending candidate UI. Candidate responses are deduplicated and bounded. The privacy notice now explains these requests. No new providers, analytics, remote executable code, Firefox permissions or add-on ID. Local history/suggestion defaults and exclusion from Sync/backups/migration are unchanged.

Also fixes Photos fullscreen modal/Escape layering. Chrome self-use build tooling shares code; Firefox output excludes Chrome background/offscreen configuration and test tools.

Review: add/edit an HTTPS shortcut, select Automatic, click Choose Icon, compare candidates, click one, save/reload, then Refresh Icon Cache. HTTP links to news.qq.com and bilibili.com can now discover HTTPS originals; image size does not guarantee detail. Test light/dark site icons and Escape from Photos fullscreen back to the album.

Validation: user trial; 717 unit tests; Firefox 157.0 and ESR 140.16.0 each passed 29 M3, 6 UI and 10 search checks; production baseline 10 checks. web-ext: 0 errors, 0 notices, 52 inherited warnings. Signed install/upgrade remains separate.
