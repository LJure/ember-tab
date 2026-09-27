# Ember Tab 开发计划与进度记录

> 本文是项目的持续接续入口。后续开发前先阅读本文，再检查实际代码和 Git 状态；每个阶段结束或发生重要变更后更新本文。
> 创建／最后更新：2026-09-27（Asia/Shanghai）。M4 核心验收完成：备份迁移、真实 WebDAV、账号设置／链接同步及慢图床图标修复均获用户通过反馈。M5 工程与审计完成，仍有上线门槛；用户最新决定移除 Unsplash／Pixabay，新增 Wallhaven 收藏集壁纸（见 docs/WALLHAVEN.md）。M6 尚未完成。

最新补充：图标主体放大 14%，Wallhaven 随机／指定收藏集及上传者信息已实现。83 文件／624 单测、20 项 Firefox 检查（含真实公开收藏集）通过，可复现构建通过，web-ext 0 错误／52 警告。真实私有收藏集和长期轮换仍待用户验收。最新包哈希、用法与证据见 [Wallhaven 补充记录](docs/WALLHAVEN.md)。

后续界面修复：用户反馈的来源下拉框越界、浅色主题下 Wallhaven 标签／说明呈白色已修复。Firefox 浅色／深色与 100%／150% 缩放的四组实测、截图复核及 ESLint 通过，开发包已重建，最新哈希见上述补充记录。

## 1. 项目目标与已确认决定

- 项目名称：**Ember Tab**，用户已同意采用。
- 定位：基于 **nil-byte/Aura Tab** 的非官方 Firefox 新标签页扩展，独立维护。
- 简介建议：`基于 Aura Tab 的非官方 Firefox 新标签页扩展。`
- 英文简介建议：`An unofficial Firefox port of Aura Tab.`
- 公开仓库：`https://github.com/LJure/ember-tab`，用户已明确选择公开。尚未注册 Firefox 商店条目。
- 首期目标：迁移桌面 Firefox，尽量保留现有主要功能、外观和数据格式；避免无关重构。
- 不直接使用 `Aura Tab — Firefox Edition` 作为独立分叉品牌，避免让用户误认为原作者维护的官方版本。
- 在 README、关于页面和发布介绍中注明来源并链接原仓库，保留原版权和许可证。
- 最新授权范围：公开 GitHub 仓库、暂停 GitHub Actions；用户已启动 M5；最新要求放大产品图标主体、移除 Unsplash／Pixabay、接入 Wallhaven 收藏集及上传者信息。未执行签名、商店发布或启用 Actions。

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
| 开发分支 | `feat/m5-release-preparation`（从 M4 收尾 `a504754` 建立） |
| 首版 / 固定 Gecko ID | `0.1.0` / `ember-tab@ljure.github.io` |
| 最低 Firefox 支持目标 | `140.0`，待后续实机验证 |
| 许可证 | MIT，`Copyright (c) 2026 nil-byte` |
| 技术形态 | Manifest V3，原生 JavaScript ES modules、HTML、CSS，内置第三方库 |
| 现有校验 | Vitest + jsdom；ESLint；测试中有 Chrome API 模拟 |

M1 基线为 75 文件 / 577 测试，M2 为 75 文件 / 578 测试，M3 为 78 文件 / 589 测试。M4 初轮为 79 文件 / 600 测试，以及 23 项实机、26 项 M3 回归和模拟升级／重启。慢图床修复后为 80 文件 / 605 测试、15 项图标专项实机（含真实图床样本）、26 项 M3 回归通过；ESLint 0/0、可复现构建通过，web-ext 0 错误／55 警告。见 [M4 报告](docs/M4_DATA.md) 及 [图标修复／复验](docs/M4_ICON_RECOVERY.md)，原始证据分别在忽略的 `.local/m4/` 和 `.local/icon-recovery/`。

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

状态约定：`未开始`、`准备就绪`、`进行中`、`已完成`、`待外部条件`。只有有对应证据的项目才能勾选；核心验收完成不代表带入下一阶段的专项已通过。

| 阶段 | 状态 | 交付目标 | 依赖 |
| --- | --- | --- | --- |
| M0 评估与计划 | 已完成 | 来源、名称、基线、范围及本文 | 无 |
| M1 开发基线与工程准备 | 已完成 | 基线、版本矩阵、开发分支、公开 GitHub 仓库、合成样本 | M0 |
| M2 Firefox 最小可运行版 | 已完成 | 可以临时加载、打开新标签页并持久化设置 | M1 |
| M3 主要功能适配 | 已完成 | 图标、搜索、书签、本地／Bing 壁纸及主要交互；真实密钥服务等限制见报告 | M2 |
| M4 数据与备份可靠性 | 核心验收完成；专项带入 M6 | 备份、WebDAV、基本同步及图标修复通过；冲突等范围保留 | M2；完整验收依赖 M3 |
| M5 品牌、许可与分发准备 | 工程与审计完成；上线门槛未关闭 | 独立品牌、声明、可复现安装包和安装说明 | M3、M4 核心基线 |
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

- [x] 检查 Sync 配额与分块；80 条并发链接跨 3 块保留，部分到达时保留视图并阻止写入；明确本地锁不是跨设备冲突合并。
- [x] 使用基线上游原始导出器在 Firefox 中生成 ZIP 并导入 Ember，核对图片和数据；生产包不含该测试模块。
- [x] 真实 Chromium 系浏览器来源的 Aura ZIP 迁移：用户在 Brave／Aura Tab 3.5.3 导出，59 个链接、ZIP 37.1 MB，反馈 Firefox 导入后表现完全一致。Brave／Firefox 浏览器版本及图片数量未提供；不扩展为 Chrome 品牌浏览器单独实测。
- [x] Ember 导出／恢复往返、Blob 哈希、错误包和配额拒绝；事务中止返回失败，不宣称跨数据库全局回滚。
- [x] Firefox 普通下载回退、32 MiB OPFS 样本的耗时／工作集采样；更大规模和容量阈值尚未验收。
- [x] OPFS 实际支持、获取目录／创建写入器失败回退、临时文件清理与写入背压。
- [x] 本机 WebDAV 服务的连接、目录、列表、上传、下载、恢复及认证／权限／停滞／断连错误；修复路径编码和 XML 解析。
- [x] 真实 WebDAV：用户反馈测试通过，未提供服务类型及错误路径明细，按用户报告范围记录。
- [x] Firefox 账号同步：用户反馈设置与链接正常同步；慢图床图标问题在 `5bee9bd` 修复后也获用户复验通过。
- [x] 用户复验慢图床图标恢复，关闭此缺陷；Dock 背板默认值按用户要求保持上游一致。
- [ ] 真实 Sync 离线双端冲突、分块送达与清理交叠仍未单独确认，转入 M6 专项验收。
- [x] 记录权限取舍：开发版保留全站 HTTP(S) 以支持用户指定图标／图片／WebDAV；M5 决定可选授权与正式分发的 HTTP 边界。
- [x] 禁用／启用、完整重启后重新临时加载、同 ID 测试版本升级以及多标签页并发数据保留。正式签名安装／升级未测。
- [ ] M2 的 context unloaded 压力场景专项复现转入 M6；现有生命周期通过不等于所有销毁竞态消失。
- [x] 复现并修复初始化期间壁纸设置变更丢失；监听注册后重新读取设置，刷新等待初始化；Bing 立即刷新公网场景与长期后台轮换仍待复核。

详见 [M4 报告](docs/M4_DATA.md) 与 [人工验证清单](docs/M4_MANUAL_VALIDATION.md)；A、B、C 的基本设置／链接同步及图标修复已获用户通过反馈。转阶段范围与专项清单见 [M5 启动准备](docs/M5_PREPARATION.md)。

收尾：代表性备份、真实 WebDAV、基本账号同步及图标修复已有通过证据，用户要求准备 M5；未单独验证的冲突、生命周期压力、容量边界等继续保持未完成，发布前按 M6 处理。

### M5：品牌、许可与分发准备

结果与证据见 [M5 报告](docs/M5_RELEASE_PREPARATION.md)、[素材／网络审计](docs/M5_ASSET_AND_NETWORK_AUDIT.md) 和 [动态 HTML 复核](docs/M5_HTML_AUDIT.md)。

- [x] Firefox 名称、关于页、三语言致谢、独立图标和 Ember 变更记录。
- [x] 保留上游 MIT；核对三个内置库的官方发布包，补齐完整许可及 Heroicons 声明。
- [x] 原创几何素材替换原默认壁纸与系统图标；其他上游内联图形的项目级许可依据和独立来源边界已记录。
- [x] 外部请求清单、随包隐私页和 Firefox 内置数据同意声明。
- [x] 普通包仅 HTTPS；本机测试 HTTP 单独构建；WebDAV 拒绝重定向和 URL 内凭据。
- [x] 51 项动态 HTML 警告逐项复核，补充转义及不可信链接防护；另有桌面项目不适用的 Android 版本提示，不假称零警告。
- [x] 打包许可／隐私页、图标尺寸、重复构建检查；安装、迁移、更新与签名边界文档。
- [x] 后续按用户最新决定彻底移除 Unsplash／Pixabay 取图入口与适配器，历史图片兼容；产品图标主体放大 14%，Wallhaven 收藏集与上传者显示接入。
- [ ] Wallhaven 真实私有收藏集验收；Wallhaven／Pexels／Bing 使用与剩余素材来源发布审核。
- [ ] 实际签名／商店提交前重查名称与地址可用性、最新政策；不因 M5 工程完成就跳过审核。

M5 工程产物可用于 M6，正式发布仍受上述门槛限制。用户只批准开发与公开源码，本轮不提交签名或上架。

### M6：发布候选验收

- [ ] M4 延续专项：真实 Sync 离线双端冲突、活动分块到达／清理交叠；发现数据丢失风险须修复，不以基本同步通过代替。
- [ ] M4 延续专项：context unloaded 压力复现、启动立即刷新 Bing、较大图库／资源占用及恢复中断行为；准确记录无全局回滚等限制。
- [ ] 运行相关迁移测试、完整现有测试、lint 和 Firefox 包检查；记录结果及已知基线例外。
- [ ] 在记录的 Firefox 稳定版和目标 ESR 上完成验收矩阵，记录系统与版本。
- [ ] 完成新配置首次安装、已有配置升级、浏览器重启、备份迁移回归。
- [ ] 补充有真实 API 密钥的 Wallhaven 私有收藏集／Pexels 下载、缓存和错误回退，验证长期在线轮换及权限撤销；当前无凭据不算通过。
- [ ] 输出候选包、校验值、版本说明、已知限制和测试证据。
- [ ] 如进入正式发布流程，完成签名／分发后另行验证实际安装包，不把临时加载等同于正式安装。

验收：没有未解决的数据丢失、启动失败或主要功能阻断问题；发布范围与实测范围一致。

## 6. 验收矩阵与证据记录

| 场景 | 稳定版 | ESR | 证据／限制 |
| --- | --- | --- | --- |
| 首次加载、新标签页与默认设置 | M2 通过 | 未测 | Firefox 156.0.1 临时安装／浏览器新标签页命令 |
| 后台唤醒、定时刷新与重启 | M2–M4 部分通过 | 未测 | 唤醒、完整重启后数据保留通过；长期定时轮换／销毁压力场景未测 |
| 本地／在线壁纸、缓存与离线 | M3 范围内通过 | 未测 | 本地、纯色、Bing 在线、离线恢复；真实密钥服务和长期缓存未测 |
| 快捷链接、Dock、启动台、拖拽 | M3 通过 | 未测 | CRUD／文件夹／分页、Dock 鼠标排序、启动台搜索 |
| 图标发现、缓存与失败回退 | M3／M4 通过，用户图床复验通过 | 未测 | 自动图标与受控慢响应、真实图床样本；用户确认 `5bee9bd` 修复通过 |
| 默认／内置引擎搜索、书签导入 | M3 通过 | 未测 | 实际 search.query、Bing、两种标签方式、Firefox 书签树 |
| 界面、多语言、窗口展开与快捷键 | M3 范围内通过 | 未测 | 简繁英、照片预览／拖动／展开、缩放和窗口宽度；浏览器 F11 未测 |
| 持久化、升级与并发操作 | M4 隔离验证通过 | 未测 | 禁用启用、80 链接并发、临时包模拟升级／重启；正式签名升级未测 |
| Firefox Sync 跨设备同步 | 用户基本同步与图标复验通过，专项未完成 | 未测 | 设置／链接及慢图床修复通过；设备配置与冲突细分场景未单独提供 |
| Aura Tab → Ember Tab 备份恢复 | 自动格式验证及用户迁移验证通过 | 未测 | Brave／Aura 3.5.3，59 链接、37.1 MB ZIP；用户未提供 Firefox 版本 |
| 普通／大图库备份 | M4 样本通过 | 未测 | 普通下载及 32 MiB OPFS 往返、哈希与工作集采样；更大容量未测 |
| WebDAV 完整往返与失败处理 | 本机服务及用户真实服务测试通过 | 未测 | 真实服务类型及错误路径明细未提供，不能推断细分场景全部通过 |
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
| `tools/test-firefox-m4.mjs`、`tools/test-firefox-lifecycle.mjs`、`docs/M4_DATA.md` | M4 数据／备份、模拟 WebDAV 与生命周期 |
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
- M4 已实测 32 MiB 样本与 OPFS 失败回退；更大规模承诺与恢复中途全局回滚尚未完成。
- 是否同时分发 Chrome 构建、是否做跨浏览器双向备份兼容：首期只承诺 Firefox 和上游导入验证，额外范围另行记录。
- 内置素材来源、第三方声明是否齐全、AMO 分叉审核是否满足：M5 完成核对，不能由 MIT 主许可证直接推导全部通过。

## 9. 当前接续摘要

- 当前分支：`feat/m5-release-preparation`，从 M4 收尾 `a504754` 接续；main 仍为 M1，阶段分支尚未合并。先核对 Git 状态和最新 M5 报告。
- M4 用户核心验收已关闭，M5 工程／审计完成。新图标、壁纸、关于页、许可、隐私、HTTPS 限制及包检查已实施；无签名或正式发布。
- M5 初轮决定（已被后续替代）：Pixabay 暂停、Unsplash 保留。最新要求移除两者并接入 Wallhaven；以 [Wallhaven 补充记录](docs/WALLHAVEN.md) 为准。明确差距及已修项见审计文档，未取得服务方授权或统一凭据方案。
- M5 当前验证数字与产物哈希统一见 [M5 报告](docs/M5_RELEASE_PREPARATION.md)，不要把此前 55 警告和 605 单测当作最新结果。
- 发布门槛：Unsplash 等服务条款／素材审核，M6 Sync 冲突、压力／容量、ESR 与签名升级。恢复仍无跨数据库全局回滚。Pixabay 若恢复需先加 24 小时 API 缓存和请求策略。
- Actions 保持暂停。下一步从当前分支开展 M6；上线前必须先关闭项目元数据中的 releaseBlockers。

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
| 2026-09-27 | M4 工程与隔离验证完成；修复 ZIP 碰撞／恢复顺序、分块缺失保护、OPFS 与 WebDAV 错误及启动竞态 | 600 单测；M4 23 项、M3 26 项实机及模拟升级／重启通过；真实 Sync／WebDAV／Chrome 来源备份、全局回滚与更大容量仍待验收 | 外部验收；用户启动后进入 M5 |
| 2026-09-27 | 用户确认 Brave 备份与真实 WebDAV 通过；账号设置／链接正常同步；修复慢图床图标过早超时 | 605 单测、15 项图标专项实机含真实样本、26 项 M3 回归通过；用户全量图标复验与 Sync 冲突场景仍待确认；Dock 背板按用户要求保持上游默认 | 重新载入最新包复验图标 |
| 2026-09-27 | 用户确认图标修复测试通过；M4 核心验收收尾，新增 M5 启动准备文档 | 本轮仅更新文档和阶段状态，不重跑或新增运行验收；冲突、ESR、压力和正式签名等专项保留至 M6 | M5 品牌／许可／隐私／分发准备 |

| 2026-09-27 | M5 独立品牌、许可／隐私、HTTPS、动态 HTML 审计和分发准备；用户同意暂停 Pixabay、保留 Unsplash | 验证数字和最终包见 M5 报告；服务条款与 M6 仍是正式发布门槛 | M6 及上线前 Unsplash 整改 |

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
