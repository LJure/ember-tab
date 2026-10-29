Ember Tab 0.1.5 fixes the remaining cold-start problems reported after 0.1.4: the startup wallpaper placeholder could be a flat average colour with no thumbnail, and the Dock stayed empty until extension storage finished initializing.

Changes are limited to startup painting. No permissions, host permissions, data categories, providers, analytics or remote code were added; the privacy policy is unchanged.

1. First-paint wallpaper snapshot
- The snapshot is now captured immediately when a wallpaper is applied instead of in `requestIdleCallback`. The idle callback could run after the source blob URL was revoked, so canvas capture silently failed and only the average colour was stored.
- If a direct `<img>` load fails, the image is fetched as a same-origin blob using existing extension host permissions, then drawn to the canvas.
- If a capture still fails, the previous snapshot's real thumbnail is kept instead of being replaced by a colour-only entry. The placeholder therefore stops looking like a blank grey page.
- Preview size stays 480x270; only capture reliability changed.

2. Quick links (Dock) local cache
- On startup the Dock now hydrates from a localStorage snapshot (`aura:quicklinks-cache:v1`) containing links, page structure, Dock pins, tags and quick links display settings, then refreshes once `store.init()` returns.
- The cache is written only after a complete successful load, so a partially read sync chunk set is never persisted.
- Cached entries are rendered with `pointer-events: none` until real data arrives, preventing drag or edit actions against stale order.
- A cache older than 14 days or with an unknown schema version is ignored.

3. Startup ordering
- Quick links initialization starts before language and theme storage reads instead of after them.

Verification performed by the maintainer: 99 test files / 725 unit tests, ESLint clean, reproducible Firefox and Chrome builds, web-ext lint 0 errors / 0 notices / 52 inherited warnings. User trial passed on the Chrome self-use build in Chrome and Edge; the Firefox runtime shares the same code path and its startup behaviour was verified in the 0.1.4 trial, but the full Firefox browser matrix was not re-run for 0.1.5.

Reviewer notes: the extension is an unofficial Firefox port of Aura Tab (MIT). Runtime code is plain ES modules, no bundler, no remote code. Rebuild command for the attached source: `node tools/build-firefox.mjs --release` with Node.js 24; npm install and Git are not required.
