# Ember Tab 0.1.3 发布记录

2026-10-03：用户完成图标修复和候选选择测试，授权更新 GitHub，并由用户手动提交 Firefox 商店。准备 GitHub `v0.1.3`，发布回执将在公开附件核对后补充。

## 更新范围

- 共享图标发现解析大页面的有限前段，保留可用原站图，匹配浅深色 favicon media，过滤已确认的 Vemetric 占位 SVG；公共 HTTP 链接先尝试 HTTPS 取图，导航地址保留。
- 新增候选选择入口，展示来源与实际尺寸；点击保存原始图片到本机缓存，普通保存／重载和晚返回自动请求不覆盖，明确刷新恢复自动选择。清空缓存或换设备需重新选，尺寸不保证细节。
- 相册全屏查看器注册独立弹层，Escape 先退回相册，再关闭相册；关闭／销毁清理弹层和滚动状态。
- 仓库加入共用两版构建、Chrome 固定身份和自用交付工具。GitHub 本轮发布 Firefox 附件，Chrome 包继续本地构建，未申请 Chrome 商店发布。

Firefox 权限、host_permissions、Gecko 身份和数据声明与已发布 0.1.2 包逐项比较一致。隐私文本新增 HTTPS 尝试和主动获取全部图标候选的说明；没有新增服务或远程可执行代码。版本号与更新日志递增为 0.1.3，保留用户已测试的功能代码。签名／升级验收不因此完成。

## 发布验收

| 检查 | 结果 |
| --- | --- |
| 单元测试 | 98 文件、717 项通过 |
| Firefox 157.0 | M3 29、UI 6、搜索 10 项通过 |
| Firefox ESR 140.16.0 | M3 29、UI 6、搜索 10 项通过 |
| 未注入的普通 Firefox 包 | 基础 10 项通过 |
| Chrome 154.0.8037.93 | 后台与候选交互 18 项通过 |
| 两版构建 | Firefox 1、Chrome 3 项；运行包可重复构建 |
| ESLint / web-ext | 规范通过；0 错误、0 notices、52 个既有 warnings |
| 用户测试 | 图标修复与候选选择确认通过 |

本次 M3 的 HTTP 服务为仅本机测试夹具，单独 ZIP 使用 `-test-http` 标记；普通发布目录已恢复为 HTTPS 权限。真实七站在线图标检查及六站刷新记录来自功能代码相同的 0.1.2 自用包，见 [候选记录](CHROME_ICON_CHOOSER.md)，不将其表述为本次签名包的全量验收。完整 Chrome 生命周期矩阵没有重跑。

机器可读结果见 [验证 JSON](THIRD_UPDATE_VALIDATION.json)。本机证据：`.local/third-update-vitest.log`、`.local/third-update-{ui,search,m3}-{stable,esr}/`、`.local/third-update-production/`、`.local/chrome-runtime/run-1791012174611/report.json` 和 `.local/third-update-web-ext.json`。浏览器配置、原始备份、凭据、测试包不进入发布附件。

Firefox 运行包 `ember-tab-0.1.3-firefox.zip`：119 文件、551888 字节；SHA-256 `c2faea140d97d70ef42967d1bd1d47410b4964fb179334377942c81a91be479d`。对应源码和商店完整材料由 `tools/package-firefox-release.mjs` 从已提交源码生成；工具会检查普通权限、源提交、独立重建一致及所有材料校验。完整包哈希与 GitHub 发布状态在后续回执记录，源包不会包含自己后补的发布回执。

## 商店状态

AMO 公开 API 于 2026-10-03 核实当前版本 **0.1.2**，ID **ember-tab@ljure.github.io**。本轮不代为上传 0.1.3，不标记审核、签名或商店公开完成。材料在 `dist/amo/0.1.3/`，步骤见 [手动上传指南](THIRD_UPDATE_STORE_GUIDE.md)。保留现有安装升级，签名 XPI 的校验与同 ID 数据保留在商店完成后单独验收。

GitHub Actions 保持暂停，继承的 Chromium 发布工作流未启用。历史发布记录：[0.1.2](SECOND_UPDATE_RELEASE.md)、[0.1.1](FIRST_UPDATE_RELEASE.md)。
