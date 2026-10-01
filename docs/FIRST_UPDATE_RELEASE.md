# Ember Tab 0.1.1 发布记录

日期：2026-10-01。用户完成测试并授权发布商店与 GitHub。

## 发布范围

原版相册／设置图标、本机搜索历史、可选实时联想、面板外观调节，以及新标签页搜索后清空与失焦。使用方式和数据边界见 [实现记录](FIRST_UPDATE_IMPLEMENTATION.md)。

89 个测试文件、671 项通过；ESLint、可复现构建通过；Firefox 157.0 与 ESR 140.16.0 各 10 组隔离浏览器检查通过。web-ext 为 0 errors、0 notices、52 warnings。用户已完成实际浏览器试用。

## GitHub 发布材料

目标：[v0.1.1](https://github.com/LJure/ember-tab/releases/tag/v0.1.1)，仓库 `LJure/ember-tab`，主分支 `main`。

- `ember-tab-0.1.1-firefox.zip`：115 个运行文件、545746 字节，SHA-256 `ffaca1f29339240df43a8137fc662abfa67fe57f3345b8ba1b135a05a5a47820`。
- `ember-tab-0.1.1-source.zip`：当前提交的审阅源码，保留构建所需文件和第三方许可，不含 `.local`、浏览器配置、凭据、`node_modules` 或测试用 ZIP。
- 两个包分别提供 `.sha256`，提交清单另作为 `ember-tab-0.1.1-submission.json` 附件。

运行 ZIP 未签名，仅用于开发者临时加载，不是可长期安装的签名 XPI；不能通过改名绕过 Firefox 签名要求。日常安装继续使用 AMO。

## 商店状态

0.1.1 尚未上传／提交；商店操作工具初始化及重试均失败，提示缺少运行路径。已准备运行包、对应源码、双语版本说明、审核备注和隐私政策；商店字段副本位于本机 `dist/amo/0.1.1/`。

更新入口为现有 [版本管理](https://addons.mozilla.org/zh-CN/developers/addon/ember-tab-firefox/versions)。同一扩展 ID `ember-tab@ljure.github.io`、递增版本 0.1.1、桌面 Firefox 140+，不另建扩展、不选择 Android。

后续仅在实际提交成功后记录 AMO 版本／文件 ID 和源码附交状态；审核／签名／公开上架分别以实际状态为准。签名包的正式安装与同 ID 升级尚未验证，不将临时加载或用户试用等同于签名升级。

GitHub Actions 继续暂停。历史首版记录见 [Mozilla 提交进度](AMO_SUBMISSION_STATUS.md)。
