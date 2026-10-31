Ember Tab 0.1.6 恢复 Unsplash 作为在线壁纸来源：在设置中选择 Unsplash 并填入自己的 Unsplash Access Key 后，即可获取横向、高内容过滤的随机照片。用户已完成本地测试，Firefox 商店更新材料已准备。

- 设置页新增 Unsplash 选项与 Access Key 输入行，申请入口指向 unsplash.com/developers。
- 随机照片通过 api.unsplash.com 获取，默认横向、高内容过滤；请求只带 `Client-ID` 认证头和版本头。
- 壁纸信息显示摄影师署名，摄影师与图片页链接带 `utm_source=ember_tab` 参数；按 Unsplash API 要求记录一次下载计数，且只请求 api.unsplash.com。
- 照片库新增 Unsplash 分类，历史 Unsplash 收藏仍可浏览；本地、Wallhaven、Pexels、Bing 来源与旧收藏行为不变。
- 隐私说明已更新 Unsplash 的请求字段；Pixabay 来源仍不提供。

Unsplash is optional and requires the user's own API key. Existing providers, permissions, host permissions, data categories and the extension ID are unchanged; no remote executable code is added. The privacy notice now describes Unsplash requests. Demo Unsplash applications are limited to 50 requests per hour.

## 文件与商店状态

- `firefox.zip`：AMO 上传或开发者临时加载用的未签名运行包。
- `source.zip`：对应源码，独立解压重建后与运行包逐字节一致。
- `amo-materials.zip`：手动更新整包，含两个压缩包、隐私文本、说明、审核备注、可选截图和指南。
- `submission.json` 与 `.sha256`：源提交、验证摘要与校验值。

使用 Node.js 24 解压源码并执行 `node tools/build-firefox.mjs --release` 即可重建，无需 npm 安装或 Git 检出；本地浏览器配置、凭据和测试专用扩展已排除。

经 AMO API 核实，商店当前公开版本为 **0.1.5**（文件 ID `5182094`，2026-10-31 查询）。0.1.6 由维护者手动上传；本次准备不代表已上传、已审核、已签名或已公开。日常安装请使用 [Firefox 商店](https://addons.mozilla.org/zh-CN/firefox/addon/ember-tab-firefox/)。

验证：99 个测试文件 / 728 项单元测试、ESLint 通过、Firefox 与 Chrome 可重复构建、web-ext 0 错误 / 0 notices / 52 项既有警告；用户确认 0.1.6 本地测试无问题。签名包升级验收仍需在商店版本公开后进行。

[商店手动更新指南](https://github.com/LJure/ember-tab/blob/main/docs/SIXTH_UPDATE_STORE_GUIDE.md) · [发布验证记录](https://github.com/LJure/ember-tab/blob/main/docs/SIXTH_UPDATE_RELEASE.md)
