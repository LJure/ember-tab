Ember Tab 0.1.3 fixes automatic shortcut icons and adds a visual icon chooser. 用户完成测试，Firefox 更新材料已准备。

- 修复大页面图标遗漏、备用大画布覆盖原站图、浅深色图标混用及已确认的备用占位图。
- 公共 HTTP 快捷链接先尝试 HTTPS 取图，导航地址保留原样。
- 编辑链接 → 自动 → 选择图标：比较来源与实际尺寸，点击应用本机选择，普通保存和重载保留；刷新图标缓存恢复自动选择。
- 修复相册全屏查看器的弹层和 Escape 行为。
- 仓库加入 Chrome 自用构建，固定身份和手动更新。此发布附件提供 Firefox 包；Chrome 继续由维护者本地构建。

Automatic icons now discover bounded metadata in large pages, preserve usable site originals and respect light/dark favicon declarations. Public HTTP shortcuts try HTTPS without changing navigation. Choose Icon lets users compare available originals and existing provider fallbacks; deliberate local choices survive ordinary edits and reloads. Image dimensions alone do not guarantee sharpness.

Firefox permissions and the add-on ID are unchanged. The privacy notice explains HTTPS attempts and explicit candidate requests. No new icon providers or remote executable code.

## Files and store status

- `firefox.zip`: unsigned extension runtime for AMO upload or temporary developer loading.
- `source.zip`: matching reviewable source, independently rebuilt to the identical runtime ZIP.
- `amo-materials.zip`: complete manual kit, including both packages, privacy text, notes, screenshot and guide.
- `submission.json` and `.sha256`: source commit, validation and checksums.

With Node 24.14.1, extract the source ZIP and run `node tools/build-firefox.mjs --release`; no npm install or Git checkout required. Local browser profiles, credentials and test-only extensions are excluded.

AMO public version was verified as **0.1.2 on 2026-10-03**. The maintainer will submit 0.1.3 manually; this GitHub release does not mean AMO upload, review, signing or publication. Daily installs should use the [Firefox store](https://addons.mozilla.org/zh-CN/firefox/addon/ember-tab-firefox/).

Validation: 717 unit tests; Firefox 157.0 and ESR 140.16.0 each passed 29 M3, 6 UI and 10 search checks; uninstrumented production baseline 10 checks; Chrome 18 runtime checks. Reproducible builds and ESLint passed. web-ext: 0 errors, 0 notices, 52 inherited warnings. Signed installation/upgrade acceptance remains separate.

[商店手动更新指南](https://github.com/LJure/ember-tab/blob/v0.1.3/docs/THIRD_UPDATE_STORE_GUIDE.md) · [发布验证记录](https://github.com/LJure/ember-tab/blob/v0.1.3/docs/THIRD_UPDATE_RELEASE.md)
