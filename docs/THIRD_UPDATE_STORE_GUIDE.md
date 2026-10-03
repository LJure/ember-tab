# Ember Tab 0.1.3：Firefox 商店手动更新

2026-10-03 已核实 AMO 当前公开版本为 0.1.2。本轮准备更新到 **0.1.3**，用户完成测试；GitHub 发布与商店提交是独立步骤，本轮由维护者手动提交。

## 材料对应位置

项目 `dist/amo/0.1.3/` 含全部材料，也可以下载 GitHub 的 `ember-tab-0.1.3-amo-materials.zip` 后解压。

| 文件 | 用途 |
| --- | --- |
| `ember-tab-0.1.3-firefox.zip` | 扩展文件：上传新版本 |
| `ember-tab-0.1.3-source.zip` | 同版本审核源码：源码上传入口 |
| `version-notes-zh-CN.txt` / `version-notes-en-US.txt` / `version-notes-zh-TW.txt` | 对应语言的版本说明 |
| `reviewer-notes.txt` | 给审核员的英文备注 |
| `privacy-policy.txt` | 更新产品隐私政策：新增 HTTPS 取图尝试和主动请求候选的说明 |
| `05-icon-choices.png` / `screenshot-captions.txt` | 可选新增候选图标截图和说明 |
| `icon128.png` | 现有蓝色图标副本；无须重复更换 |
| `SHA256SUMS.txt` / `submission.json` | 所有材料校验、源提交与验证记录 |
| `upload-guide.md` | 本指南副本 |

完整材料 ZIP 用来下载／解压整理，不能当作扩展或源码上传。Firefox 运行 ZIP 根层直接含 manifest.json；Chrome 包和 `-test-http` 包不用于 AMO。

## 手动提交

1. 登录开发者账号，打开 [现有 Ember Tab 的版本管理](https://addons.mozilla.org/zh-CN/developers/addon/ember-tab-firefox/versions)，选择“上传新版本 / Upload a New Version”。沿用现有公开上架渠道，不创建新扩展。
2. 扩展文件上传 `ember-tab-0.1.3-firefox.zip`。校验后核对 **0.1.3**、**ember-tab@ljure.github.io**、桌面 Firefox 最低 **140.0**。不增加 Android 平台。Firefox 权限和数据类别与 0.1.2 相同。
3. 本地 web-ext 为 0 错误、0 notices、52 项既有警告；以在线校验为准。若出现错误先处理，不将本地通过当作在线审核完成。
4. 源码问题选择“是 / Yes”，上传 `ember-tab-0.1.3-source.zip`。若入口位于版本详情的 Source code，则在该处上传；提交后确认源码附件存在。解压源码，用 Node 24.14.1 执行 `node tools/build-firefox.mjs --release`，无需 npm 安装或 Git 检出即可重建。
5. 将对应语言的版本说明与 `reviewer-notes.txt` 填入相应字段。到 [产品页编辑入口](https://addons.mozilla.org/zh-CN/developers/addon/ember-tab-firefox/edit) 更新隐私政策，使用 `privacy-policy.txt`；本次新增主动取候选和 HTTPS 尝试说明，不能沿用“隐私行为未变”的旧备注。
6. 可选添加 `05-icon-choices.png`，填写对应截图说明，保留现有截图和蓝色图标。
7. 检查版本、平台、源码、说明和隐私政策后完成页面提交。记录版本 ID、文件 ID、源码附件和实际审核状态；不要仅凭 GitHub 发布或校验通过记为已签名／已公开。

## 提交之后

核对 AMO 版本列表的实际状态。公开版本变成 0.1.3 后，在现有 Firefox 安装的 `about:addons` 中“检查更新”，保留原安装升级，核对设置、快捷链接、本地图片、历史与图标选择，再重启检查；不要为更新先卸载扩展。

下载的 Mozilla 签名 XPI 与本地未签名 ZIP 哈希不同，需要单独记录签名包校验和同 ID 升级结果。GitHub ZIP 只用于上传或临时加载，不通过改后缀获得签名。本轮没有代为提交，也没有完成正式签名升级验收。

## 官方参考

[新版本上传与校验](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/) · [匹配源码与重建](https://extensionworkshop.com/documentation/publish/source-code-submission/) · [扩展更新](https://extensionworkshop.com/documentation/manage/updating-your-extension/)。
