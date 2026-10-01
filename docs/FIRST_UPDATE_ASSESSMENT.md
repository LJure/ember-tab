# Ember Tab 首次更新：图标修复与搜索功能评估

日期：2026-10-01。本文保留实施前的图标修复记录、接口评估与用户确定的规则。搜索功能现已在 0.1.1 本地候选中实现，当前实现与验收见 [首次更新实现记录](FIRST_UPDATE_IMPLEMENTATION.md)。没有提交新的 AMO 版本。

## 图标修复

M5 提交 `34da2fa` 将上游相册花瓣／设置齿轮 JPEG 改成原创几何图标，并非 Firefox 渲染、用户设置或缓存故障。此次按截图二恢复 `assets/icons/photo.jpg` 和 `assets/icons/setting.jpg`，字节取自上游基线 `a706cee56e43b80777de697dd4462083b1f97ef8`。保留路径，因此已有 Dock／启动台与导入数据继续使用同一入口。

`tools/render-brand.mjs` 不再覆盖这两个图标。产品火焰图标和原创默认壁纸继续由该工具生成。两个恢复图标的独立外部来源／再分发授权仍未确证，第三方声明已区分上游资源与 Ember 原创素材；恢复不作为独立授权结论。

图标修复阶段沿用 0.1.0 开发基线；以下预览包和验收仅记录该阶段。随后搜索功能统一进入 0.1.1 本地候选及变更记录，均不代表新版本上架。

验证结果：现有构建测试通过，重复构建哈希一致；web-ext 0 errors／52 warnings，警告计数与首版记录一致。Firefox 157.0 隔离临时配置确认启动台两图标正常加载、Dock 相册／设置入口可点击。源文件及 ZIP 内 JPEG 均逐字节等于上游原版。实机截图与报告位于 `.local/first-update-icons/`。本轮仅验证图片和入口，没有重复全部历史功能验收。

未签名修复预览：`dist/ember-tab-first-update-icons-preview.zip`，内部版本仍为 0.1.0，只供临时加载检查。SHA-256：`e0d5ec7d2d5ffc2948c5d8e9dc2552390a3a7e8ead9bc01192e2d75205bf0f93`。没有发布／提交商店新版本。

## 搜索历史：可行，工作量较小

只记录用户在 Ember 搜索框实际提交的非空搜索词，包含点击历史／联想项后的提交。不记录每次键入，不读取 Firefox 浏览历史，不增加 `history` 权限。

建议规则：

- 独立“保存搜索历史”开关，默认关闭，放在设置的搜索分组；提供“清空搜索历史”。关闭后停止记录和展示，旧记录保留直到明确清空。
- 独立 local 键 `emberSearchHistory`，不写入 sync。后台串行处理增删，避免多个新标签页写入时覆盖已删除项。开关也建议本地保存，避免其他设备同步开启；无痕窗口不读写历史。
- 最多 100 项，相同搜索词去重并置顶。聚焦空输入框显示最近 8 项，输入后显示匹配项。鼠标悬停或键盘聚焦某行时出现删除按钮，删除不触发搜索；点击文本按当前搜索引擎搜索。
- 下拉面板复用搜索框玻璃背景、圆角与主题，支持方向键、Enter、Escape、鼠标及可访问的删除按钮。

**必须修改备份边界。** `backup-manager.js` 的 `_appendBackupDataToZipper` 当前读取全部 local 数据，只排除 `webdavConfig`；仅用 local 存储不能满足“不包括在迁移、备份中”。需在共用 ZIP 输出入口排除历史键，覆盖本地下载、内存导出和 WebDAV 上传。恢复时丢弃备份中的历史字段，并保留当前浏览器自身历史，阻止旧／外部备份重新导入历史。快捷链接专用导出也需验证。开关是否随配置备份可另行决定，历史内容始终排除。

“仅在浏览器中”指 Ember 不上传、不同步且不把历史放入自身备份。操作系统／浏览器整个配置目录的外部备份不受扩展控制；卸载通常会清除 local 数据。[Mozilla storage.local](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/local)

验收：提交时记录、去重上限、删除／清空、多标签并发、无痕、关闭后不读写、全部备份路径排除、恢复后本机历史不被覆盖。

## 实时联想：可行，工作量中等，需要服务适配

Firefox `search` API 只有引擎枚举与搜索提交，`search.get()` 返回名称、默认标记、别名和图标，不暴露联想 URL。因此无法通用调用任意已安装引擎的原生联想，需要维护服务适配器。[Mozilla search](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/search)、[search.get](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/search/get)

| 模式 | 可行性与行为 |
| --- | --- |
| 跟随当前引擎 | 搜索框选择 Google、Bing、百度、DuckDuckGo、Yahoo、Yandex、Brave、Naver 时，联想跟随插件所选引擎。 |
| 独立来源 | 搜索框选择浏览器默认、搜狗、Ecosia 时，使用共用的“联想词来源”设置，选项为 Bing、Google、百度、DuckDuckGo、Brave。点击联想仍交给搜索框当前引擎。 |

2026-10-01 使用公开测试词 `steam` 探测以下 HTTPS 端点，两者返回 JSON 查询与建议列表，Bing 包含中文建议：

- `https://api.bing.com/osjson.aspx?query=steam`
- `https://suggestqueries.google.com/complete/search?client=firefox&q=steam`

这仅证明当时测试环境可访问，不等同于第三方使用授权、长期稳定、所有地区可用或 Firefox 扩展端到端验收。不包装成有 SLA 的正式开放 API。微软原 Bing Search APIs 已于 2025-08-11 退役，不能按旧商业 API 文档设计接入。[Microsoft 公告](https://learn.microsoft.com/en-us/lifecycle/announcements/bing-search-api-retirement)

建议实现：

- 独立“实时搜索联想”开关，默认关闭、本地保存。开启时解释“输入中的文字会发送给所选联想服务”，检查 Firefox `searchTerms` 数据传输许可。现有 manifest 已声明该类别和任意 HTTPS 主机，仍需更新隐私说明、核对同意／撤销行为和商店信息。[Mozilla 扩展政策](https://extensionworkshop.com/documentation/publish/add-on-policies/)
- 250–300ms 防抖，中文输入法在 `compositionend` 后查询。为空、失焦、关闭、切换引擎／来源时取消旧请求。
- `AbortController` 加请求序号防止旧响应覆盖新输入，约 3 秒超时、最多 8 条、会话内短期缓存。断网、429、超时或格式异常时保留本地历史和普通搜索。
- `fetch` 获取 JSON，`credentials: 'omit'`，固定 HTTPS 主机、拒绝重定向，不注入 JSONP／远端脚本。限制响应长度、校验字符串类型，用 `textContent` 渲染。
- 历史和建议共用面板，标识来源、去重，只有历史行可删除。两开关互相独立，无痕窗口默认禁用在线联想。

验收：两来源模式、中文输入、乱序响应、切换引擎、断网／超时／429、关闭后零联想请求、页面销毁清理、稳定版／ESR 实机验证。

截图三／四的翻译入口不在此次请求范围。第一轮实现范围以文末用户确定的设置规则为准。

## 补充探测与最终设置规则

跟随的是 **Ember 搜索框当前选择的引擎**。按用户最终要求，浏览器默认、搜狗和 Ecosia 使用独立来源，选项保留 Bing、Google、百度、DuckDuckGo、Brave 五个，去掉搜狗。这项规则已按下文实现。

2026-10-01 在 Firefox 157.0 隔离临时扩展中，用 `steam`、`credentials: 'omit'` 和拒绝重定向探测：

| 当前插件引擎 | 探测结果 |
| --- | --- |
| Bing / Google / DuckDuckGo / Brave | HTTPS 候选端点直接返回 JSON 建议，分别取得 12 / 10 / 8 / 8 条 |
| Baidu | OpenSearch 候选端点取得 10 条；响应为 GBK，使用 GB18030 解码后中文正常 |
| Yahoo / Yandex / Naver | 各取得 10 条，需要各自解析响应结构 |
| Sogou | 桌面候选端点 HTTP 200 但空响应。`https://sor.html5.qq.com/api/getsug?key=steam` 取得 10 条搜狗格式建议；该移动候选端点为 GBK 和 `window.sogou.sug(...)` 包装。已验证按数据提取 JSON、用 GB18030 解码可显示中文，未执行服务端脚本。来源与持续支持范围仍需进一步核对，不记为正式开放 API 授权。 |
| Ecosia | 当前候选端点在系统请求中 403，在扩展请求中 404；本次未打通，不能据此断言服务本身没有联想功能 |
| 浏览器默认 | 不保证获得实际默认引擎的联想 URL；采用用户选定的固定来源即可，无需识别默认引擎 |

探测证据：`.local/search-suggestions-probe.json`、`.local/search-suggestions-firefox.json`、`.local/search-suggestions-encoding.json`。首份系统探测中搜狗空响应的 `validJson: true` 为探测脚本判定缺陷，后续脚本已修正；以非空、成功解析的联想列表和 Firefox 结果为依据。

Brave 此次使用网页候选端点 `https://search.brave.com/api/suggest?q=steam`，未要求密钥。Brave 官方开发者 Autosuggest API 是另一个服务，要求 `X-Subscription-Token`；两者不能混淆。[Brave 官方文档](https://api-dashboard.search.brave.com/api-reference/other/suggestions)

用户最终确定的设置行为（取代上文初步候选范围）：

- 独立“联想词来源”选项只提供 **Bing、Google、百度、DuckDuckGo、Brave**，去掉搜狗；同一个选择供下面三种搜索模式共用，不为每种模式各建一份设置。
- 搜索框选择 **浏览器默认、搜狗或 Ecosia**：联想词使用独立“联想词来源”中选定的服务。搜狗和 Ecosia 不接入自身联想端点；以上探测结果仅保留为评估证据。
- 搜索框选择 **Google、Bing、百度、DuckDuckGo、Yahoo、Yandex、Brave 或 Naver**：联想跟随插件搜索框当前选择的引擎。
- 联想结果仅用于补全输入；Enter／点击建议仍交给搜索框当前选择的搜索引擎。浏览器默认继续使用 `chrome.search.query()`；搜狗、Ecosia 使用各自搜索 URL。固定联想来源不会改变搜索目标。
- 切换搜索引擎不重置独立来源选择；切回浏览器默认、搜狗或 Ecosia 时继续使用之前的来源。设置说明明确该选项适用于这三种搜索模式，其他引擎的联想跟随搜索框所选引擎。
- 只向当前生效的一个联想服务发送请求。选择来源不会自动开启实时联想；失败时保留普通搜索和已开启的本地历史，不自动把输入转发给另一家服务。

独立来源固定为五项；跟随引擎的适配覆盖上述八个已取得建议的具名引擎。以上保留为公开测试词的接口探测证据；随后实施的功能验收见 [实现记录](FIRST_UPDATE_IMPLEMENTATION.md)。
