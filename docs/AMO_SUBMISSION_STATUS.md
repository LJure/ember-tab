# Mozilla 提交进度

## 2026-10-01：0.1.1 更新已完成测试，尚未提交

- 用户完成 0.1.1 测试并授权发布至商店和 GitHub。已推送源码至 `main` 并公开发布 [GitHub v0.1.1](https://github.com/LJure/ember-tab/releases/tag/v0.1.1)，附运行包、对应源码及校验值，详见 [0.1.1 发布记录](FIRST_UPDATE_RELEASE.md)。
- 最终包为 `ember-tab-0.1.1-firefox.zip`，SHA-256 `ffaca1f29339240df43a8137fc662abfa67fe57f3345b8ba1b135a05a5a47820`；对应源码、更新说明和审核备注一并准备。
- 当前商店操作工具无法启动，初始化及重试都提示缺少运行路径。本轮尚未上传或提交 0.1.1，不将 GitHub 发布记作商店更新成功。0.1.0 的既有审核及上架状态不受影响。
- 继续提交时，在现有 `ember-tab-firefox` 的版本管理中上传新版本，附交对应源码，并更新版本说明、审核备注与隐私政策；固定 Gecko ID 保持不变。0.1.1 签名包取得后再验证正式升级。

## 2026-10-01：已审核上架并更新展示

- 用户反馈 0.1.0 已审核通过；已在[公开商店页](https://addons.mozilla.org/zh-CN/firefox/addon/ember-tab-firefox/)核实页面可访问、版本 0.1.0 有 XPI 下载入口，开发者管理页状态为“已通过审核”。
- 在商店“图像”编辑页上传了与随包一致的 Ember 火焰图标、三张隔离测试配置截图及对应中英说明；公开页面已逐项显示图标和三张截图。素材已同步至仓库 [`docs/store/`](store/README.md)。
- 公开页面使用 `ember-tab-firefox` 地址，名称、来源说明、MIT 和隐私政策保持原有内容；这次仅改变上架展示，不修改已通过审核的 0.1.0 XPI。
- 本轮未下载签名 XPI、未做正式签名安装／升级验收；这项仍未标记完成。页面核验截图仅保存在忽略的 `.local/store/amo-listing-2026-10-01.png`，不上传账户页面截图。

以下保留 2026-09-27 提交时的记录；其中“等待审核”是当时状态，不是当前状态。

更新：2026-09-27。

- 用户已登录 Mozilla，并明确授权接受《Firefox 附加组件分发协议》和《审核政策及规则》；已完成接受。
- 已选择 AMO 公开上架流程，只勾选桌面 Firefox；Android 未选。
- 已上传 0.1.0 候选包，文件与 [候选清单](M6_SUBMISSION.json) 一致。
- Mozilla 在线验证通过：0 错误、52 警告，与本地结果一致。主要提示为 innerHTML，既有逐项审计见 M5_HTML_AUDIT.md。
- 用户明确确认公开提交并继续源码／签名包验收。已完成提交向导，AMO 显示“已提交的版本”；版本管理当前显示“等待审核”。
- `ember-tab` slug 被 AMO 提示已占用，已成功保存为 `ember-tab-firefox`；名称仍为 Ember Tab，固定 Gecko ID 不变。
- 已填写名称、双语介绍、标签页分类、GitHub 支持入口、MIT、隐私政策和审核备注。未填写私人支持邮箱。
- 介绍页提交后出现源码步骤，已选择“是”并上传候选清单中的源码 ZIP。版本管理显示源码“查看当前”链接，确认源码已附交。
- 审核备注已精简到 3000 字以内，包含复现命令、双包哈希、权限／测试边界、库来源；另已保存中英版本说明。完整版审阅说明保留在仓库和已附交源码中。
- AMO 版本 ID：`6519175`；文件 ID：`5063322`。
- [管理版本 0.1.0](https://addons.mozilla.org/zh-CN/developers/addon/ember-tab-firefox/versions/6519175)。预定公开地址为 `https://addons.mozilla.org/zh-CN/firefox/addon/ember-tab-firefox/`，目前不声称公开页面已可安装。
- 当前文件仍显示 ZIP、状态“等待审核”；尚未取得可用于验收的签名包，未进行正式签名安装／升级或数据同意界面验收。

下一步：Mozilla 完成审核／提供签名包后，下载并记录签名包哈希，验证正式安装、同 ID 升级、重启数据保留及权限／数据同意界面。现有公开提交和源码授权已完成，不需重复请求相同确认。不要因提交成功或在线校验通过就记为已签名或已上架。未设置自动监控。

本机交接截图为 `.local/m6/amo-submitted.png` 和 `.local/m6/amo-waiting-review.png`，表单副本为 `.local/m6/amo-reviewer-notes-submitted.txt`。不提交账户页面截图或凭据。运行包及源码包保持不变，本轮仅更新发布记录；GitHub Actions 继续暂停，未创建 GitHub Release。
