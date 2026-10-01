# Ember Tab 0.1.1 首次更新实现记录

日期：2026-10-01。状态：本地实现与候选验证完成；未签名、未提交 AMO 更新。本记录取代 [评估文档](FIRST_UPDATE_ASSESSMENT.md) 中的实施前状态。

## 使用方式

设置 → 通用 → 搜索，可开启“保存搜索历史”和“实时搜索联想”，两项均默认关闭、互相独立。选择联想来源不会自动打开联想。

设置 → 外观 → 搜索历史与联想面板，可调背景不透明度（0–100%，默认 68%）和毛玻璃模糊强度（0–64px，默认 48px）。历史与联想共用这组数值；拖动即时预览，释放时自动保存，可单独恢复面板默认值。

- 相册／设置图标恢复截图二的原版花瓣与齿轮，源 JPEG 与上游基线逐字节一致。品牌生成工具不再覆盖这两个图标。
- 历史只记录在 Ember 提交的搜索，最新在前、去重、最多 100 条。主动点击空搜索框或按 ↓ 显示最近记录；输入时筛选匹配项。新标签页的自动聚焦不展开历史，也不读取历史内容。悬停／键盘聚焦历史行可删除，也可在设置中确认清空全部。关闭开关后停止记录与展示，保留旧记录直到明确删除。
- 输入停顿 280ms 后获取联想，中文输入法组合结束后查询。方向键选择、Enter 搜索、Escape 关闭；可点击文字或右侧搜索按钮提交。按试用反馈移除搜索框右侧清空输入的 ×，保留历史行的删除按钮。最多 8 项；历史和在线建议去重并共同显示，长列表滚动并避开底部 Dock。

| 搜索框当前选择 | 联想来源 | 点击建议后的搜索目标 |
| --- | --- | --- |
| Google、Bing、百度、DuckDuckGo、Brave、Yahoo、Yandex、Naver | 跟随插件搜索框所选引擎 | 同一搜索引擎 |
| 浏览器默认、搜狗、Ecosia | 共用独立“联想词来源”设置：Bing、Google、百度、DuckDuckGo、Brave | 仍使用浏览器默认、搜狗或 Ecosia |

“跟随”指插件搜索框的引擎选择。浏览器默认模式通过 Firefox 搜索 API 提交搜索；不读取地址栏引擎来决定联想来源。搜狗和 Ecosia 不接入自身联想接口；来源选择中没有搜狗。切换搜索框引擎保留独立来源选择。

## 数据与请求边界

`emberSearchHistory`、`searchHistoryEnabled`、`searchSuggestionsEnabled`、`searchSuggestionSource` 只写入 `storage.local`。不写入 Firefox Sync，并在所有共用 ZIP 导出路径（内存、下载、WebDAV）排除；恢复时剔除外部备份里的同名字段，并保留本机已有历史与开关／来源。快捷链接专用导出只序列化链接字段。浏览器整个配置目录的外部备份不受扩展控制。

历史增删由后台队列串行处理，多标签并发不会覆盖已完成的删除。关闭历史后不会读取历史内容；设置里的明确清空仍可使用。实际无痕窗口不读取／写入历史，也不请求联想，新设置控件在无痕窗口中禁用。

面板不透明度与模糊强度是普通外观设置（`searchPanelOpacity`、`searchPanelBlur`），参与 Firefox Sync 和备份，只存数值，不含搜索词。设置预览使用固定示例；外观更新不会展开面板、读写历史或请求联想。异常恢复值会被归一化至合法范围；保存失败恢复上次数值并提示。

在线联想在 Firefox 允许 `searchTerms` 数据传输时启用，只访问当前生效的一家服务。请求使用 HTTPS、不携带登录 Cookie、拒绝重定向，3 秒超时，响应最多 64 KiB；百度按 GB18030 解码。仅解析 JSON，以 `textContent` 显示候选，不执行 JSONP／远端代码。切换输入／引擎／来源、失焦、关闭或页面销毁时取消请求，旧响应不会覆盖新输入。建议只缓存于当前页面内存（最多 100 组、60 秒），禁用时清空；429 暂停该来源 60 秒，其他失败短暂暂停，均不自动改投另一家服务。

第三方候选接口为目前实测可用的网页端点，不是长期稳定性或正式开放 API 授权承诺。接口不可用时保留普通搜索及已开启的本地历史。隐私说明及简体／繁体／英文设置文案已更新。

## 首次实现验收证据（反馈修复前）

- 完整单元回归：88 个文件、658 项通过。新增测试覆盖历史并发／上限／清空、备份排除与恢复保留、来源规则、不同响应结构、GBK 解码、未同意、429、超时、取消、恶意数据、输入法、乱序及关闭／销毁。
- ESLint 通过；可复现构建测试通过。web-ext：0 errors、0 notices、52 warnings，计数与首版相同，新搜索模块不产生这些警告。
- Firefox 157.0 与 ESR 140.16.0：搜索更新各 8 组实机检查通过，包括两个开关的真实 UI 操作、来源五项、全部八个直接引擎和三个独立来源模式、提交目标、输入法／旧响应、关闭、真实 ZIP 导出／恢复及实际无痕窗口。八家适配服务均使用公开测试词 `steam` 通过真实 HTTPS 返回并显示建议；键盘选择最后一项可滚动到可见区域。
- 未注入搜索测试夹具的候选包：Firefox 157.0 基础 10 组回归通过，覆盖启动、设置重载、后台唤醒、闹钟和扩展重载。
- 0.1.0 → 0.1.1 临时加载升级与重启检查：设置、图片 Blob、历史及本机搜索选择均保留。该测试使用临时加载扩展，不替代正式签名 XPI 的升级验收。

原始报告与截图在项目本机忽略目录中：

| 证据 | 路径 |
| --- | --- |
| Firefox 搜索／真实接口与截图 | `.local/search-update/report.json`、`history.png`、`suggestions.png`、`settings.png` |
| ESR 同一矩阵 | `.local/search-update-esr/report.json` 及截图 |
| 升级／重启 | `.local/search-update-lifecycle/lifecycle.json` |
| 未注入夹具的基础回归 | `.local/search-update-baseline/` |
| 单元回归／包检查 | `.local/search-update-unit.log`、`.local/search-update-web-ext.json` |

`tools/test-firefox-search-update.mjs` 构建单独的测试 ZIP，拦截搜索导航和确定性建议，用于验证路由与交互；`--live` 的最终检查使用实际 HTTPS。测试夹具不进入交付包，测试配置与用户日常浏览器隔离。

复验命令：

```powershell
npm test
npm run lint
npm run test:firefox-build
npm run lint:firefox
npm run test:firefox
npm run test:firefox:search -- --live
# ESR: 先将 FIREFOX_BINARY 设为 ESR 可执行文件，FIREFOX_SEARCH_EVIDENCE 指向独立证据目录。
# 升级: 将 FIREFOX_UPGRADE_FROM 设为旧包、FIREFOX_EVIDENCE_DIR 设为独立目录，运行 npm run test:firefox:lifecycle。
```

## 试用反馈修复

2026-10-01 在同一 0.1.1 未发布候选中修复：

- 历史与联想共用面板改为独立的页面图层，避开搜索框及布局动画形成的过滤层；按搜索框位置、大小及动画结束重新定位。保持与搜索框相同的 48px 背景模糊，并将背景不透明度从 14% 提至 68%，同时提高来源标题对比度。
- 新标签页及初始化／偏好加载／后台历史变化都不主动展开面板；点击、输入或 ↓ 才激活。Escape、失焦、外部点击和搜索提交关闭面板，背景数据更新不将其重新打开。
- 移除输入框清空按钮及不用的文案；历史条目的删除功能保留，键盘可聚焦删除按钮而不意外关闭面板。

补充回归：88 个文件、661 项通过；Firefox 157.0 完成 9 组检查、ESR 140.16.0 完成 8 组（包含真实新标签页自动聚焦、主动点击、面板对齐、删除、无痕及备份；Firefox 另含八家实际 HTTPS 联想来源）。高对比壁纸测试图案只用于隔离浏览器诊断，未进入交付包；无头软件图形合成的截图显示背景遮罩，桌面硬件合成的毛玻璃像素效果另由用户实际浏览器显示。

证据：`.local/search-panel-fix-unit.log`、`.local/search-panel-fix-render/report.json`、`.local/search-panel-fix-esr/report.json`；预览图 `history.png`、`newtab-history-closed.png`、`history-glass-detailed.png`、`suggestions-glass-detailed.png` 在对应目录内。测试只设置隔离配置的软件图形渲染，未改用户日常 Firefox 偏好。

## 面板外观自定义

按用户后续要求，外观中加入两个滑块、固定示例预览和恢复默认值按钮。拖动实时改变当前页面面板样式，松开后写入；重新打开标签页保留设置。恢复只重置这两个数值，不清空历史，也不改变搜索开关或联想来源。

最终回归：89 个测试文件、666 项通过；ESLint 与可复现构建通过；web-ext 为 0 errors、0 notices、52 warnings。Firefox 157.0 与 ESR 140.16.0 各 9 组隔离浏览器检查通过，新增覆盖滑块预览与保存时机、重开标签页持久化、真实下拉面板应用数值、恢复默认和新标签页不自动展开。原有网络服务适配在前述首次验收及反馈修复中已验证，本次未改变接口。

证据：`.local/search-panel-appearance-unit.log`、`.local/search-panel-appearance-web-ext.json`、`.local/search-panel-appearance/report.json`、`.local/search-panel-appearance-esr/report.json`。外观截图为 `.local/search-panel-appearance/appearance.png`。

## 新标签页搜索后重置

开启“在新标签页打开搜索结果”时，Enter、搜索按钮、历史项和联想项提交后，原 Ember 页面清空输入、移除搜索框／按钮焦点并收起面板；后台历史变化不重新展开。先记录实际提交的搜索词，再重置输入；当前标签页搜索和空输入不走这项重置。默认引擎、直接引擎及默认引擎失败后的 Google 回退都共用此行为。

补充回归：89 个文件、671 项通过；ESLint 通过。Firefox 157.0 与 ESR 140.16.0 各 10 组检查通过，覆盖提交后清空／失焦、所有引擎的建议提交，以及实际打开新标签页再返回 Ember。测试夹具将结果导航替换为 `about:blank`，验证浏览器切换与返回，不请求实际结果服务。

证据：`.local/search-submit-reset-unit.log`、`.local/search-submit-reset/report.json`、`.local/search-submit-reset-esr/report.json`；提交后截图为对应目录中的 `search-submitted-cleared.png`。

## 本地候选包

`dist/ember-tab-0.1.1-firefox.zip`，115 个运行文件、545746 字节；SHA-256 为 `ffaca1f29339240df43a8137fc662abfa67fe57f3345b8ba1b135a05a5a47820`，同时保存在相邻 `.sha256` 文件。所有源码和测试改动保留在工作区，没有上传商店或发布新版本。

临时体验：在单独 Firefox 测试配置打开 `about:debugging#/runtime/this-firefox`，临时载入 `dist/firefox/manifest.json`。临时加载在浏览器重启后失效。正式长期安装与更新继续通过签名／商店渠道，不能把 ZIP 重命名当作签名安装。详细步骤见 [分发说明](DISTRIBUTION.md)。
