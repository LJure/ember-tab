# M1 开发基线

日期：2026-09-27。阶段状态与后续动作以根目录 DEVELOPMENT_PLAN.md 为准。

## 身份与来源

- 名称：Ember Tab；独立、非官方 Firefox 移植项目。
- 公开仓库：https://github.com/LJure/ember-tab
- 上游：https://github.com/nil-byte/aura-tab
- 固定上游基线：`a706cee56e43b80777de697dd4462083b1f97ef8`，版本 3.5.3。
- 已补全该基线的 40 个上游提交，保持来源历史。上游标签保留在本地，不推送为 Ember Tab 发布标签。
- 开发分支：`chore/m1-foundation`；主分支保存可接续的 M1 工程准备成果。
- 固定扩展 ID：`ember-tab@ljure.github.io`。这是扩展标识符，不是联系人邮箱；建立测试数据后不可随意更换。
- 首个 Firefox 版本：`0.1.0`；最低支持目标：Firefox `140.0`。
- `ember.project.json` 记录这些决定，M2 构建消费它。现有上游 manifest/package 仍为 3.5.3，当前不提供可用 Firefox 安装包。

## 环境与验证结果

| 项目 | 结果 |
| --- | --- |
| 操作系统 | Windows，本地 PowerShell |
| Node.js / npm | 24.14.1 / 11.11.0 |
| 安装方式 | `npm ci --no-audit --no-fund`，保留原 package-lock.json；176 个包 |
| 本地 Firefox | `D:\Firefox\firefox.exe`，156.0.1 |
| Mozilla 发布信息快照 | 稳定版 156.0.1；ESR 140.16.0esr；另列 ESR_NEXT 153.3.0esr |
| ESR 本机运行 | 未安装／未运行；M2–M6 使用独立二进制与测试配置补充验证 |
| Vitest | 75 个文件、577 项测试通过；0 失败、0 跳过；7.88 秒 |
| ESLint | 71 个文件；0 错误、0 警告 |
| Firefox 扩展实机 | 未执行，留待 M2；单元测试使用 jsdom 和模拟 Chrome API |

基线命令：

```powershell
npm.cmd ci --no-audit --no-fund
npm.cmd test -- --reporter=default --reporter=json --outputFile=.local/baseline/vitest.json
npm.cmd run lint -- --format json --output-file .local/baseline/eslint.json
node tools/prepare-migration-fixtures.mjs
```

首次安装因沙箱网络限制失败，首次测试因子进程权限失败；在获准的环境中重跑后通过，不属于源代码缺陷。测试中的预期异常日志不等于失败，以 JSON 报告及退出码为准。原始报告位于 `.local/baseline/`，只保留本地；公开仓库保留本摘要和可复现步骤。

最低版本 140 是本项目主动选定的支持范围，不宣称完成 Firefox 140 实机验证。选择依据包括 MV3、模块后台（112+）、search.query（111+）、OPFS（111+）以及 140+ 的数据传输声明流程。上线前仍须在最低目标／ESR 和稳定版验证；不使用 showSaveFilePicker 作为 Firefox 必需能力。

## 运行入口、权限和资源

| 类型 | 入口／用途 | 后续阶段 |
| --- | --- | --- |
| 首屏 | newtab.html → scripts/boot/first-paint.js | M2 |
| 主界面 | scripts/main.js → backgrounds/layout/clock/search/quicklinks/settings/changelog | M2–M3 |
| 后台 | background-worker.js：安装、启动、alarms、消息、图标请求 | M2 |
| 离屏 | favicon-offscreen.html → scripts/platform/favicon-offscreen.js | M3 改为平台适配 |
| storage/unlimitedStorage | 设置、同步、图片与图标持久化；local/session/sync/onChanged | M2、M4 |
| alarms | 壁纸定时刷新，事件页重启后重建必要状态 | M2–M3 |
| search/bookmarks | 默认搜索、书签树读取 | M3 |
| favicon/offscreen | Chrome 专用能力；Firefox manifest 去除 | M2–M3 |
| HTTP/HTTPS 全站权限 | 任意网站图标、图片源和用户 WebDAV | M4–M5 重新收敛／设计授权 |
| 内置资源 | styles、assets/icons、assets/backgrounds、_locales、scripts/platform/locales、scripts/libs | M3、M5 |

其他 API：runtime.getURL/getManifest/sendMessage/onMessage/onInstalled/onStartup/reload；图标链路还有 getContexts。实际网络来源含 Unsplash、Pixabay、Pexels、Bing；图标回退为 Vemetric 与 Google；搜索引擎地址在 scripts/domains/search.js；WebDAV 地址由用户配置。

`toolbar-icon-service.js` 的 restoreToolbarIcon 没有运行入口调用，renderer 仅被该遗留 service 引用。BackupManager 仍保留 toolbarIcon 的历史数据读写。M1 不删除这些兼容数据，也不恢复已移除的工具栏图标功能。

额外发现：内存备份已有 **500 MiB 输出上限**，恢复入口有 **2 GiB 输入上限**。这些是代码防护阈值，不是实测容量承诺；M4 必须验证失败提示与内存表现。

## 隔离环境与合成样本

运行 `node tools/prepare-migration-fixtures.mjs` 生成：

- `.local/profiles/firefox-stable/`、`.local/profiles/firefox-esr/`：独立配置目录和 user.js；不使用日常配置、不登录个人同步账户，尚未启动 Firefox 初始化。
- `.local/fixtures/firefox-bookmark-tree.json`：工具栏、菜单、其他书签、分隔符、嵌套目录、空目录、重复 URL。
- `.local/fixtures/bookmarks.html`：可供测试配置导入的书签样本。
- `.local/fixtures/wallpaper.svg`：自行生成的无外部资源图片，仅供壁纸流程测试。
- `.local/fixtures/synthetic-backup.zip`：符合 schema v1 结构的合成备份，含两条快捷链接、设置与空 IDB 索引。
- `.local/fixtures/invalid-schema-backup.zip`、`missing-storage-backup.zip`：恢复失败路径样本。
- `.local/fixtures/fixture-report.json`：解包检查和 SHA-256。

合成 ZIP 不是从真实 Aura Tab 导出的备份，不包含图片 Blob，不代表跨浏览器恢复已通过。真实导出样本、PNG/JPEG/WebP/EXIF 样本、大图库与带 Blob 的往返测试在 M3–M4 补充。样本生成器不读取任何浏览器配置、真实书签或用户备份；再次运行只更新合成样本并保留已存在的测试 user.js。

## GitHub 与后续 CI

origin 指向 LJure/ember-tab，upstream 指向 nil-byte/aura-tab。保留上游历史；仅同步 main 与开发分支，不触发上游 v* 标签发布流程。

仓库仍保留上游 CI／Release 定义和 Actions 设置。暂停 Actions 的额外设置操作被自动审批拒绝，未执行。当前 CI 包装的仍是上游 Chrome 产物，不得将它当成 Firefox 发布包；M2 增加 Firefox 构建，M5 调整发布流程。GitHub 托管 CI 的运行结果需与本地基线分开记录。

## 资料

- [Mozilla 发布版本数据](https://product-details.mozilla.org/1.0/firefox_versions.json)
- [后台能力兼容数据](https://github.com/mdn/browser-compat-data/blob/main/webextensions/manifest/background.json)
- [OPFS 文件句柄兼容数据](https://github.com/mdn/browser-compat-data/blob/main/api/FileSystemFileHandle.json)
- [Gecko 配置与数据声明](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)
