# Ember Tab 0.1.6 review notes

Ember Tab 0.1.6 restores Unsplash as an optional online wallpaper source. Users choose Unsplash in Settings and enter their own Unsplash access key; no key is bundled or shared.

Network use is limited to the existing wallpaper providers plus `api.unsplash.com` and Unsplash image hosts:

1. Random photo requests go to `https://api.unsplash.com/photos/random` with `orientation=landscape`, `content_filter=high`, an `Authorization: Client-ID <user key>` header and `Accept-Version: v1`.
2. Optional search requests go to `https://api.unsplash.com/search/photos` with the same headers.
3. Images are loaded from the returned `images.unsplash.com` URLs with sizing parameters.
4. The required download-tracking request is sent only to the returned `api.unsplash.com/photos/{id}/download` location. Attribution links add `utm_source=ember_tab&utm_medium=referral` on `unsplash.com`.

Changes are limited to wallpaper sourcing and the settings UI. Manifest permissions, host permissions, data-collection categories, the Gecko ID and optional permissions are unchanged. The bundled privacy notice now describes Unsplash requests; the Pixabay provider remains removed. Existing local, Wallhaven, Pexels and Bing options are unchanged, and previously saved photo-library items still render.

Verification performed by the maintainer: 99 test files / 728 unit tests, ESLint clean, reproducible Firefox and Chrome builds, web-ext lint 0 errors / 0 notices / 52 inherited warnings. The user reported 0.1.6 testing completed without issues. A live Unsplash key flow is not included in the automated suite; the provider tests mock the API response, headers and download-tracking URL.

Reviewer notes: the extension is an unofficial Firefox port of Aura Tab (MIT). Runtime code is plain ES modules, no bundler, no remote code. Rebuild command for the attached source: `node tools/build-firefox.mjs --release` with Node.js 24; npm install and Git are not required.
