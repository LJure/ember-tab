Ember Tab 0.1.4 fixes the slow first paint that could leave the new tab page at 00:00 with no wallpaper or Dock for several seconds. 用户完成 Firefox 和 Chrome 自用版本地测试，Firefox 商店更新材料已准备。

- 浏览器启动时立即显示时钟和壁纸，不再等待扩展存储完成初始化。
- 时钟先用默认格式绘制，存储返回后再应用用户的格式、日期和秒数设置。
- Dock 去掉额外的空闲延迟，冷启动时快捷链接更早出现。
- 首屏壁纸预览保留到真实壁纸就绪，并把预览从 48×27 提升到 480×270，避免短暂无壁纸或只剩纯色背景。

Clock and wallpaper now initialize before language and theme read extension storage. The clock paints immediately with default formatting and refreshes when saved settings arrive. Quick links no longer wait for an idle callback, and the startup wallpaper preview stays on screen until the real wallpaper is applied.

Firefox permissions, host permissions, data categories and the add-on ID are unchanged. There are no new providers, analytics or remote executable code; the privacy notice does not change.

## Files and store status

- `firefox.zip`: unsigned extension runtime for AMO upload or temporary developer loading.
- `source.zip`: matching reviewable source, independently rebuilt to the identical runtime ZIP.
- `amo-materials.zip`: complete manual kit, including both packages, privacy text, notes, optional screenshot and guide.
- `submission.json` and `.sha256`: source commit, validation and checksums.

With Node 24.14.1, extract the source ZIP and run `node tools/build-firefox.mjs --release`; no npm install or Git checkout required. Local browser profiles, credentials and test-only extensions are excluded.

AMO public version was verified as **0.1.3 on 2026-10-28**. The maintainer will submit 0.1.4 manually; this preparation does not mean AMO upload, review, signing or publication. Daily installs should use the [Firefox store](https://addons.mozilla.org/zh-CN/firefox/addon/ember-tab-firefox/).

Validation: 718 unit tests; reproducible Firefox and Chrome builds; ESLint passed; user startup trial on Firefox and the Chrome self-use build. web-ext: 0 errors, 0 notices, 52 inherited warnings. Signed installation/upgrade acceptance remains separate.

[商店手动更新指南](https://github.com/LJure/ember-tab/blob/main/docs/FOURTH_UPDATE_STORE_GUIDE.md) · [发布验证记录](https://github.com/LJure/ember-tab/blob/main/docs/FOURTH_UPDATE_RELEASE.md)
