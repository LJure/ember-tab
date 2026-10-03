# Ember Tab 0.1.3 发布记录

2026-10-03：用户完成图标修复和候选选择测试，授权更新 GitHub，并由用户手动提交 Firefox 商店。[GitHub v0.1.3](https://github.com/LJure/ember-tab/releases/tag/v0.1.3) 已于 UTC 07:39:58／北京时间 15:39:58 公开，七个附件已核对；AMO 0.1.3 仍待用户手动提交。

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

Firefox 运行包 `ember-tab-0.1.3-firefox.zip`：119 文件、551888 字节；SHA-256 `c2faea140d97d70ef42967d1bd1d47410b4964fb179334377942c81a91be479d`。对应源码和商店完整材料由 `tools/package-firefox-release.mjs` 从源提交 `42e6ed98f3c55a8ea562f6bd47fa480e0fcdd8f5` 生成，远程 `v0.1.3` 标签指向该提交。源包包含发布前记录，不包含后补回执；后补文档提交不改变运行代码与发布附件。

## GitHub 发布回执

发布 ID `402392631`，公开正式版本（draft=false、prerelease=false）。2026-10-03T07:40:02Z 已通过 GitHub API 逐一比较全部七个附件的名称、大小、uploaded 状态与 SHA-256，记录见 [附件核对 JSON](THIRD_UPDATE_GITHUB.json)。

| 附件 | 字节／文件数 | SHA-256 |
| --- | --- | --- |
| `ember-tab-0.1.3-firefox.zip` | 551888／119 | `c2faea140d97d70ef42967d1bd1d47410b4964fb179334377942c81a91be479d` |
| `ember-tab-0.1.3-source.zip` | 30114300／323 | `b5ae830ecc0d36b1a65744857efd24ae6565fffe8880a82ddc612461499bbcae` |
| `ember-tab-0.1.3-amo-materials.zip` | 30944821／13 | `bd3a3e509c986a95715402cd3faf46a00c7bb8c35ec9711792ecbb070233bc23` |

另附以上三个 ZIP 的 `.sha256` 文件和 `ember-tab-0.1.3-submission.json`，总计七项。商店材料中的 `SHA256SUMS.txt` 覆盖其余十二份材料，已逐一验证；完整材料重复打包逐字节一致，见 [本地材料验证](THIRD_UPDATE_PACKAGE.json)。

将源码包单独解压到隔离目录，在 Node 24.14.1 下执行 `node tools/build-firefox.mjs --release`，无需 npm 安装或 Git 检出，输出与上述 Firefox 运行 ZIP 逐字节一致。本轮只公开 Firefox 更新附件，Chrome 包仍在本地自用交付。

代码提交及发布标签已推送 `origin/main`；本回执随单独文档提交推送后，通过 GitHub API 再核对远程主分支与本地 HEAD 相等。最后远程 SHA 见本机 `.local/third-update-final-verification.json`，避免将回执自己的提交 SHA 写入自身造成循环。

## 商店状态

AMO 公开 API 于 2026-10-03 核实当前版本 **0.1.2**，ID **ember-tab@ljure.github.io**。本轮不代为上传 0.1.3，不标记审核、签名或商店公开完成。材料在 `dist/amo/0.1.3/`，步骤见 [手动上传指南](THIRD_UPDATE_STORE_GUIDE.md)。保留现有安装升级，签名 XPI 的校验与同 ID 数据保留在商店完成后单独验收。

GitHub Actions 保持暂停，继承的 Chromium 发布工作流未启用。历史发布记录：[0.1.2](SECOND_UPDATE_RELEASE.md)、[0.1.1](FIRST_UPDATE_RELEASE.md)。
