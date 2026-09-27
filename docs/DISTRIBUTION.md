# 开发安装、迁移与分发

当前为 Ember Tab 0.1.0 未签名开发包，不是 AMO 正式发布。固定 ID 为 `ember-tab@ljure.github.io`，目标桌面 Firefox 140+；完整 ESR 验证在 M6。

当前来源为本地、Wallhaven、Pexels、Bing；Unsplash／Pixabay 已移除，旧收藏保留。[Wallhaven 使用与收藏集验收](WALLHAVEN.md)包含设置方法及最新构建哈希。

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

输出 `dist/firefox/`、`dist/ember-tab-0.1.0-firefox.zip` 与 `.sha256`。ZIP 固定文件顺序及时间戳，同一源码和运行环境重复构建结果一致。品牌导出文件已入库，普通构建不需要图像工具；重绘时用 sharp 0.35.4 运行 `node tools/render-brand.mjs <sharp模块入口>`。原始 SVG 位于 `assets/brand/`。

`node tools/build-firefox.mjs --release` 会在 `ember.project.json` 的 releaseBlockers 未清空时拒绝构建，防止把开发包当作正式版。本开关不签名、不上传；只有完成对应证据后才能移除门槛。

正式候选包只允许 HTTPS 网络请求。仅本机集成测试使用 `node tools/build-firefox.mjs --test-http` 和 `node tools/test-firefox.mjs --m3 --test-http`；该包文件名有 `-test-http`，只增加 localhost／127.0.0.1 明文访问，不可作为发布包。测试后重新运行普通构建恢复 `dist/firefox/`。不要把测试包上传商店。

## 临时安装与更新

1. 在单独测试配置中打开 `about:debugging#/runtime/this-firefox`，选择“临时载入附加组件”，选 `dist/firefox/manifest.json`。
2. 重新构建后点“重新载入”，再打开新标签页；本阶段仍使用 0.1.0，不把重载视为已签名版本升级测试。
3. 临时扩展在浏览器重启后移除，需重新加载。长期安装需要 Mozilla 签名；没有把 ZIP 改成 XPI 就能绕过签名的步骤。
4. M6 正式签名包使用相同 ID 和递增版本。正式签名安装、权限提示和升级保留数据须另外验收。不要先卸载旧扩展来更新，以免清除本地数据。

## 数据迁移

- 从 Aura Tab 导出 ZIP，再在 Ember 设置的数据管理中恢复。已获用户验证：Brave／Aura 3.5.3，59 链接、37.1 MB ZIP。
- 恢复前另存当前 Ember 备份。恢复有单 store 事务，但没有跨数据库与扩展 storage 的全局回滚；中断后可能需重新导入完整备份。
- Sync 不跨 Chrome／Firefox 账号体系。本地图片 Blob 不走 Firefox Sync；WebDAV 或 ZIP 才带图片。图床图标需要重新下载，慢请求有排队及有限重试。
- API 密钥可能在备份与 Firefox sync 设置中；WebDAV 配置从 ZIP 排除。不要公开备份或测试凭据。
- 保存的 WebDAV 目录、数据库名、备份 schema 和 storage 键继续沿用 Aura 标识，以兼容旧数据。Dock 默认背板保持上游行为。
- HTTP 图床／WebDAV 需改成服务实际支持的 HTTPS 地址；不要仅盲目改前缀。HTTP 快捷链接仍能导航，自动图标可回退；不支持 HTTPS 的 WebDAV 不能在普通包中备份。

## 发布门槛

先完成 [M5 审计](M5_ASSET_AND_NETWORK_AUDIT.md) 中的服务条款与素材来源门槛，以及开发计划中的 M6 验收。再提交签名和商店资料：独立名称、原项目链接、差异说明、隐私政策、源代码与可复现步骤。商店名称／slug、图标展示、最新政策在实际提交日重新检查。

不启用继承的 Chrome 发布脚本；GitHub Actions 保持用户批准的暂停状态。源根目录 manifest 和上游打包脚本仅保留为 Chromium 历史参考，Firefox 必须使用上述构建入口。
