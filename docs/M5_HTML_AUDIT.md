# M5 动态 HTML 警告逐项复核

2026-09-27。以下按实际产物 web-ext 报告逐条记录，未通过关闭规则掩盖告警。保留 innerHTML 的判定依赖所列输入边界；若将来引入远端翻译或开放 schema，必须重新审计。此记录不是 AMO 通过证明。

额外修复：关于／变更记录转义、链接管理 data-id 转义、壁纸署名链接 HTTPS 校验、Unsplash 密钥发送目标校验。

| # | 文件:行（本轮构建） | 输入来源与防护判定 |
| --- | --- | --- |
| 1 | `scripts/shared/confirm-dialog.js:57` | 标题、正文和按钮文字经过 escapeHtml；modalId 为递增数字，样式从固定枚举选择。 |
| 2 | `scripts/shared/toast.js:129` | 只从本地 TOAST_ICONS 常量取 SVG；消息与操作文字使用 textContent。 |
| 3 | `scripts/domains/bookmarks/export-ui.js:119` | 内置翻译与固定 ICONS；统计来自数组长度／导出计数，不拼接导出内容。 |
| 4 | `scripts/domains/bookmarks/export-ui.js:165` | 内置翻译与固定 ICONS；统计来自数组长度／导出计数，不拼接导出内容。 |
| 5 | `scripts/domains/bookmarks/export-ui.js:173` | 内置翻译与固定 ICONS；统计来自数组长度／导出计数，不拼接导出内容。 |
| 6 | `scripts/domains/bookmarks/export-ui.js:190` | 内置翻译与固定 ICONS；统计来自数组长度／导出计数，不拼接导出内容。 |
| 7 | `scripts/domains/bookmarks/export-ui.js:222` | 内置翻译与固定 ICONS；统计来自数组长度／导出计数，不拼接导出内容。 |
| 8 | `scripts/domains/bookmarks/ui.js:148` | 内置翻译与 ICONS；统计为计数；外部文件夹名与错误消息经过 escapeHtml，预览不插入书签 URL／标题。 |
| 9 | `scripts/domains/bookmarks/ui.js:190` | 内置翻译与 ICONS；统计为计数；外部文件夹名与错误消息经过 escapeHtml，预览不插入书签 URL／标题。 |
| 10 | `scripts/domains/bookmarks/ui.js:204` | 内置翻译与 ICONS；统计为计数；外部文件夹名与错误消息经过 escapeHtml，预览不插入书签 URL／标题。 |
| 11 | `scripts/domains/bookmarks/ui.js:226` | 内置翻译与 ICONS；统计为计数；外部文件夹名与错误消息经过 escapeHtml，预览不插入书签 URL／标题。 |
| 12 | `scripts/domains/bookmarks/ui.js:266` | 内置翻译与 ICONS；统计为计数；外部文件夹名与错误消息经过 escapeHtml，预览不插入书签 URL／标题。 |
| 13 | `scripts/domains/bookmarks/ui.js:294` | 内置翻译与 ICONS；统计为计数；外部文件夹名与错误消息经过 escapeHtml，预览不插入书签 URL／标题。 |
| 14 | `scripts/domains/bookmarks/ui.js:325` | 内置翻译与 ICONS；统计为计数；外部文件夹名与错误消息经过 escapeHtml，预览不插入书签 URL／标题。 |
| 15 | `scripts/domains/bookmarks/ui.js:345` | 内置翻译与 ICONS；统计为计数；外部文件夹名与错误消息经过 escapeHtml，预览不插入书签 URL／标题。 |
| 16 | `scripts/domains/bookmarks/ui.js:360` | 内置翻译与 ICONS；统计为计数；外部文件夹名与错误消息经过 escapeHtml，预览不插入书签 URL／标题。 |
| 17 | `scripts/domains/bookmarks/ui.js:385` | 内置翻译与 ICONS；统计为计数；外部文件夹名与错误消息经过 escapeHtml，预览不插入书签 URL／标题。 |
| 18 | `scripts/domains/bookmarks/ui.js:394` | 内置翻译与 ICONS；统计为计数；外部文件夹名与错误消息经过 escapeHtml，预览不插入书签 URL／标题。 |
| 19 | `scripts/domains/bookmarks/ui.js:408` | 内置翻译与 ICONS；统计为计数；外部文件夹名与错误消息经过 escapeHtml，预览不插入书签 URL／标题。 |
| 20 | `scripts/domains/bookmarks/ui.js:416` | 内置翻译与 ICONS；统计为计数；外部文件夹名与错误消息经过 escapeHtml，预览不插入书签 URL／标题。 |
| 21 | `scripts/domains/bookmarks/ui.js:462` | 内置翻译与 ICONS；统计为计数；外部文件夹名与错误消息经过 escapeHtml，预览不插入书签 URL／标题。 |
| 22 | `scripts/domains/changelog/view.js:79` | 随包翻译和版本；本轮版本经 escapeHtml，条目 textContent；不加载远程 HTML。 |
| 23 | `scripts/domains/changelog/view.js:125` | 随包翻译和版本；本轮版本经 escapeHtml，条目 textContent；不加载远程 HTML。 |
| 24 | `scripts/domains/photos/immersive-viewer.js:858` | 图标来自 ICONS，恢复 prevHtml 仅恢复同一按钮此前的内置图标；作者等数据使用 DOM 属性／textContent。 |
| 25 | `scripts/domains/photos/immersive-viewer.js:867` | 图标来自 ICONS，恢复 prevHtml 仅恢复同一按钮此前的内置图标；作者等数据使用 DOM 属性／textContent。 |
| 26 | `scripts/domains/photos/immersive-viewer.js:924` | 图标来自 ICONS，恢复 prevHtml 仅恢复同一按钮此前的内置图标；作者等数据使用 DOM 属性／textContent。 |
| 27 | `scripts/domains/photos/immersive-viewer.js:938` | 图标来自 ICONS，恢复 prevHtml 仅恢复同一按钮此前的内置图标；作者等数据使用 DOM 属性／textContent。 |
| 28 | `scripts/domains/quicklinks/context-menu.js:294` | _buildMenuInnerHtml 只组合固定动作、内置翻译与固定 SVG；链接数据仅选择菜单状态。 |
| 29 | `scripts/domains/quicklinks/link-manager.js:104` | 标题／URL 高亮逐段转义，URL 和图标数据属性经 escapeHtml；本轮为 data-id 补转义。空态为内置文案。 |
| 30 | `scripts/domains/quicklinks/link-manager.js:213` | 标题／URL 高亮逐段转义，URL 和图标数据属性经 escapeHtml；本轮为 data-id 补转义。空态为内置文案。 |
| 31 | `scripts/domains/quicklinks/link-manager.js:231` | 标题／URL 高亮逐段转义，URL 和图标数据属性经 escapeHtml；本轮为 data-id 补转义。空态为内置文案。 |
| 32 | `scripts/domains/quicklinks/launchpad-search.js:114` | _highlightText 将原始文本与匹配片段逐段 escapeHtml，仅插入固定 mark 标签。 |
| 33 | `scripts/domains/quicklinks/launchpad-search.js:146` | _highlightText 将原始文本与匹配片段逐段 escapeHtml，仅插入固定 mark 标签。 |
| 34 | `scripts/domains/quicklinks/launchpad-search.js:312` | _highlightText 将原始文本与匹配片段逐段 escapeHtml，仅插入固定 mark 标签。 |
| 35 | `scripts/domains/settings/builder.js:70` | schema 来自随包注册器，普通 label／value／属性经 esc；html/controlHtml/descHtml 为内部可信模板接口，禁止接入备份或网络原文。 |
| 36 | `scripts/domains/settings/content-core.js:173` | 关于名称／新增署名转义；版本来自 manifest；变更 JSON 随包，本轮条目及版本补 escapeHtml。 |
| 37 | `scripts/domains/settings/content-core.js:440` | 关于名称／新增署名转义；版本来自 manifest；变更 JSON 随包，本轮条目及版本补 escapeHtml。 |
| 38 | `scripts/domains/settings/content-appearance.js:73` | 模板动态项仅为固定 API 文档链接；用户 key 和存储数据经控件 value 设置。 |
| 39 | `scripts/domains/settings/window.js:148` | 菜单、图标与翻译来自本模块固定清单；占位 menuKey 为内部枚举，不接收远程 HTML。 |
| 40 | `scripts/domains/settings/window.js:263` | 菜单、图标与翻译来自本模块固定清单；占位 menuKey 为内部枚举，不接收远程 HTML。 |
| 41 | `scripts/domains/settings/window.js:281` | 菜单、图标与翻译来自本模块固定清单；占位 menuKey 为内部枚举，不接收远程 HTML。 |
| 42 | `scripts/domains/settings/content-data.js:164` | 状态为内置翻译；远端 WebDAV 文件名／数据属性经 escapeHtml，日期／尺寸经 Date/数字格式化。 |
| 43 | `scripts/domains/settings/content-data.js:518` | 状态为内置翻译；远端 WebDAV 文件名／数据属性经 escapeHtml，日期／尺寸经 Date/数字格式化。 |
| 44 | `scripts/domains/settings/content-data.js:539` | 状态为内置翻译；远端 WebDAV 文件名／数据属性经 escapeHtml，日期／尺寸经 Date/数字格式化。 |
| 45 | `scripts/domains/settings/content-data.js:548` | 状态为内置翻译；远端 WebDAV 文件名／数据属性经 escapeHtml，日期／尺寸经 Date/数字格式化。 |
| 46 | `scripts/domains/settings/content-data.js:567` | 状态为内置翻译；远端 WebDAV 文件名／数据属性经 escapeHtml，日期／尺寸经 Date/数字格式化。 |
| 47 | `scripts/domains/photos/window.js:468` | 窗口模板为本地文案／固定类别；各动态图标均从 ICONS 或 _getEmptyStateIcon 固定枚举选择。 |
| 48 | `scripts/domains/photos/window.js:860` | 窗口模板为本地文案／固定类别；各动态图标均从 ICONS 或 _getEmptyStateIcon 固定枚举选择。 |
| 49 | `scripts/domains/photos/window.js:1115` | 窗口模板为本地文案／固定类别；各动态图标均从 ICONS 或 _getEmptyStateIcon 固定枚举选择。 |
| 50 | `scripts/domains/photos/window.js:1230` | 窗口模板为本地文案／固定类别；各动态图标均从 ICONS 或 _getEmptyStateIcon 固定枚举选择。 |
| 51 | `scripts/domains/photos/window.js:1236` | 窗口模板为本地文案／固定类别；各动态图标均从 ICONS 或 _getEmptyStateIcon 固定枚举选择。 |

共 51 项，当前保留为有输入边界依据的模板警告，未认定为 51 个安全漏洞。另有 1 项 Android 最低版本告警：本项目未声明 gecko_android，仅分发桌面版；不为消除此提示而虚假声明 Android 支持。参考 [MDN 桌面／Android 声明](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)。
