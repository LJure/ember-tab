# Ember Tab

An unofficial Firefox port of [Aura Tab by nil-byte](https://github.com/nil-byte/aura-tab), based on version 3.5.3, commit a706cee56e43b80777de697dd4462083b1f97ef8. Independently maintained; not affiliated with Mozilla or the original author. The upstream [MIT license](LICENSE) and copyright are preserved.

基于 Aura Tab 的非官方 Firefox 新标签页扩展，保留快捷链接、Dock、搜索、书签导入、本地／在线壁纸、照片、备份与 WebDAV。独立维护，名称为 **Ember Tab**。

**状态：M5 工程与审计完成，仍是 0.1.0 开发包。服务与素材审核及 M6 验收未完成；没有 AMO 发布。**

## 安装与迁移

使用 Node 24，依次运行 `npm ci`、`npm run build:firefox`。在 Firefox 的 `about:debugging#/runtime/this-firefox` 临时载入 `dist/firefox/manifest.json`。临时安装会在重启后移除，长期安装需要签名。目标 Firefox 140+ 桌面版，ESR 验收尚未完成。

Aura 数据通过 ZIP 导入；用户已验证 Brave／Aura 3.5.3 的 59 链接、37.1 MB 备份、真实 WebDAV、Firefox 账号设置／链接同步及慢图床图标修复。更大容量、跨设备冲突和正式升级仍需验证。恢复不具备跨数据库与 storage 的全局回滚。

普通包要求图床、在线服务和 WebDAV 使用 HTTPS。仅本机集成测试可以单独生成带 `-test-http` 标记的包。Chromium 历史配置不是 Firefox 安装入口。

## M5 变化

- 独立产品／相册／设置图标与默认壁纸（产品图标主体放大 14%），SVG 源文件随源码提供；Dock 默认行为保持上游一致。
- 本地隐私页、Firefox 数据传输声明、完整第三方许可与包检查；未接入统计、广告或开发者后端。
- 已移除 Unsplash／Pixabay 取图来源，保留历史收藏与备份兼容。新增 Wallhaven：随机 SFW 壁纸、指定公开／自己的私有收藏集、自动更换与上传者信息。[设置方法与验证](docs/WALLHAVEN.md)。
- 保留 Aura 数据键、备份 schema 和已有 WebDAV 目录兼容性；关于页和变更记录明确标注分叉来源。

## 文档

- [开发计划与接续](DEVELOPMENT_PLAN.md)
- [M5 结果与验证](docs/M5_RELEASE_PREPARATION.md)
- [素材、网络和服务条款审计](docs/M5_ASSET_AND_NETWORK_AUDIT.md)
- [动态 HTML 警告复核](docs/M5_HTML_AUDIT.md)
- [安装、迁移、构建与分发边界](docs/DISTRIBUTION.md)
- [隐私说明 / Privacy](privacy.html)
- [第三方许可](THIRD_PARTY_NOTICES.md)
- [M4 数据可靠性](docs/M4_DATA.md) · [图标恢复](docs/M4_ICON_RECOVERY.md)

GitHub Actions 保持暂停。上游宣传图和历史更新可在 [Aura Tab 仓库](https://github.com/nil-byte/aura-tab) 查看，不代表 Ember 已发布或经商店审核。
