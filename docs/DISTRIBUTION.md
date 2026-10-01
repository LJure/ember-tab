# 开发安装、迁移与分发

2026-10-01 更新：[Ember Tab 0.1.0 已在 Firefox 附加组件商店上架](https://addons.mozilla.org/zh-CN/firefox/addon/ember-tab-firefox/)。普通用户应使用商店安装；下方“未签名候选包”仅指开发者本地构建物。正式签名 XPI 的安装／升级验收仍待记录，见 [当前进度](AMO_SUBMISSION_STATUS.md)。

首次更新的本地候选版本为 **0.1.1**，仍未签名、未提交 AMO；本次功能与测试见 [首次更新实现记录](FIRST_UPDATE_IMPLEMENTATION.md)。固定 ID 为 `ember-tab@ljure.github.io`，目标桌面 Firefox 140+；首版稳定版 156.0.1 与 ESR 140.16.0 的历史矩阵见 [M6 验收](M6_ACCEPTANCE.md)，首版提交状态见 [Mozilla 提交进度](AMO_SUBMISSION_STATUS.md)。

当前来源为本地、Wallhaven、Pexels、Bing；Unsplash／Pixabay 已移除，旧收藏保留。用户确认 Pexels 真实取图、Wallhaven 私有收藏集通过。设置方法见 [Wallhaven 使用](WALLHAVEN.md)，最新构建哈希以 [M6 验收](M6_ACCEPTANCE.md) 为准。

## 复现构建

在当前阶段分支检出源码，使用 Node 24.14.1 / npm 11.11.0（本次环境）：

```powershell
npm ci
npm test
npm run lint
npm run test:firefox-build
npm run build:firefox
npm run lint:firefox
```

输出 `dist/firefox/`、`dist/ember-tab-0.1.1-firefox.zip` 与 `.sha256`，版本读取 `ember.project.json` 的 `currentVersion`。ZIP 固定文件顺序及时间戳，同一源码和运行环境重复构建结果一致。品牌导出文件已入库，普通构建不需要图像工具；重绘产品图标和默认壁纸时用 sharp 0.35.4 运行 `node tools/render-brand.mjs <sharp模块入口>`。原始 SVG 位于 `assets/brand/`。2026-10-01 起相册／设置 JPEG 已按用户要求恢复上游原版，品牌导出工具不再覆盖它们，历史几何 SVG 不用于当前包；见 [首次更新](FIRST_UPDATE_ASSESSMENT.md)。

`node tools/build-firefox.mjs --release` 会在 `ember.project.json` 的 releaseBlockers 非空时拒绝构建。本轮候选构建门槛已按核查结果和用户范围决定处理，可以生成未签名候选包。本开关不签名、不上传。签名安装／升级与正式分发单列在 distributionBlockers，仍未完成；生成候选包不清除该门槛。

正式候选包只允许 HTTPS 网络请求。仅本机集成测试使用 `node tools/build-firefox.mjs --test-http` 和 `node tools/test-firefox.mjs --m3 --test-http`；该包文件名有 `-test-http`，只增加 localhost／127.0.0.1 明文访问，不可作为发布包。测试后重新运行普通构建恢复 `dist/firefox/`。不要把测试包上传商店。

## 临时安装与更新

1. 在单独测试配置中打开 `about:debugging#/runtime/this-firefox`，选择“临时载入附加组件”，选 `dist/firefox/manifest.json`。
2. 重新构建后点“重新载入”，再打开新标签页；首次更新候选使用 0.1.1，临时加载的重载／升级不代表正式签名包升级验收。
3. 临时扩展在浏览器重启后移除，需重新加载。长期安装需要 Mozilla 签名；没有把 ZIP 改成 XPI 就能绕过签名的步骤。
4. M6 正式签名包使用相同 ID 和递增版本。正式签名安装、权限提示和升级保留数据须另外验收。不要先卸载旧扩展来更新，以免清除本地数据。

## 数据迁移

- 从 Aura Tab 导出 ZIP，再在 Ember 设置的数据管理中恢复。已获用户验证：Brave／Aura 3.5.3，59 链接、37.1 MB ZIP。
- 恢复前另存当前 Ember 备份。恢复有单 store 事务，但没有跨数据库与扩展 storage 的全局回滚；中断后可能需重新导入完整备份。
- 具体预备、失败重试与回到旧备份的步骤见 [发布交接清单](RELEASE_HANDOFF.md#恢复中断的当前处理步骤)。当前没有自动安全副本或自动回滚；用户决定额外保护留待后续版本，不作为首版门槛。
- Sync 不跨 Chrome／Firefox 账号体系。本地图片 Blob 不走 Firefox Sync；WebDAV 或 ZIP 才带图片。图床图标需要重新下载，慢请求有排队及有限重试。
- API 密钥可能在备份与 Firefox sync 设置中；WebDAV 配置从 ZIP 排除。不要公开备份或测试凭据。
- 0.1.1 搜索历史及其新开关／联想来源只在本机保存，从 ZIP、WebDAV 和迁移排除；恢复时不导入这些字段，保留本机历史和选择。
- 历史／联想面板的不透明度与模糊强度属于普通外观设置，只保存数值，随 Firefox Sync 和备份保留，不包含搜索词。
- 保存的 WebDAV 目录、数据库名、备份 schema 和 storage 键继续沿用 Aura 标识，以兼容旧数据。Dock 默认背板保持上游行为。
- HTTP 图床／WebDAV 需改成服务实际支持的 HTTPS 地址；不要仅盲目改前缀。HTTP 快捷链接仍能导航，自动图标可回退；不支持 HTTPS 的 WebDAV 不能在普通包中备份。

## 发布门槛

当前服务／素材复核和用户决定见 [M6 来源审核](M6_SOURCE_REVIEW.md)，审阅资料见 [AMO reviewer notes](AMO_REVIEWER_NOTES.md)。首版已上架，商店名称 Ember Tab、slug `ember-tab-firefox`；0.1.1 当前只完成本地实现与候选验证，尚未提交更新或完成该版本的正式签名安装／升级验收。

不启用继承的 Chrome 发布脚本；GitHub Actions 保持用户批准的暂停状态。源根目录 manifest 和上游打包脚本仅保留为 Chromium 历史参考，Firefox 必须使用上述构建入口。
