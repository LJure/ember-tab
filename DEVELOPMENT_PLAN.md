# Ember Tab 开发计划与进度记录

> 本文是项目的持续接续入口。后续开发前先阅读本文，再检查实际代码和 Git 状态；每个阶段结束或发生重要变更后更新本文。
> 创建／最后更新：2026-09-27（Asia/Shanghai）。M0–M3 已完成；主要功能已通过稳定版实机验收，数据可靠性与发布尚待 M4–M6。真实服务、版本与测试范围以各阶段报告为准。

## 1. 项目目标与已确认决定

- 项目名称：**Ember Tab**，用户已同意采用。
- 定位：基于 **nil-byte/Aura Tab** 的非官方 Firefox 新标签页扩展，独立维护。
- 简介建议：`基于 Aura Tab 的非官方 Firefox 新标签页扩展。`
- 英文简介建议：`An unofficial Firefox port of Aura Tab.`
- 公开仓库：`https://github.com/LJure/ember-tab`，用户已明确选择公开。尚未注册 Firefox 商店条目。
- 首期目标：迁移桌面 Firefox，尽量保留现有主要功能、外观和数据格式；避免无关重构。
- 不直接使用 `Aura Tab — Firefox Edition` 作为独立分叉品牌，避免让用户误认为原作者维护的官方版本。
- 在 README、关于页面和发布介绍中注明来源并链接原仓库，保留原版权和许可证。
- 最新授权范围：公开 GitHub 仓库、暂停 GitHub Actions；用户已启动 M3。尚未执行签名或商店发布，M4–M6 待后续启动。

### 命名检查的边界

2026-09-27 已进行 Firefox 商店实时搜索及 Chrome 商店、GitHub 公开搜索，未发现明显的同名新标签页扩展。相关命中主要是 Ember Inspector 开发工具。

这只是初步重名检查：未完成商标检索，未验证 AMO 地址 `ember-tab` 可注册，也不保证商店审核通过。发布时重新核对；若需要更名，保留 Aura Tab 来源说明。

## 2. 当前工作区与代码基线

| 项目 | 当前值 |
| --- | --- |
| 工作目录 | `D:\workspace\aura-tab-firefox-assessment` |
| 本文位置 | `D:\workspace\aura-tab-firefox-assessment\DEVELOPMENT_PLAN.md` |
| 上游仓库 | https://github.com/nil-byte/aura-tab |
| 上游基线提交 | `a706cee56e43b80777de697dd4462083b1f97ef8` |
| 基线提交说明 | `fix: remove obsolete toolbar icon runtime path` |
| 上游版本 | `3.5.3`（manifest 与 package.json） |
| 当前 origin | `https://github.com/LJure/ember-tab.git` |
| 当前 upstream | `https://github.com/nil-byte/aura-tab.git` |
| 开发分支 | `feat/m3-core-features`（从 M2 `cdf624f` 建立） |
| 首版 / 固定 Gecko ID | `0.1.0` / `ember-tab@ljure.github.io` |
| 最低 Firefox 支持目标 | `140.0`，待后续实机验证 |
| 许可证 | MIT，`Copyright (c) 2026 nil-byte` |
| 技术形态 | Manifest V3，原生 JavaScript ES modules、HTML、CSS，内置第三方库 |
| 现有校验 | Vitest + jsdom；ESLint；测试中有 Chrome API 模拟 |

M1 基线为 75 文件 / 577 测试，M2 为 75 文件 / 578 测试。M3 当前为 78 文件 / 589 测试通过，ESLint 0 错误／0 警告；Firefox 包构建回归通过，稳定版 156.0.1 的 26 项实机检查及可选 Bing 在线壁纸检查通过。web-ext 为 0 错误／55 个已分类警告，不支持 API 的警告已消除，发布门槛仍在 M5。最新证据与复现见 [M3 主要功能验收](docs/M3_FEATURES.md)，原始报告在忽略的 `.local/m3/`；[M2 报告](docs/M2_FIREFOX.md)保留历史结果。

当前目录名仅为评估阶段的名称，继续复用；上游基线的 40 个提交已补全。origin 属于 Ember Tab，upstream 保留原项目来源。只向 origin 同步 main 和开发分支，不推送上游标签。未来迁移目录后更新此表。

## 3. 已核实的技术结论

| 模块 | 源码现状 | 迁移处理 |
| --- | --- | --- |
| 新标签页 | `chrome_url_overrides.newtab` 指向本地 `newtab.html` | Firefox 支持该机制，保留本地页面 |
| 后台 | 仅声明 `background.service_worker`，使用 ES module | Firefox 产物改用后台 scripts／事件页，验证模块加载和休眠后唤醒 |
| 网站图标 | M3 已抽离 DOM、网络及浏览器适配层 | Firefox 事件页直接解析和解码，不请求 Chrome `/_favicon/`；Chromium 保留离屏路径 |
| 搜索 | 使用 `chrome.search.query`，自定义引擎拼接 URL | 当前桌面 Firefox 支持 search.query；验证默认引擎、当前页／新页行为 |
| 书签 | `chrome.bookmarks.getTree()` 后按层级遍历 | 验证 Firefox 根节点、工具栏、菜单、其他书签、分隔符及重复链接 |
| 设置与快捷链接 | 广泛使用 storage.sync/local/session | 设定稳定 Gecko ID；验证 Promise、消息、配额、分块数据和跨页面更新 |
| 本地图片 | 使用 IndexedDB 保存 Blob | 保留数据模型，验证重启后的恢复、裁剪、显示及缓存清理 |
| 普通本地备份 | ZIP + Blob 下载 | 保留并测试完整往返恢复 |
| 流式本地备份 | showSaveFilePicker/createWritable；已有内存回退 | Firefox 不支持 showSaveFilePicker；先验证回退，再评估大图库内存占用 |
| WebDAV | PROPFIND/MKCOL/PUT/GET 等；上传备份使用 OPFS 临时文件路径 | 验证权限、认证、服务端兼容、OPFS 可用性及异常回退 |
| 外观与交互 | 主要为网页逻辑、Interact.js、SortableJS | 复用主体代码，针对 Firefox 验证拖拽、动画、布局、快捷键和全屏 |

注意：

- “可以迁移”是源码与文档层面的判断，不能将此表标记为实机验收通过。
- 不机械地把所有 `chrome` 替换为 `browser`。先验证目标版本的调用方式，按需增加统一 API 入口；浏览器专用能力用能力检测和适配处理。
- Firefox Sync 与 Chrome Sync 不互通。迁移 Chrome 数据走备份导出／导入，结果必须实测。
- M1 已确认旧工具栏图标 service 没有运行入口调用；仅保留备份兼容数据，不恢复遗留 UI 功能。
- M1 已确认内存备份有 500 MiB 输出限制、恢复入口有 2 GiB 输入限制；这些阈值不是容量验收承诺。

## 4. 开发原则与首期范围

以下是执行建议，遇到实测证据时允许调整，并记录原因。

1. 保留共同业务代码，优先使用独立 Firefox 配置和可复现打包流程；避免将 Firefox 差异散落到各业务模块。
2. 首期交付桌面 Firefox；先以 Windows 实机作为主要验收环境。其他桌面系统只在完成验证后声明支持情况。
3. 最低支持目标确定为 Firefox 140.0；本机稳定版为 156.0.1。Mozilla 发布数据另列 ESR 140.16.0esr 和 ESR_NEXT 153.3.0esr，后续验证时重新核对。ESR 二进制尚未配置，不能宣称实机兼容已通过。
4. 保留新标签页、壁纸、快捷链接／Dock／启动台、时钟、搜索、书签导入、多语言、照片查看、设置、备份和 WebDAV。
5. 沿用已有存储键、IndexedDB 名称及备份结构，除非确实需要迁移。品牌更名不意味着应全局替换旧数据标识。
6. 新安装可使用 Ember Tab 的备份文件名／远程目录；恢复旧备份或已有 WebDAV 配置时尊重原值，避免找不到历史备份。
7. 首期不承诺 Android、不新增账号服务、不搭建同步后端、不扩展成全新产品。不以重写框架作为迁移前提。
8. 缺少真实服务凭据时先做本地模拟验证，并明确记录未验证的服务；不把模拟结果当成坚果云或群晖实测。

## 5. 里程碑与进度

状态约定：`未开始`、`进行中`、`已完成`、`待外部条件`。只有有对应证据的项目才能勾选。

| 阶段 | 状态 | 交付目标 | 依赖 |
| --- | --- | --- | --- |
| M0 评估与计划 | 已完成 | 来源、名称、基线、范围及本文 | 无 |
| M1 开发基线与工程准备 | 已完成 | 基线、版本矩阵、开发分支、公开 GitHub 仓库、合成样本 | M0 |
| M2 Firefox 最小可运行版 | 已完成 | 可以临时加载、打开新标签页并持久化设置 | M1 |
| M3 主要功能适配 | 已完成 | 图标、搜索、书签、本地／Bing 壁纸及主要交互；真实密钥服务等限制见报告 | M2 |
| M4 数据与备份可靠性 | 未开始 | 导入恢复、同步、WebDAV 和失败处理通过验证 | M2；完整验收依赖 M3 |
| M5 品牌、许可与分发准备 | 未开始 | 独立品牌、声明、可复现安装包和安装说明 | M3、M4 |
| M6 发布候选验收 | 未开始 | 稳定版／ESR 验证结果、已知问题和发布候选包 | M5 |

### M0：已完成的工作

- [x] 拉取公开源码并记录完整基线提交。
- [x] 检查主许可证、manifest、主要 API 和关键模块。
- [x] 对照 Mozilla 文档评估主要迁移障碍。
- [x] 与用户确认采用独立名称 Ember Tab。
- [x] 完成公开重名初查，记录未确认项。
- [x] 建立本开发计划与持续进度记录。

### M1：开发基线与工程准备

- [x] 阅读本文、项目约定，检查 Git 状态，建立 `chore/m1-foundation` 分支，起点为 a706cee。
- [x] 按锁文件安装依赖；记录 Node 24.14.1 / npm 11.11.0、本机稳定版和官方 ESR 版本信息。
- [x] 测试 75 个文件 / 577 项全部通过；lint 71 个文件，0 错误 / 0 警告；环境权限问题已与代码失败区分。
- [x] 完成运行入口、API、权限和资源清单；确认遗留工具栏没有运行入口。
- [x] 在 `ember.project.json` 固定 0.1.0、Firefox 140.0、`ember-tab@ljure.github.io`，M2 构建再使用。
- [x] 准备独立 stable / ESR 配置目录及合成书签、SVG 壁纸、正常／错误 ZIP；已核对 ZIP 结构，尚未在浏览器恢复。
- [x] 新建用户要求的公开仓库 `LJure/ember-tab`，配置 origin / upstream，补全来源历史并同步 M1 成果。

验收：基线可复现，失败有归因，测试环境明确；未读取或修改用户日常浏览器数据。证据见 [M1 基线](docs/M1_BASELINE.md)。ESR 安装、真实浏览器初始化和真实导出备份测试由 M2–M4 接续。

### M2：Firefox 最小可运行版

- [x] 增加 `build:firefox` 生成／打包入口，保留原配置；验证同检出重复构建一致。
- [x] 移除产物中的 favicon、offscreen、minimum_chrome_version、offline_enabled 等不适用项。
- [x] 使用 module scripts 事件页；实测安装、消息／存储／alarm 唤醒，新增启动恢复 alarm 单测。完整浏览器重启留待 M4／M6。
- [x] 实测 chrome.* 的 storage Promise 和异步消息回复可用，按需原则下不引入额外兼容层。
- [x] 添加固定 Gecko ID、0.1.0、最低版本目标 140.0；数据声明仍是 M5 发布门槛，未虚报 none。
- [x] 实测新标签页、默认设置、设置 UI、英文／深色主题、刷新与扩展重载后的状态，以及后台休眠／唤醒。
- [x] web-ext lint 0 错误／57 警告，按类别记录于 M2 文档并归入 M3／M5。

验收：Firefox 156.0.1 独立临时配置通过；新标签页可用、设置刷新后保留，M2 测试未见阻断性后台或权限错误。ESR 未测；图标、完整功能、隐私和分发不在本阶段通过声明内。证据见 [M2 验收](docs/M2_FIREFOX.md)。

### M3：主要功能适配

- [x] 图标：DOM 解析／图片检查已抽取；Firefox 后台直接调用，Chrome 保留离屏适配。
- [x] 图标：Firefox 不生成 Chrome `/_favicon/`；本扩展 URL 采用实际协议／主机和精确端点校验。
- [x] 图标：声明图标、favicon、SVG、损坏／超大／停滞响应、无图标、手动图标及缓存通过；请求、解码和回退均有边界。
- [x] 搜索：默认引擎及上游已有的内置引擎选择器（Bing）、中文／特殊字符、当前页／新页通过；未新增任意 URL 模板编辑器。
- [x] 书签：真实 Firefox 根目录、嵌套／空目录、分隔符、跨目录去重及实际导入通过；500 项上限另由真实导入器单测验证。
- [x] 快捷链接：界面新增并固定 Dock，真实存储的编辑／删除／文件夹／子项排序／分页、Dock 鼠标拖拽、启动台搜索通过。
- [x] 壁纸：本地图片、纯色、Bing 实际下载／显示状态、裁剪显示、刷新恢复及离线通过；三个密钥服务只测无密钥回退。定时机制及策略已测，长期在线轮换与真实密钥服务列入 M6；上游本地图片本就不做定时轮播。
- [x] 界面：时钟、设置、简繁英、照片缩略图／沉浸预览／窗口展开拖动、快捷键、80%／125% 缩放、两种窗口大小通过；未宣称浏览器 F11 全屏验收。
- [x] Chromium：本轮未实机运行，保留配置与离屏路径并通过共同单测，不声明双端实机均通过。

验收：上述关键日常流程在 Firefox 156.0.1 可用；无图标、请求失败和缺少图片 API 密钥时有回退。完整权限撤销矩阵、真实密钥服务、长期运行和 ESR 尚未通过。详见 [M3 报告](docs/M3_FEATURES.md)。本轮把原“轮播／全屏”的笼统表述按上游实际能力细化，避免把既不存在的本地定时轮播或未测的浏览器全屏算作通过。

### M4：数据与备份可靠性

- [ ] 检查 storage.sync 的容量、分块、跨窗口变更及 Firefox 同步冲突；区分同配置本地事件和真正跨设备同步。
- [ ] 验证 Aura Tab 导出的 ZIP 能在 Ember Tab 中导入，检查设置、快捷链接、图标和本地图片完整性。
- [ ] 验证 Ember Tab 自身导出／恢复往返；错误 ZIP、缺失条目或中断不得静默报告成功。
- [ ] 验证 Firefox 普通下载回退；记录较大图库的样本大小、峰值内存／耗时和可接受边界。
- [ ] 检查 OPFS getDirectory/createWritable 的实际支持与错误路径；提供必要的能力检测、回退及临时文件清理。
- [ ] 验证 WebDAV 连接、目录、列表、上传、下载、恢复，覆盖认证失败、超时、权限拒绝和中断。
- [ ] 重新评估全站 host_permissions；决定固定图片源与用户指定 WebDAV／网站图标的授权方式并记录取舍。
- [ ] 验证禁用后启用、浏览器重启、扩展升级及多个新标签页并发操作。
- [ ] 跟进 M2 重载压力测试偶发的 `Promise resolved after context unloaded`：壁纸状态写入与页面销毁交叠，验证状态完整性及生命周期处理。
- [ ] 跟进 M3 的启动时序：刚新建标签页立即切换／刷新 Bing 时测试曾超时，稳定加载后同一路径通过；覆盖后台恢复、初始化和多页同步，判断是否需要产品修复。

验收：代表性备份可恢复且逐项核对；错误可见、重试可控；无法实测的跨设备同步／真实 WebDAV 服务保持未完成。

### M5：品牌、许可与分发准备

- [ ] 更新用户可见名称、manifest 本地化、帮助和 README；设计独立图标，注明非官方分叉。
- [ ] 保留 MIT 原版权与完整许可证；核对打包的第三方库版本和许可证，补充必要声明。
- [ ] 核查内置壁纸及其他素材来源；核对在线图片 API 的使用条款。
- [ ] 审计外部请求：图标第三方回退会发送网站域名，在线壁纸和 WebDAV 也有数据传输。
- [ ] 根据实际行为编写隐私说明和 Firefox 数据声明，设计必要的开关／同意流程；不得直接宣称无任何数据传输。
- [ ] 处理当前允许 HTTP 与 Mozilla 发布要求之间的差异，说明本地测试和正式分发的配置边界。
- [ ] 打包采用明确文件清单，包含许可、运行依赖及 Firefox 后台资源；排除凭据、测试数据和开发文件。
- [ ] 编写开发加载、数据迁移、版本升级和已知限制说明；说明正式版 Firefox 的长期分发需要签名。
- [ ] 在实际提交前重新检查名称／商店地址可用性和最新政策，整理分叉差异说明。

验收：可从记录的源码与步骤复现候选包，署名和声明与代码一致。远程仓库已按用户要求提前在 M1 创建；签名提交或上架仍属于后续发布步骤。

### M6：发布候选验收

- [ ] 运行相关迁移测试、完整现有测试、lint 和 Firefox 包检查；记录结果及已知基线例外。
- [ ] 在记录的 Firefox 稳定版和目标 ESR 上完成验收矩阵，记录系统与版本。
- [ ] 完成新配置首次安装、已有配置升级、浏览器重启、备份迁移回归。
- [ ] 补充有真实 API 密钥的 Unsplash／Pixabay／Pexels 下载、缓存和错误回退，验证长期在线轮换及权限撤销；当前无凭据不算通过。
- [ ] 输出候选包、校验值、版本说明、已知限制和测试证据。
- [ ] 如进入正式发布流程，完成签名／分发后另行验证实际安装包，不把临时加载等同于正式安装。

验收：没有未解决的数据丢失、启动失败或主要功能阻断问题；发布范围与实测范围一致。

## 6. 验收矩阵与证据记录

| 场景 | 稳定版 | ESR | 证据／限制 |
| --- | --- | --- | --- |
| 首次加载、新标签页与默认设置 | M2 通过 | 未测 | Firefox 156.0.1 临时安装／浏览器新标签页命令 |
| 后台唤醒、定时刷新与重启 | M2/M3 部分通过 | 未测 | 消息／存储／alarm 唤醒通过；完整重启、长期定时轮换未测 |
| 本地／在线壁纸、缓存与离线 | M3 范围内通过 | 未测 | 本地、纯色、Bing 在线、离线恢复；真实密钥服务和长期缓存未测 |
| 快捷链接、Dock、启动台、拖拽 | M3 通过 | 未测 | CRUD／文件夹／分页、Dock 鼠标排序、启动台搜索 |
| 图标发现、缓存与失败回退 | M3 通过 | 未测 | 本地受控 HTTP 样本、SVG、图标缓存及超时／大小限制 |
| 默认／内置引擎搜索、书签导入 | M3 通过 | 未测 | 实际 search.query、Bing、两种标签方式、Firefox 书签树 |
| 界面、多语言、窗口展开与快捷键 | M3 范围内通过 | 未测 | 简繁英、照片预览／拖动／展开、缩放和窗口宽度；浏览器 F11 未测 |
| 持久化、升级与并发操作 | M2 部分通过 | 未测 | 页面刷新／扩展重载保留设置；正式升级和并发留待 M4 |
| Firefox Sync 跨设备同步 | 未测 | 未测 | 需要适用的同步测试环境 |
| Aura Tab → Ember Tab 备份恢复 | 未测 | 未测 | 使用脱敏数据 |
| 普通／大图库备份 | 未测 | 未测 | 记录数据量与资源占用 |
| WebDAV 完整往返与失败处理 | 未测 | 未测 | 模拟服务与真实服务分开记录 |
| 正式签名包安装／升级 | 未测 | 未测 | 属于后续发布验证 |

测试证据至少包含：日期、提交或代码状态、浏览器／系统版本、数据样本规模、验证动作、预期／实际结果、相关日志或截图路径。不得在文档中记录真实密码、API Key 或用户备份内容。

优先增加能验证兼容行为的测试：Firefox 书签树、图标能力回退、消息回复、备份格式与 OPFS 失败路径。现有 jsdom 单测不能代替真实 Firefox 后台生命周期、权限和 UI 验证。

## 7. 关键源码入口

以下路径相对于本工作目录：

| 路径 | 用途 |
| --- | --- |
| `manifest.json`、`background-worker.js` | 扩展配置、后台事件、图标代理 |
| `tools/build-firefox.mjs`、`tools/test-firefox.mjs`、`docs/M2_FIREFOX.md` | Firefox 开发包生成、真实浏览器验收、安装和证据 |
| `favicon-offscreen.html`、`scripts/platform/favicon-offscreen.js` | Chrome 离屏图标解析与尺寸检查 |
| `scripts/platform/favicon-dom.js`、`favicon-runtime*.js`、`icon-network.js`、`extension-urls.js` | M3 图标 DOM／浏览器适配、请求限制及扩展 URL 边界 |
| `tools/test-firefox-m3.mjs`、`docs/M3_FEATURES.md` | M3 Firefox 功能回归与证据范围 |
| `scripts/platform/icon-fetch-bridge.js`、`scripts/shared/favicon.js`、`scripts/platform/icon-cache.js` | 图标 URL 校验、获取与缓存 |
| `scripts/platform/settings-contract.js`、`scripts/platform/settings-repo.js` | 设置契约与读写 |
| `scripts/domains/quicklinks/store.js` | 快捷链接、同步分块与配额处理 |
| `scripts/domains/search.js`、`scripts/domains/bookmarks/importer.js` | 搜索、书签导入 |
| `scripts/domains/backgrounds/`、`scripts/domains/photos/` | 壁纸和照片查看 |
| `scripts/platform/backup-manager.js`、`scripts/shared/webdav-client.js` | ZIP、恢复、OPFS 和 WebDAV |
| `scripts/domains/settings/content-data.js` | 备份和 WebDAV 设置入口 |
| `_locales/`、`scripts/platform/locales/` | 扩展名称与界面文案 |
| `scripts/libs/`、`package_extension.sh` | 内置依赖和上游打包清单 |
| `tests/`、`vitest.config.js`、`eslint.config.js` | 测试与检查配置 |

## 8. 尚未确定的实现事项

- M1 已确定最低目标 Firefox 140.0；稳定版与 ESR 的完整实机验证、后续版本变更在 M2–M6 继续记录。
- Gecko ID、首版和仓库归属已确定，见 `ember.project.json`；AMO 条目和签名归属在发布时核对。
- 第三方图标服务默认是否启用、网络权限申请方式：M3–M5 依据体验、隐私和发布规则确定。
- 大图库规模承诺及 OPFS 失败回退方案：M4 依据实测确定。
- 是否同时分发 Chrome 构建、是否做跨浏览器双向备份兼容：首期只承诺 Firefox 和上游导入验证，额外范围另行记录。
- 内置素材来源、第三方声明是否齐全、AMO 分叉审核是否满足：M5 完成核对，不能由 MIT 主许可证直接推导全部通过。

## 9. 当前接续摘要

- 当前阶段：M0–M3 已完成；M4 未开始。M3 分支为 `feat/m3-core-features`，从已推送的 M2 `cdf624f` 继续；main 仍保留 M1，尚未合并阶段分支。
- 已执行：Firefox 图标适配／请求限制、扩展 URL 处理、书签分隔符与跨目录去重；589 项回归、26 项实机检查及 Bing 公网检查、构建重复性和文档更新。
- 未执行：真实备份往返、跨设备 Sync、ESR、完整浏览器重启／升级、真实图片 API 密钥服务、独立图标／品牌、素材许可审计、签名和发布。Chromium 未实机。
- 当前阻塞：无 M3 核心功能阻塞；55 个 web-ext 警告归入 M5。M4 继续跟进生命周期时序，真实同步／WebDAV／图片 API 后续需要相应测试环境。
- Actions：用户已批准暂停，读回 `enabled: false`；M1 自动审批拒绝仅保留为历史，不再要求重复批准。M5 调整发布流程前保持暂停。
- 下一次开始开发的第一步：阅读本文与 `docs/M3_FEATURES.md`，核对分支、实际 Git 状态和最新测试记录；从 M3 开始 M4 数据可靠性工作。
- 首个实现目标：完整备份导出／恢复往返，检查 Firefox 下载回退、IndexedDB 图片恢复和同步分块，再验证 WebDAV、并发与完整重启。

### 后续维护方式

1. 开工前先读第 1、2、5、9 节，并核对代码实际状态，不重复已完成的调研。
2. 每次工作结束更新最后修改日期、里程碑状态、勾选项、验收证据和本节接续摘要。
3. 发现计划与实现不同，应修改受影响的计划项并在日志写明原因，不只在聊天里解释。
4. 记录实际执行的测试和未执行的测试；只有单测通过时不得写成 Firefox 验收通过。
5. 保持本文为进度主入口；大段日志或截图可放独立文件并从本文链接，避免复制多份互相矛盾的进度表。
6. 接续工作不依赖全局记忆。若更换目录，先更新本文位置与工作区路径。

## 10. 进度日志

| 日期 | 变更 | 验证与遗留 | 下一步 |
| --- | --- | --- | --- |
| 2026-09-27 | 完成 Aura Tab 源码评估；同意采用 Ember Tab；新增本计划 | 基线 a706cee，版本 3.5.3；仅静态评估与文档查询；没有运行测试或修改运行代码 | 用户启动开发后从 M1 开始 |
| 2026-09-27 | 完成 M1；新建公开仓库 LJure/ember-tab；固定 ID 与支持目标；准备隔离样本 | 75 文件 / 577 测试通过；lint 0 错误 / 0 警告；ZIP 结构检查通过；尚无 Firefox 运行验收 | M2 Firefox 最小可运行版 |
| 2026-09-27 | 完成 M2；授权暂停 Actions；新增 Firefox 构建与事件页配置、实机验收工具 | 578 测试及构建回归通过；ESLint 0/0；Firefox 156.0.1 的 10 项检查通过；web-ext 0 错误／57 警告，未宣称发布可用 | M3 网站图标及主要功能适配 |
| 2026-09-27 | 完成 M3；图标 DOM／网络／URL 适配、Firefox 书签修复及主要交互回归 | 589 测试、26 项实机及 Bing 在线检查通过；ESLint 0/0，构建回归通过；web-ext 0 错误／55 警告，无不支持 API 警告；范围和时序待办见 M3 报告 | M4 备份、同步、WebDAV 与生命周期 |

## 11. 参考资料

以下文档在前述评估期间查询；开发／发布时对会变化的兼容性与政策重新核对。

- [Aura Tab 上游仓库](https://github.com/nil-byte/aura-tab)
- [基线许可证](https://github.com/nil-byte/aura-tab/blob/a706cee56e43b80777de697dd4462083b1f97ef8/LICENSE)
- [Firefox background 配置](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background)
- [新标签页覆盖](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/chrome_url_overrides)
- [浏览器 API 差异](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities)
- [storage.sync 配额、扩展 ID 与同步机制](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/sync)
- [search.query 支持情况](https://github.com/mdn/browser-compat-data/blob/main/webextensions/api/search.json)
- [showSaveFilePicker 支持情况](https://github.com/mdn/browser-compat-data/blob/main/api/Window.json)
- [Gecko ID 与数据声明](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)
- [Mozilla 扩展发布政策：分叉命名、权限、数据传输等](https://extensionworkshop.com/documentation/publish/add-on-policies/)
- [Mozilla 商标使用指南](https://www.mozilla.org/en-US/foundation/trademarks/policy/)
