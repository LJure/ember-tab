# Ember Tab 0.1.2 发布记录

2026-10-02：用户完成实际浏览器测试，授权更新 GitHub；AMO 由用户手动提交。

本版更新蓝色插件图标、自动壁纸刷新旋转提示、历史与联想面板展开／收起及删除动画。功能代码与用户测试版本相同，正式包只将预览更新日志改为发布措辞。

验证：678 项单元测试；Firefox 157.0 与 ESR 140.16.0 各 6 组 UI 检查和 10 组搜索回归；未注入夹具的运行包基础 10 组。ESLint 和可复现构建通过；web-ext 为 0 errors、0 notices、52 warnings。细节见 [实现记录](SECOND_UPDATE_IMPLEMENTATION.md)。

GitHub 目标：[v0.1.2](https://github.com/LJure/ember-tab/releases/tag/v0.1.2)。发布成功后，本文件记录提交、附件和远端校验结果。

运行包 `ember-tab-0.1.2-firefox.zip`：117 个运行文件、544944 字节；SHA-256 `d3d7da0dfd892d381af5da1c0fe0974b0159b2239fc968ae4c161c2b4724652e`。匹配源码、手动材料包及校验值随 GitHub 发布提供。

AMO 公开 API 在 2026-10-02 核实当前版本为 0.1.1；本轮未代为提交 0.1.2。固定 ID 为 `ember-tab@ljure.github.io`。上传材料和流程见 [手动更新指南](SECOND_UPDATE_STORE_GUIDE.md)。

运行 ZIP 未签名，用于商店上传或开发者临时加载。日常用户安装商店签名版本。签名安装／同 ID 升级的验收独立记录。

GitHub Actions 在仓库设置中保持关闭；继承的 Chromium 工作流未启用。旧版本记录保留在 [首次更新发布记录](FIRST_UPDATE_RELEASE.md)。
