# Ember Tab 0.1.2 商店手动更新指南

2026-10-02，用户测试已完成。当前公开商店版本经 AMO API 核实为 0.1.1；本次准备提交 0.1.2。

## 一次找到全部材料

全部上传材料在项目 `dist/amo/0.1.2/`。GitHub v0.1.2 同时提供 `ember-tab-0.1.2-amo-materials.zip`，解压后包含同一套文件。

| 文件 | 对应位置／用途 |
| --- | --- |
| `ember-tab-0.1.2-firefox.zip` | “上传新版本”的扩展文件 |
| `ember-tab-0.1.2-source.zip` | 同一版本的“源码”上传，不能当作扩展文件上传 |
| `version-notes-zh-CN.txt` | 简体中文版本说明 |
| `version-notes-en-US.txt` | 英文版本说明 |
| `version-notes-zh-TW.txt` | 繁体中文版本说明（如使用此语言） |
| `reviewer-notes.txt` | 给审核员的备注（英文，少于 3000 字符） |
| `privacy-policy.txt` | 随包隐私文本备份；本次隐私行为未变 |
| `icon128.png` | 商店“图像”中的新蓝色图标，与运行包相同 |
| `04-search-history.png` | 可选新增历史面板截图；隔离测试配置与示例记录，未含个人数据 |
| `screenshot-captions.txt` | 上述截图的中英说明 |
| `SHA256SUMS.txt`、`submission.json` | 文件校验与版本／验证清单 |
| `upload-guide.md` | 本指南的本地副本 |

## 提交新版本

1. 登录已有 Mozilla 开发者账号，打开 [Ember Tab 版本管理](https://addons.mozilla.org/zh-CN/developers/addon/ember-tab-firefox/versions)。确认正在管理 **Ember Tab / ember-tab-firefox**。
2. 点击 **上传新版本 / Upload a New Version**，上传 `ember-tab-0.1.2-firefox.zip`。沿用现有 AMO 公开上架渠道，不另建扩展。上传 ZIP 根层已经包含 Firefox 的 `manifest.json`。
3. 校验完成后确认版本 **0.1.2**、ID **ember-tab@ljure.github.io**、桌面 Firefox 最低版本 **140.0**。本次不增加 Android 平台。本地检查为 0 错误、52 项原有警告；以在线结果为准，在线错误需处理后再继续。
4. 源码问题选择 **是 / Yes**，上传 `ember-tab-0.1.2-source.zip`。若源码上传入口在版本详情页，则进入 0.1.2，找到 Source code，上传并保存；提交结束务必确认源码附件存在。源码包解压后用 Node 24.14.1 执行 `node tools/build-firefox.mjs --release` 即可重建，无需 npm 安装或 Git 检出。
5. 将对应语言的 `version-notes-*.txt` 填入 **版本说明 / Release notes**，将 `reviewer-notes.txt` 填入审核备注。本次权限、服务和数据处理未变，沿用已有隐私政策；如果表单要求重新填写，可使用 `privacy-policy.txt`。
6. 检查平台、版本说明与源码，按页面按钮完成提交。保存 **版本 ID／文件 ID**，确认 0.1.2 出现在版本列表，并记录实际显示的审核状态。

## 更换商店图标

在 [产品页编辑入口](https://addons.mozilla.org/zh-CN/developers/addon/ember-tab-firefox/edit) 的 **图像 / Images** 区域，上传 `icon128.png` 并保存。商店产品图标是单独的展示设置，不能仅依赖扩展包中的 manifest 图标自动替换。

可选增加 `04-search-history.png`，用 `screenshot-captions.txt` 的对应说明。现有三张截图继续保留；本次无需重新上传全部旧图。

保存后打开 [公开商店页](https://addons.mozilla.org/zh-CN/firefox/addon/ember-tab-firefox/)，核对图标。产品页图标保存与 0.1.2 审核完成是两个独立状态。

## 提交后

AMO 审核／签名／公开上架以页面实际状态为准。审核通过后核对公开页面版本为 0.1.2，并在 Firefox `about:addons` 的齿轮菜单使用“检查更新”。保留现有安装升级，核对设置、快捷链接、本地图片和本机搜索历史，再重启检查；避免为更新而卸载旧扩展。

如果管理页先提供签名 XPI，可先下载到隔离配置检查。签名 XPI 与未签名 ZIP 的哈希不同，单独记录签名包校验值即可。

## 官方流程参考

[提交与校验](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/) · [每个版本的匹配源码与重建说明](https://extensionworkshop.com/documentation/publish/source-code-submission/) · [AMO 托管扩展的自动更新](https://extensionworkshop.com/documentation/manage/updating-your-extension/)。
