# Ember Tab 0.1.2 UI/UX 更新

日期：2026-10-02。基于远端 `main` 的 `32c15eb`，工作分支 `feat/second-update-ui-ux`。用户完成本地测试，授权更新 GitHub；商店由用户手动提交。GitHub 发布回执见 [发布记录](SECOND_UPDATE_RELEASE.md)，商店流程见 [手动指南](SECOND_UPDATE_STORE_GUIDE.md)。

## 本次变化

- 插件图标使用用户提供的蓝色透明 PNG，原文件保存在 `assets/brand/ember.png`，按原比例导出 16、32、48、128px。扩展列表和工具栏均使用新图标；32px 用于高像素密度显示。原图 SHA-256：`4890c8e895ac063817ffc0c06f13fb5d533bf35f3defa4ba258d9e5c7c623e18`，与附件完全一致。生成工具改读该 PNG，避免下次生成时恢复旧图标。
- 自动更新壁纸与手动刷新共用左上角按钮的旋转提示，覆盖后台闹钟消息、打开新标签页后的自动更换，以及回到页面时到期更新。提示贯穿获取、解码、应用及保存，结束后保留原有 500ms 收尾；失败和回退也会停止。并发操作计数防止某一次完成提前停掉其他更新的提示。缓存预取不触发提示。
- 搜索历史与联想共用面板：250ms 淡入／轻微缩放展开，160ms 淡出／上移收起；删除条目淡出，保留原有条目节点，剩余条目补位、面板高度约 220ms 平滑过渡。异步刷新保留当前面板，减少整块隐藏造成的闪烁。收起时立即取消请求、停止交互并更新无障碍状态，视觉动画随后结束。快速重新打开会反向衔接当前动画。
- 删除请求结束时尊重用户当前焦点；已离开面板时不会重新聚焦搜索框。输入新搜索词立即清除旧键盘选择，避免等待联想更新时 Enter 提交旧候选。系统设置减少动态效果时跳过面板／条目动画。

## 验证

- 单元回归：90 个文件、678 项全部通过。新增覆盖并发刷新、冷却期间重新刷新、初始化中的手动刷新、失败清理、历史列表节点保留、延迟删除后的焦点及新输入的键盘选择。
- ESLint 与可复现构建检查通过；web-ext 为 0 errors、0 notices、52 warnings，与上版计数相同。
- Firefox 157.0 与 ESR 140.16.0 的 UI 专项各 6 组通过：四个图标尺寸及透明度、展开／失焦收起与快速重开、删除保持面板及条目动画、自动消息／可见性刷新旋转、失败回退停止、减少动态效果。
- Firefox 157.0 与 ESR 140.16.0 搜索回归各 10 组通过，覆盖设置、历史增删、面板外观／对齐、引擎路由、输入法／乱序响应、取消、真实 ZIP 备份与实际无痕窗口。
- 未注入夹具的预览包：Firefox 157.0 基础 10 组通过，包含启动、设置持久化、后台唤醒、闹钟及扩展重载。

UI 专项使用隔离 Firefox 配置和单独测试 ZIP，在测试包中暴露实际页面的壁纸控制器，用本地延迟图片代替服务请求来检查全过程状态。搜索矩阵拦截导航并使用确定性联想；本次没有重复验证在线服务的真实接口。测试夹具不进入交付包。浏览器截图使用无头软件合成；用户随后完成了实际浏览器试用。发布整理仅将更新日志的预览措辞改为正式说明，功能代码与用户测试版本一致。

本机证据均在忽略目录：`.local/second-update/`、`.local/second-update-esr/`、`.local/second-update-search/`、`.local/second-update-search-esr/`、`.local/second-update-baseline/`，以及 `.local/second-update-unit.log` 和 `.local/second-update-web-ext.log`。

## 本地试用

在 Firefox 打开 `about:debugging#/runtime/this-firefox`，已有临时加载的 Ember 可点“重新载入”；也可点“临时载入附加组件”，选择项目中的 `dist/firefox/manifest.json`。打开新的 Ember 标签页体验更新。

建议检查：工具栏及扩展列表的新图标；自动更换壁纸时按钮旋转；历史与联想的展开、失焦收起、连续删除和快速重开。历史及联想功能沿用原有设置开关。

运行包：`dist/ember-tab-0.1.2-firefox.zip`，117 个运行文件。最终 SHA-256 见相邻 `.sha256` 和 [发布记录](SECOND_UPDATE_RELEASE.md)。用户测试预览包 SHA-256 为 `4f693f5cfb9df08bd9e9d974beccf5d8c6a03dd147e660132e16c18944b8f6de`；正式包仅更新发布文案。

复验：`npm test`、`npm run lint`、`npm run test:firefox-build`、`npm run lint:firefox`、`npm run test:firefox:ui`、`npm run test:firefox:search`、`npm run test:firefox`。ESR 可通过 `FIREFOX_BINARY` 指定隔离浏览器，并分别设置 `FIREFOX_UI_EVIDENCE`、`FIREFOX_SEARCH_EVIDENCE` 的证据目录。
