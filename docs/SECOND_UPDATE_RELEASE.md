# Ember Tab 0.1.2 发布记录

2026-10-02：用户完成实际浏览器测试，授权更新 GitHub；AMO 由用户手动提交。

本版更新蓝色插件图标、自动壁纸刷新旋转提示、历史与联想面板展开／收起及删除动画。功能代码与用户测试版本相同，正式包只将预览更新日志改为发布措辞。

验证：678 项单元测试；Firefox 157.0 与 ESR 140.16.0 各 6 组 UI 检查和 10 组搜索回归；未注入夹具的运行包基础 10 组。ESLint 和可复现构建通过；web-ext 为 0 errors、0 notices、52 warnings。细节见 [实现记录](SECOND_UPDATE_IMPLEMENTATION.md)。

已于 **2026-10-02 21:39（北京时间）** 公开发布 [GitHub v0.1.2](https://github.com/LJure/ember-tab/releases/tag/v0.1.2)，不是草稿或预发布。功能源码已推送至 `main`；标签与源码包对应提交 `fdaee9cd6d0e6386b98a62454137920a7e48bff2`。后续主分支仅补充发布回执。

运行包 `ember-tab-0.1.2-firefox.zip`：117 个运行文件、544944 字节；SHA-256 `d3d7da0dfd892d381af5da1c0fe0974b0159b2239fc968ae4c161c2b4724652e`。匹配源码、手动材料包及校验值随 GitHub 发布提供。

- 审核源码 `ember-tab-0.1.2-source.zip`：284 个文件、29718797 字节，SHA-256 `efb1b19dbc02545e59ebcb72692a8bca765c9e62a1971b8cb7b9ac56ce6e0c61`。从独立目录解包后，无 npm 安装或 Git 检出即可重建出字节一致的运行包。源码包保留构建所需文件、图标原图、锁文件和第三方许可，排除本机配置、凭据、测试 ZIP 与不参与构建的历史上游截图。
- 完整商店材料 `ember-tab-0.1.2-amo-materials.zip`：31322459 字节，SHA-256 `fe4a3eacc44d5dd650e8bd4096bbf32cb4c5c50c03f18c4af8b0a7eae00c850d`；包含运行包、源码包、新图标、可选截图、三语言更新说明、2619 字符的英文审核备注、隐私副本、校验清单和手动指南。
- 发布页共七个附件：以上三个 ZIP、三个 `.sha256` 及 `ember-tab-0.1.2-submission.json`。GitHub API 确认全部为 `uploaded`，每个附件的远端 digest 和大小均与本地相符。

本机材料目录：`dist/amo/0.1.2/`。上传扩展文件用 `firefox.zip`，源码步骤用 `source.zip`；完整材料 ZIP 仅用于下载／解压整理，不作为扩展或源码上传。

AMO 公开 API 在 2026-10-02 核实当前版本为 0.1.1；本轮未代为提交 0.1.2。固定 ID 为 `ember-tab@ljure.github.io`。上传材料和流程见 [手动更新指南](SECOND_UPDATE_STORE_GUIDE.md)。

运行 ZIP 未签名，用于商店上传或开发者临时加载。日常用户安装商店签名版本。签名安装／同 ID 升级的验收独立记录。

GitHub Actions 在仓库设置中保持关闭；继承的 Chromium 工作流未启用。旧版本记录保留在 [首次更新发布记录](FIRST_UPDATE_RELEASE.md)。
