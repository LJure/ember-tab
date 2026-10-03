# Ember Tab — attribution and third-party notices

Ember Tab is an independently maintained, unofficial port of [Aura Tab by nil-byte](https://github.com/nil-byte/aura-tab), baseline `a706cee56e43b80777de697dd4462083b1f97ef8` (3.5.3), with Firefox and Chrome builds. It is not affiliated with Mozilla, Google or the upstream author. The original `Copyright (c) 2026 nil-byte` and complete MIT license remain in [LICENSE](LICENSE). Ember modifications and the original geometric artwork added for this port are distributed under the same MIT terms.

## Bundled code

The following embedded libraries were compared with their official npm release packages on 2026-09-27. Their JavaScript matches after CRLF/LF normalization; they were not upgraded as part of this audit.

| Component | Version | Bundled file | Full license |
| --- | --- | --- | --- |
| [fflate](https://github.com/101arrowz/fflate) | 0.8.3 | scripts/libs/fflate.esm.js, official esm/browser.js | [MIT](licenses/fflate.txt) |
| [Interact.js](https://github.com/taye/interact.js) | 1.10.27 | scripts/libs/interact.min.js | [MIT](licenses/interactjs.txt) |
| [SortableJS](https://github.com/SortableJS/Sortable) | 1.15.7 | scripts/libs/sortable.min.js | [MIT](licenses/sortablejs.txt) |
| [Heroicons](https://github.com/tailwindlabs/heroicons) | outline glyphs identified by upstream comment; license from 2.2.0 | scripts/shared/toast.js inline SVG | [MIT](licenses/heroicons.txt) |

The `sortable-loader.js` wrapper belongs to the application, not a separate vendor bundle. Build/test dependencies in package-lock.json are not shipped in the extension.

## Images and remaining provenance boundary

The product PNGs and default background JPEG are Ember-authored geometric artwork, rendered from `assets/brand/*.svg`. The built-in `assets/icons/photo.jpg` and `assets/icons/setting.jpg` are restored unchanged from the Aura Tab baseline `a706cee56e43b80777de697dd4462083b1f97ef8`, at the user's request to preserve the original UI. Their individual external origins and separate redistribution rights have not been established; they must not be described as Ember-authored artwork or independently cleared by the application MIT license. Existing runtime filenames are retained for restored backup compatibility. The historical geometric alternatives remain in `assets/brand/photo.svg` and `assets/brand/setting.svg`, but the rendering tool no longer writes them over the restored icons.

`assets/other/` contains historical upstream screenshots, excluded from the extension package. Other inline application SVG paths are inherited under the upstream repository's MIT statement; apart from the identified Heroicons, individual outside origins have not been established. This is not an independent guarantee of the provenance of every upstream glyph; final release review must retain this limitation.

User images, site favicons and images fetched from online services remain subject to their owners' rights and the relevant service terms. The application MIT license does not relicense that content. See `docs/M5_ASSET_AND_NETWORK_AUDIT.md` in the repository for service-specific release gates.
