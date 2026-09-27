# AMO submission materials — Ember Tab 0.1.0

Prepared 2026-09-27. These are local submission materials, not an AMO submission or approval. The package is unsigned. Listing text is in [RELEASE_HANDOFF.md](RELEASE_HANDOFF.md).

## Identity and scope

- Name: Ember Tab. Desktop Firefox 140+. Android is not claimed as supported.
- Extension ID: `ember-tab@ljure.github.io`. Version: `0.1.0`.
- Repository/support: https://github.com/LJure/ember-tab / https://github.com/LJure/ember-tab/issues
- Independent, unofficial port of https://github.com/nil-byte/aura-tab, version 3.5.3, commit `a706cee56e43b80777de697dd4462083b1f97ef8`.
- Upstream MIT copyright and license are preserved. Ember has separate branding and is not affiliated with Mozilla or the upstream author.

## Reproduce the submitted runtime package

Extract the accompanying source archive and use Node 24.14.1. From its root:

```text
node tools/build-firefox.mjs --release
```

The build itself uses Node built-ins and the included fflate library; it requires no downloaded build dependencies, secrets, credentials, Git checkout, or image tools. Generated artwork is included together with its SVG source. Output is `dist/ember-tab-0.1.0-firefox.zip`; SHA-256 is also written beside it. Expected package hash is recorded in [M6_ACCEPTANCE.md](M6_ACCEPTANCE.md).

To run additional checks with npm 11.11.0:

```text
npm ci
npm test
npm run lint
npm run test:firefox-build
npm run lint:firefox
```

Use `dist/firefox/manifest.json` for temporary Firefox loading. The root `manifest.json` is retained Chromium history and is not the submitted manifest. The build replaces the icon runtime adapter, generates Firefox background/data declarations and includes only allowed runtime paths. Never submit the separate `-test-http` integration-test build.

Application code is readable ES modules without transpilation or bundling. Included third-party distribution files are fflate 0.8.3, Interact.js 1.10.27 and SortableJS 1.15.7; paths and complete licenses are in `THIRD_PARTY_NOTICES.md` and `licenses/`. M5 checked them against the published packages. Official packages: https://www.npmjs.com/package/fflate/v/0.8.3, https://www.npmjs.com/package/interactjs/v/1.10.27, https://www.npmjs.com/package/sortablejs/v/1.15.7.

## Permissions and data

`storage` and `unlimitedStorage` support settings, backups and local image libraries; `alarms` handles configured wallpaper refresh; `search` submits searches to Firefox's configured engine; `bookmarks` supports user-initiated import. `https://*/*` supports arbitrary user-selected link/icon/image hosts and HTTPS WebDAV servers. There are no content scripts, history-database access or developer-operated analytics servers.

Required transmission categories: authenticationInfo, bookmarksInfo, browsingActivity, searchTerms and websiteContent. The full bilingual privacy notice is included as `privacy.html`; its text is intended for the AMO privacy-policy field. It describes search, icon fallbacks, remote wallpaper, Firefox Sync and user-configured WebDAV, including that wallpaper API keys can be in sync storage/backups. No credentials or private backups are included in the submission archive.

## Review walkthrough

1. Install in a disposable desktop Firefox profile and open a new tab. The default wallpaper is bundled original artwork; no wallpaper-service account is needed.
2. Open Settings to change language/theme, add/edit shortcuts, import test bookmarks, select a local image, export a ZIP and restore it. Backup restore overwrites data; use test data only.
3. In wallpaper settings, Wallhaven supports random SFW or a public collection without a key. A user's own private collection needs that user's key. Pexels needs a user-supplied API key. Bing wallpaper remains available. Service review and product decisions are in `docs/M6_SOURCE_REVIEW.md`.
4. Pexels backgrounds retain photographer/source credit even when ordinary photo information is hidden, with a link to the work. Wallhaven labels the uploader rather than claiming photographer authorship.
5. WebDAV is optional and needs a reviewer-controlled HTTPS server and credentials. Firefox Sync uses the reviewer's Firefox account. No shared production credentials are provided or embedded.

## Known limits and validator output

No cross-device conflict merging or cross-database restore rollback is claimed. Additional interrupted-restore protection and permission-revocation verification were deferred; long-running wallpaper rotation remains follow-up validation. These limitations are recorded openly in the development plan.

The local validator has 0 errors and 52 warnings: 51 dynamic HTML warnings documented in `docs/M5_HTML_AUDIT.md`, plus a Firefox Android compatibility warning outside the declared desktop scope. Review those boundaries directly; local validation is not a claim of store approval. Stable/ESR temporary loading and simulated lifecycle tests do not replace signed install/upgrade acceptance.

## Maintainer submission checklist

- [ ] Confirm the Mozilla account and choose listed AMO distribution or unlisted signing; no account credentials belong in these files.
- [ ] Recheck the final name/slug in the actual submission form; no slug is reserved by this draft.
- [ ] Upload the runtime ZIP and corresponding source archive, add the listing text, privacy notice and these reviewer notes.
- [ ] Supply only original-artwork screenshots without user links or third-party wallpaper licensing assumptions.
- [ ] Obtain the signed package; test install, restart, permissions/data consent and a later same-ID signed upgrade, recording exactly what was tested.
- [ ] Publish/distribute only after the maintainer approves the final submission and distribution checks are addressed.

Official guidance consulted: [Submitting an add-on](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/) and [Source code submission](https://extensionworkshop.com/documentation/publish/source-code-submission/). The former distinguishes listed and self-distributed signing; the latter explains reviewable source and build instructions. No submission has been performed.
