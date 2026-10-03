# Chrome 自用版迁移

## 第一步：迁移基线与双浏览器构建

日期：2026-10-03。范围为本地自用、手动更新，Chrome 运行验收由后续步骤完成。

- 实施前工作区干净；从 `origin/main` 快进同步 `92be604` → `112a6e0f18a83bcca6b1c448dcd7ae0a65981465`，远端变更仅为 README。
- 功能版本沿用 Ember Tab 0.1.2；上游来源仍为 Aura Tab 3.5.3、`a706cee56e43b80777de697dd4462083b1f97ef8`。
- 改动前 Firefox 普通包：117 文件、544858 字节，SHA-256 为 `89de29702ed9925d9d5901b22ebd1e90b56e11d2f83d878d86107a4666be76e8`。共用构建调整后应得到完全相同的包。

## 构建入口

在仓库根目录安装依赖后执行：

```sh
npm run build:chrome
npm run build:firefox
npm run test:chrome-build
npm run test:firefox-build
```

| 目标 | 加载目录 | 普通归档 |
| --- | --- | --- |
| Chrome | `dist/chrome/` | `dist/ember-tab-0.1.2-chrome.zip` |
| Firefox | `dist/firefox/` | `dist/ember-tab-0.1.2-firefox.zip` |

归档旁生成 `.sha256`。版本读取 `ember.project.json` 的 `currentVersion`；修改版本后文件名随之变化。两个入口使用 `tools/build-extension.mjs`，只清理各自的固定输出目录，按运行文件白名单打包，保留 MIT 和第三方声明，以固定文件顺序和时间戳生成 ZIP。

Chrome 输出使用 Service Worker 和原 Chrome favicon 适配器，并包含 `favicon-offscreen.html`。Firefox 输出保留事件页后台、Firefox DOM 适配器及固定 Gecko ID。三语言扩展名称均为 Ember Tab，描述按目标浏览器生成；源根 manifest 和源 `_locales` 不由构建改写。

Chrome 最低版本配置为 116，与现有 offscreen 适配器调用的 `runtime.getContexts()` 对齐；自用验收以当前稳定版 Chrome 为准。普通包沿用 HTTPS 主机权限和网络 CSP。`--test-http` 只开放 localhost／127.0.0.1，用独立的 `-test-http.zip` 命名；运行此模式会将对应加载目录暂时变为测试包，随后应重新构建普通包。

`--release` 沿用项目的 `releaseBlockers` 检查，只生成归档，不签名、不上传。Chrome 自用包不代表 Chrome 商店发布；Firefox 签名与分发状态继续按原文档记录。

## 第一步验收范围

构建检查覆盖普通包可复现、文件白名单、许可、三语言身份、Chrome manifest、offscreen 页面及 HTML 引用完整性、两个输出互不覆盖、测试 HTTP 范围及源 manifest 不变。Firefox 另运行既有构建检查和 lint。

2026-10-03 已完成的验证：

| 检查 | 结果 |
| --- | --- |
| Chrome 构建测试 | 2 项通过：包完整性／可复现／Firefox 输出保留，HTTP 测试包范围与普通归档隔离 |
| 既有 Firefox 构建测试 | 1 项通过 |
| ESLint | 通过 |
| Firefox web-ext lint | 0 错误、0 提示、52 条原有警告；Firefox 包与基线逐字节一致 |
| Git 差异空白检查 | 通过 |

Chrome 普通 ZIP 的 SHA-256：`ef1e4a1a346ae832ccbb1fe768a68d60438674d281ab34438eac72d867acf62b`。Firefox 普通 ZIP 的 SHA-256 与上述基线完全一致。两端的 runtime JavaScript 都未在第一步改写，仅由构建选择有效的 favicon 适配器。

第一步完成时 Chrome 包尚未运行验收；第二步结果见下节。关于页、隐私说明等运行界面的 Firefox 文字在第三步处理；固定 Chrome ID、同 ID 更新保留数据与 Firefox ZIP 迁移在第四步处理。初期保持固定加载目录，数据迁移测试使用隔离配置。

## 第二步：Chrome 后台与图标运行验收

2026-10-03 完成。在本机安装的 Chrome **154.0.8037.93** 中运行 headless 验收，使用 ChromeDriver **154.0.8037.92**，每次新建独立配置。扩展通过浏览器级 CDP `Extensions.loadUnpacked` 装入测试配置，未使用用户日常配置。

### 已复现并修复的问题

| 问题 | 处理与验证 |
| --- | --- |
| Chrome 自身 `/_favicon/` 返回有效 PNG，但缺少 `Content-Type` | `icon-network.js` 仅在当前扩展自身的 favicon URL、缺少类型头且完整 PNG 签名匹配时补为 `image/png`；远端主机、其他扩展、其他路径及明确提供的类型头保持原行为 |
| offscreen 页面关闭后不再创建 | `favicon-runtime.js` 的 pending 只缓存进行中的创建工作；完成或失败后清空，下次请求重新检查页面是否存在 |
| 图标缓存写入返回成功后立即重载页面，可能丢失刚写入的图标 | `icon-cache.js` 等待 IndexedDB 写事务提交后才返回成功；事务中止返回失败，重载后的真实缓存读取已通过 |

Chrome 图标路径和消息路由继续使用现有后台／offscreen 模块。缓存提交修复和 MIME 识别模块属于两端共用代码，因此第二步生成的 Firefox 包与第一步历史包哈希不同；原 Firefox DOM 适配器未改变，已完成真实 Firefox 回归。

### 已完成的验收

| 检查 | 结果 |
| --- | --- |
| `chrome://newtab/` 覆盖、时钟和首次安装默认设置 | 通过 |
| 网页声明图标、manifest SVG、排除 monochrome 图标 | 通过 |
| 常规 favicon 候选和 Chrome 自身 favicon 回退接口 | 通过 |
| 自定义图标获取、缓存写入、立即重载后读取原始图片 | 通过 |
| 无效图像、超过 512 KiB 的图像、超时及后续正常请求 | 通过 |
| 主动关闭 offscreen 后下一次请求自动重建 | 通过 |
| 四个新标签页同时提交 32 次同 URL 自定义图标请求 | 全部成功，模拟服务器只收到一次图片下载，只有一个 offscreen 页面 |
| 停止真实 Service Worker 后，图标消息唤醒并复用已有 offscreen 页面 | 通过 |
| 停止后台后，storage 变更唤醒并创建／清理壁纸定时器 | 通过 |
| 停止后台后，alarm 唤醒并向扩展页面广播刷新 | 通过 |
| 普通候选包加载、HTTPS-only 网络策略及 DOM 解析 | 通过 |
| Chrome 运行检查 | **13 项通过** |
| Firefox 157.0 既有运行回归 | **10 项通过** |
| Vitest | **93 文件、689 项测试全部通过** |
| Chrome／Firefox 构建测试 | **2／1 项通过** |
| ESLint、Git 差异空白检查 | 通过 |
| Firefox web-ext lint | 0 错误、0 提示、52 条原有警告 |

网页和图片测试来自本机模拟服务。测试用 HTTP 包复制到一次性证据目录后，立即恢复 `dist/chrome/` 为普通 HTTPS 包；alarm 广播使用测试包中的独立探针页，避免依赖壁纸服务。探针页未进入普通 ZIP。后台恢复通过 CDP 停止真实 worker 后验证，不把它记为自然空闲超时或长期壁纸轮换验收。

本轮普通包：

- Chrome：118 文件、545679 字节，SHA-256 `1a91d2b310f4ac6fe48ee33740f595ee9a7b743f67104a887d8102ae62f2a990`。
- Firefox：SHA-256 `d1941d6a820583e6751c578edb0dac9f175400b9330dd7dc3a0b0ffc70a87ac6`。

证据（本地忽略目录）：

- Chrome：`.local/chrome-runtime/run-1790960110379/report.json`、`newtab.png`。
- Firefox：`.local/chrome-step2-firefox/firefox-smoke.json`、`newtab.png`。
- 修复前复现报告：`run-1790959739184`（favicon 类型头）、`run-1790959824994`（缓存重载）、`run-1790959915561`（offscreen 重建），均位于 `.local/chrome-runtime/`。

### 复现运行检查

使用 Node.js 24 和匹配本机 Chrome 主版本／构建的官方 ChromeDriver。本机驱动保存在 `.local/chrome-runtime/driver/chromedriver-win64/chromedriver.exe`。默认浏览器为 `C:/Program Files/Google/Chrome/Application/chrome.exe`；其他路径可通过 `CHROME_BINARY` 和 `CHROMEDRIVER_BINARY` 环境变量指定。

```sh
npm run test:chrome:runtime
```

入口为 `tools/test-chrome-runtime.mjs`，每次在 `.local/chrome-runtime/run-<时间戳>/` 保存报告和新标签页截图。执行完成后退出测试浏览器；故障时保存失败截图。运行检查要求可启动子进程和回环网络的执行环境。

参考：[Chrome 扩展 CDP 接口](https://chromedevtools.github.io/devtools-protocol/tot/Extensions/)、[官方 ChromeDriver 下载](https://googlechromelabs.github.io/chrome-for-testing/)。

## 第三步：平台文字与功能回归

2026-10-03 完成。Chrome 154.0.8037.93 的综合检查使用全新隔离配置，Firefox 157.0 同时完成共用功能回归。

### 平台文字和修复

- Chrome 包的简体中文、繁体中文、英文关于页和搜索权限提示改为 Chrome 对应文字；Firefox 包保留 Firefox 文字。
- 隐私页按构建目标生成，更新日期和版本，并分别说明 Chrome Sync、默认搜索和扩展权限用途。保留两端存储独立、ZIP 携带图片 Blob 的跨浏览器说明。Chrome 包不再包含 Firefox 140 的安装声明。
- 第三方声明同时注明 Firefox／Chrome 非官方移植关系，保留原作者和完整许可。
- 修复相册大图查看器的弹层登记：一次 Esc 返回相册，再次 Esc 关闭相册。关闭按钮、父窗口关闭、销毁时也正确清理大图弹层，并恢复相册层级。新增 4 项针对性回归测试；Chrome 和 Firefox 实际页面均验证了 Esc 返回相册。

### 验证结果

| 范围 | 结果 |
| --- | --- |
| 第二步后台、offscreen、图标及恢复检查 | 综合运行继续通过 |
| 书签根目录、嵌套目录、去重和实际导入 | 通过 |
| UI 新建快捷链接、自定义图标、Dock 固定、编辑、文件夹、排序、分页、删除 | 通过 |
| Dock 指针拖动及顺序保存，启动台搜索和 Esc，快捷键 | 通过 |
| 本地壁纸上传、选择、裁剪、重载，纯色壁纸及缺少密钥回退 | 通过 |
| 相册缩略图、大图切换、展开还原及窗口拖动 | 通过 |
| 离线本地壁纸，800／1920 视口及 80%／125% 浏览器缩放 | 通过 |
| Bing、Pexels、Wallhaven 壁纸应用和手动刷新 | 模拟 API／图片通过 |
| 三语言设置及关于页归属文字 | 通过 |
| 搜索默认关闭、本地开关与五种独立联想来源，历史去重和删除 | 通过 |
| 八个直接引擎、三个独立模式，输入法组合输入、过期响应、禁用取消、Esc | 模拟联想／路由通过 |
| 默认 Chrome 搜索新开标签页，Bing 当前页中文和特殊字符编码 | 实际导航通过；外部搜索结果可用性受服务影响 |
| ZIP 排除搜索隐私字段，恢复保留当前设备的历史及开关 | 通过 |
| 同一 Chrome 扩展 ZIP 往返，设置、链接、图标和图片逐字节比对 | 通过 |
| 损坏、缺失图片、错误元数据、超配额及非 ZIP 拒绝，保留现有数据 | 通过 |
| 原生 OPFS 流式上传备份和临时文件清理 | 通过，`usedStreaming: true`，清理后目录为空 |
| HTTPS WebDAV 连接、嵌套中文／#／% 目录、PUT、命名空间列表、GET、恢复、删除 | 本地模拟服务通过，ZIP 上传／下载均为 105331 字节 |
| WebDAV 错误密码、拒绝列表、正文停滞及中断传输 | 正确失败 |
| 流式保存至真实可写文件、取消保存，以及普通 Blob ZIP 下载 | 通过；保存选择器使用测试替身，文件写入与浏览器下载真实执行 |
| Chrome 综合运行 | **40 项通过** |
| Firefox M3 实际运行回归 | **26 项通过** |
| Firefox 搜索实际运行回归 | **10 项通过**，包括实际隐私窗口检查 |
| Vitest | **94 文件、693 项通过** |
| Chrome／Firefox 构建测试 | **2／1 项通过**，包括三语言、隐私文字、许可及测试文件排除 |
| ESLint、Git 差异空白检查 | 通过 |
| Firefox web-ext lint | 0 错误、0 提示、52 条既有警告 |

### 范围与证据

Chrome 综合入口：

```sh
npm run test:chrome:features
```

沿用第二步 Node／ChromeDriver 要求。故障定位可仅执行备份范围：`node tools/test-chrome-runtime.mjs --features-only --backup-only`。运行结束后 `dist/chrome/` 已恢复为普通 HTTPS 包；搜索替身、探针页、HTTPS 证书和测试密钥均不进入 Chrome／Firefox 普通归档。

- Chrome 综合报告及 `newtab.png`、`photos.png`、`online-wallpaper.png`、实际下载的 ZIP：`.local/chrome-runtime/run-1790964711181/`。
- Firefox M3 报告：`.local/chrome-step3-firefox/firefox-smoke.json`。
- Firefox 搜索报告：`.local/chrome-step3-firefox-search/report.json`。
- 隐私说明最后一处中文替换修正后，已重新通过双端构建及文字检查。综合运行报告内的归档哈希为修正前版本；运行代码相同，最终包哈希以下表为准。

联想服务和在线壁纸使用可重复的模拟响应，不代表各外部 API 的实时可用性或真实密钥验证。实际默认搜索通过 `chrome.search.query` 导航，但 Google 将请求转至 429 验证页面；未操作验证挑战。实际 Bing 搜索转至 `cn.bing.com`，保留正确的查询文字。

WebDAV 使用回环 HTTPS 模拟服务器，不代表真实 WebDAV 账号／服务器兼容性。初始明文 HTTP ZIP GET 中，服务器返回 200 和完整数据，Chrome 却收到空 204；相同数据改为非 ZIP 后缀可正常下载，本机同时运行迅雷 `DownloadSDKServer.exe`。这提示本机下载处理干扰，但未确认具体责任组件。迁移普通包只允许 HTTPS；改用 HTTPS 模拟服务后原 `.zip` 文件完整往返通过。未更改迅雷设置或关闭其进程。

HTTPS 测试证书是仓库内公开的测试材料，测试浏览器只对该证书公钥放行，不安装系统证书，也不对任意网站关闭证书验证。保存选择器测试返回真实 OPFS 文件句柄，覆盖写入和取消逻辑；未自动操作系统原生保存对话框。Chrome 实际隐身模式、跨设备账号 Sync 未在本轮验证。Chrome Sync 的说明依据 [官方 storage 文档](https://developer.chrome.com/docs/extensions/reference/api/storage)，不等同于未上架扩展的跨设备同步实测。

同一 Chrome 扩展内的 ZIP 往返已通过，**真实 Firefox 导出 → Chrome 导入**仍属于第四步。固定 ID、重启、同 ID 手动更新及保留数据也尚未验收。

本轮普通包（版本沿用 0.1.2）：

| 浏览器 | 文件／字节 | SHA-256 |
| --- | --- | --- |
| Chrome | 118／545925 | `4aac9378e6bd4b3d09ea318d81928b1f5be2437dbdd4e202c5855b91c64046d8` |
| Firefox | 117／545428 | `adc450191656a6457036c46665971d6825179c62bbc6b5f165b76fb481f17e1a` |

## 第四步：固定身份、更新保留数据与跨浏览器迁移

2026-10-03 完成。Chrome 身份由 `ember.project.json` 中的 `chromePublicKey`／`chromeId` 管理；公钥写入 Chrome manifest 的 `key`，构建同时校验格式及 ID 对应关系，不再依赖加载目录生成身份。Firefox 包不包含该字段，Gecko ID 继续为 `ember-tab@ljure.github.io`。

**Chrome 固定 ID：`ikjonccnpooflmknleniaiicpogiaieb`**。

这是本项目独立生成的公开公钥，不是上游或商店条目的身份。无需提交商店即可用于本地未打包扩展。构建不会重新生成公钥；后续更新请保留这两个配置字段，否则可能改变扩展身份。机制依据：[Chrome manifest key 文档](https://developer.chrome.com/docs/extensions/reference/manifest/key)。

### 实际运行验证

新增 `npm run test:chrome:lifecycle`。测试使用 Chrome **154.0.8037.93**、Firefox **157.0** 和独立浏览器配置，未读取日常浏览器数据。Firefox 数据集由真实扩展模块写入，备份由实际 Firefox 中的现有导出器通过原生下载生成；未在 Node 中拼装迁移 ZIP，也未替换导出器。Chrome 从设置页选择该文件、确认恢复，并自动重载。

迁移数据集包含三个快捷链接、一个含两条链接的文件夹、Dock 固定顺序、标签、文字／自定义图标、界面和搜索设置、本地壁纸选中状态、合成壁纸 API 配置，以及本地图片、壁纸资源、网站图标缓存和工具栏图标四个 IndexedDB store。四个 store 共 4 条记录、6 个 Blob 字段，逐一对比 ID、类型、大小及 SHA-256。额外的正常缓存预热记录不算数据丢失。

| 检查 | 结果 |
| --- | --- |
| 实际 Firefox 导出 ZIP，排除历史、搜索开关／来源和 WebDAV 凭据 | 通过 |
| Chrome 固定 ID 与实际运行 ID 一致，写入代表性数据 | 通过 |
| 扩展正常重新加载 | local、sync、历史、凭据和图片字节保留；页面上下文确实更换 |
| 关闭并重新启动 Chrome | 注册和数据保留，无重新加载目录／重新注入扩展 |
| 覆盖同一目录后重新加载 | 新版本及新脚本生效，未卸载扩展，数据保留 |
| 更新后再次重启 | 版本、新脚本和原数据继续保留 |
| 从另一目录加载同公钥扩展并正常重载 | ID 一致，既有数据保留；后续重启继续通过 |
| Chrome 原生导出迁移前备份，取消 Firefox ZIP 导入 | 原数据保持不变 |
| 通过 Chrome 设置页实际导入 Firefox ZIP | 设置、链接、文件夹、Dock、壁纸选择及导出的图片字节匹配 |
| 目的端搜索历史和 WebDAV 凭据 | 保留 Chrome 本机内容，不导入 Firefox 的历史或凭据 |
| 迁移后再次关闭、重启并模拟离线 | 数据保留，本地壁纸仍显示 |
| 从迁移前 Chrome ZIP 恢复 | 原 Chrome 设置、链接和图片字节恢复；本机历史／凭据仍保留 |
| 第二个全新 Chrome 配置加载另一路径 | ID 相同；没有继承第一个配置的本地数据 |
| 早期无 `key` 的 Chrome 副本 → 固定 ID | ID 确实不同；原生 ZIP 转移通过，旧扩展数据仍完整 |
| 第四步生命周期／迁移入口 | **13 项通过** |
| 固定 ID 下的 Chrome 后台／图标运行回归 | **13 项通过** |
| Chrome／Firefox 构建检查 | **3／1 项通过**；Chrome 另覆盖身份缺失、格式错误、ID 不匹配拒绝 |
| ESLint、Git 差异空白检查 | 通过 |

手动更新验证在测试副本中将 0.1.2 改为 **0.1.3** 并增加一个脚本标记，用于证明新内容确实加载。**0.1.3 仅是测试版本，不是发布版本**；普通构建仍为 0.1.2，测试页、脚本和版本改写均不进入交付包。主配置经历 4 个不同的 Chrome 主进程：412、21700、4664、21096；三个后续启动均在操作开关前确认开发者模式已保持开启。

本轮运行记录：`.local/chrome-lifecycle/run-1790997713891/report.json`，截图为同目录的 `migrated-newtab.png`。实际 Firefox 导出的 ZIP 位于该目录的 `firefox-export/`，27956 字节，SHA-256 为 `bf1ee83131bd35ae0c8bc2bacf43eb9f9663b92029c5fd299aeaa86f3e8a959b`。迁移前 Chrome 备份及无固定 ID 的 Chrome 导出位于 `chrome-export/`。固定身份后的后台／图标运行报告为 `.local/chrome-runtime/run-1790997771933/report.json`。

### 自用安装和更新时需保持的条件

1. 在 `chrome://extensions/` 开启并保持**开发者模式**，加载 `dist/chrome/`，核对上述 ID。当前 Chrome 在开发者模式关闭时会停用未打包扩展；本轮已实际复现，其原因值对应 [Chromium 的 developer extension 禁用条件](https://github.com/chromium/chromium/blob/main/extensions/browser/disable_reason.h)。
2. 更新前从当前扩展另存 ZIP。重新构建后，保留固定公钥，把新文件放到同一加载目录，并在扩展页点击“重新加载”，再打开新标签页。更新时不先卸载，也不删除浏览器配置。目录应持续存在，推荐固定使用 `dist/chrome/` 或专用自用目录。
3. 如果已使用第一至三步的**无固定 ID** Chrome 包，先在旧扩展导出 ZIP，再加载固定 ID 版本并恢复。首次引入 `key` 会改变旧包的身份，覆盖目录不会自动把旧身份的数据转给新身份；本轮已验证 ZIP 过渡方案。确认转移成功前保留旧扩展及备份。
4. Firefox → Chrome 时，先导出 Firefox ZIP，也先另存 Chrome 当前备份，然后在 Chrome 的“设置 → 数据 → 导入”中选择 Firefox ZIP。导入替换可迁移数据；取消不会更改数据，需要回退时导入之前另存的 Chrome ZIP。
5. 搜索历史和新搜索功能开关／来源继续留在各设备；WebDAV 凭据需在目的端重新填写，或保留目的端已有配置。壁纸 API 密钥包含在普通备份内，请勿公开备份。

测试先通过 CDP 加载隔离副本，再执行正常扩展重载后验证注册的持久性。更换目录时同样执行正常重载；仅把测试扩展通过 CDP 重新注入并不算“重启后仍注册”。实际原生文件选择对话框由 Selenium 文件输入完成，未自动操作操作系统对话框。

本次是小型、可重复的合成数据集在真实浏览器间迁移，不代表用户完整资料、大容量图片库、Chrome 多设备账号 Sync、无痕模式或新增权限升级的验收。既有恢复中断处理、跨数据库全局回滚等限制沿用原记录，未把正常恢复／手动回退表述为自动回滚。Firefox 商店签名安装／升级门槛也不由本轮 Chrome 测试清除。

本轮普通包：Chrome 118 文件／546276 字节，SHA-256 `e36996d0f7114fbe207eb70e57ae9f3cb94e7043ccc016b10e632d7e7191f9f9`；Firefox 117 文件／545428 字节，SHA-256 `adc450191656a6457036c46665971d6825179c62bbc6b5f165b76fb481f17e1a`，与第三步逐字节一致。

## 第五步：自用交付与操作说明

2026-10-03 完成。新增 `npm run package:chrome:self-use`：先构建普通 Chrome 包，再生成只包含运行文件、操作说明、验证记录、收据与完整清单的自用交付包。交付目录为 `dist/chrome-self-use/`，浏览器应加载其 **chrome 子目录**；普通包和直接加载入口 `dist/chrome/` 仍保留。

交付说明：[Chrome 自用安装与更新](CHROME_SELF_USE.md)。包含首次安装、Firefox ZIP 迁移、无固定 ID 旧 Chrome 包过渡、源代码构建、同目录手动更新、回退、文件校验与常见问题。独立的 [验证记录](CHROME_SELF_USE_VALIDATION.md) 记录实际浏览器版本、测试来源及未验证范围；不会将新构建自动表述为已通过旧检查。

| 交付物 | 内容／校验 |
| --- | --- |
| `dist/ember-tab-0.1.2-chrome-self-use.zip` | 122 文件，561474 字节；解压后的 chrome 目录含 118 个运行文件 |
| 自用 ZIP SHA-256 | `ec56004e004d4876194abf53331faecbda0b44e0979483999ffd46602bad936c` |
| 同名 `.sha256` | 整个交付 ZIP 的校验值 |
| 包内 `SHA256SUMS.txt` | 121 个运行文件／文档／收据的完整校验清单，不包含清单自身 |
| 包内 `RELEASE.json` | 当前版本、固定 ID、运行 ZIP 字节数／哈希，以及与已验证运行包的匹配状态 |

新增打包工具固定 ZIP 文件顺序与时间戳；连续两次打包的字节数和哈希相同。运行 ZIP 仍是第四步的 `e36996d0…191f9f9`，Firefox 仍为 `adc45019…f17e1a`。逐文件检查证明交付目录、交付 ZIP 的 chrome 子目录、普通运行 ZIP 和 `dist/chrome/` 的全部运行内容相同。

第五步检查通过：Chrome 构建 3 项、Firefox 构建 1 项、ESLint、Git 差异空白；另核对 122 个文件的完整性、121 条清单、固定 ID／0.1.2 版本／HTTPS 权限、许可及隐私文件、可携带文档链接和测试材料排除。核验结果为 `.local/chrome-step5-delivery-report.json`。本步仅新增打包工具和交付文档，未更改运行代码，未重复第三步全部浏览器功能测试；最终运行包与第四步验收包逐字节一致。

本轮在本地提供 Chrome 自用包，不操作日常 Chrome 配置，不提交商店，也未创建 GitHub Chrome 发布。现有 Firefox 发布和签名升级验收状态保持独立。

## 步骤完成状态

2. Chrome 后台、offscreen、图标并发与停止后恢复实测：已完成。
3. 平台文字适配和搜索、壁纸、Dock、书签、备份回归：已完成，范围和限制见上节。
4. 固定 Chrome ID，验证重新加载、重启、更新和跨浏览器数据迁移：已完成，范围和操作条件见上节。
5. 交付自用包、安装更新说明与验证记录：已完成，文件与操作入口见上节。

API 依据：[Chrome offscreen 文档](https://developer.chrome.com/docs/extensions/reference/api/offscreen)，其中记录 `runtime.getContexts()` 从 Chrome 116 起提供。

## 交付后的 YouTube 图标修复

2026-10-03 用户报告 Chrome 的 YouTube 自动图标模糊、刷新无改善。已在隔离 Chrome 复现：大页面超出 512 KiB 后未解析站点图标，Chrome 的 128 参数实际返回 64×64，并提前终止备用来源选择。改为有限 HTML 前段解析和按实际分辨率选择后，实际取到站点声明的 144×144；通过编辑窗口刷新也能替换旧缓存。

修复和验证见 [YouTube 图标记录](CHROME_ICON_FIX.md)。当前自用交付包已重新生成，仍为本地 0.1.2、固定 ID 不变；当前运行哈希及测试范围见 [交付验证记录](CHROME_SELF_USE_VALIDATION.md)。上文各步骤的包哈希是完成当时的历史记录。

随后用户报告千问和谷歌翻译刷新回归，已修正原站优先、明确的浅深色 favicon media 和 Vemetric 默认 SVG 过滤；真实编辑窗口刷新两站后恢复原站图，YouTube 144×144 保留。详见 [图标来源修复](CHROME_ICON_SOURCE_FIX.md)。该轮验收为 705 项单元测试、Chrome 15 项、Firefox M3 26 项；当前运行哈希与包内记录以交付验证页为准。

之后用户确认上述两站正常，并报告 Mini4K／Lunaris 刷新模糊。已保留 32 像素原站图、调整备用源优先级；四站实际刷新与重载通过，YouTube 保持 144 像素。该轮验收为 710 项单元测试、Chrome 15 项、Firefox M3 26 项，见 [小尺寸图标记录](CHROME_ICON_NATIVE_FIX.md)。本地自用包已更新，版本和固定 ID 保持不变。

腾讯新闻／B站 HTTP 链接复现出原站请求受 HTTPS 权限限制的问题；已改为公共 HTTP 地址先尝试 HTTPS 取图，并加入“选择图标”入口。选择保存在本机缓存中，普通保存和重载保留，明确刷新恢复自动选择；两版共用实现。最新验收为 717 项单元测试、Chrome 18 项、Firefox M3 29 项，七站实际发现、六站刷新及腾讯／B站候选界面通过。详见 [候选图标记录](CHROME_ICON_CHOOSER.md)，当前包哈希和范围以交付验证页为准。
