# 千问和谷歌翻译图标刷新回归修复

本页记录该轮修复和当时包的哈希。后续 Mini4K／Lunaris 修复将原站优先阈值扩展到 32 像素，并调整备用源排序；最新实现见 [小尺寸图标记录](CHROME_ICON_NATIVE_FIX.md)，当前包见 [交付验证记录](CHROME_SELF_USE_VALIDATION.md)。

2026-10-03。用户确认 YouTube 恢复正常，但手动刷新 `https://www.qianwen.com/chat` 和 `https://translate.google.com/` 后图标模糊。仍为本地自用版本 0.1.2，Chrome 固定 ID 不变。

## 原因与实际取图结果

上一轮 YouTube 修复把“128×128 或 SVG”置于来源优先级之前；它能避免小尺寸 Chrome 回退图挡住高清结果，却错误地让备用服务的大画布压过可用的原站图。图片尺寸不能证明原始图案包含更多细节。Google 翻译在本次观察中由原站 64×64 ICO 切换成 Vemetric 的较模糊 128×128 PNG。

千问还存在两个因素：Vemetric 在本次请求中返回了带 `icon-tabler-world-question` 标识的 24×24 默认地球 SVG，被误当作矢量站点图标；千问原站同时声明了浅色主题彩色图标和深色主题白色图标，旧解析器忽略 `media`，可能因为文件较小而选中白色版本。

本次证据来自独立 Chrome 154.0.8037.93，不读取日常浏览器的实际缓存。服务返回可能随网络和时间变化：初轮千问首页的一次 Vemetric 请求超时；用户提供的 `/chat` 路径则实际取得上述默认 SVG。

| 用户地址 | 修正后的来源 | 实际解码尺寸 |
| --- | --- | --- |
| `https://www.qianwen.com/chat` | 当前浅色主题对应的彩色原站 PNG；深色主题另验证白色变体 | 80×80 |
| `https://translate.google.com/` | `www.gstatic.com/translate/favicon.ico` | 64×64 |
| `https://www.youtube.com/` | 原站声明的 `favicon_144x144.png` | 144×144 |

## 修正策略

1. 原站 HTML、manifest、apple-touch 和常见根路径提供的 SVG 或至少 64×64 图标优先；同一来源质量层级内再比较实际尺寸和既有来源分数。
2. 已有可用原站图时不向备用服务寻找“大一号”画布，避免被重采样或不同外观的图标覆盖。原站缺失或太小仍可使用现有回退服务。
3. 剔除本次确认的 Vemetric 默认地球 SVG；不是把所有服务 SVG 都拒绝，也没有引入未验证的图片锐度评分。
4. 对明确的 `(prefers-color-scheme: light/dark)` favicon media，匹配 Ember 当前 `uiTheme`；不再混合两个主题的候选。其他复杂 CSS media 条件未在本次新增支持。
5. 保留 YouTube 修复的 512 KiB 网页前段解析、超时和图片／manifest 完整性限制。缓存保持原图，不人为放大图像。

主题选择发生在发现／手动刷新时，既有永久缓存不会因改主题或安装此包而批量清空。主题变更后如需使用站点另一变体，可手动刷新该图标。本次不更改自定义图标、缓存数据库版本或 Chrome 身份。

## 验证

- 全量单元测试：96 文件／705 项通过。新增原站 64／80 像素优先、备用 SVG 占位图、浅色／深色 favicon 回归。
- Chrome 15 项后台／图标运行检查通过，新增实际设置切换后的 favicon media 选择。
- 实际 Chrome 编辑窗口：把千问缓存预先写成上一轮错误 SVG，把谷歌翻译缓存写成备用 128×128 PNG；分别点击“刷新图标缓存”。新记录均为上述原站图，解码尺寸和原图 SHA-256 匹配，页面重载后保留。
- 同一隔离浏览器再次检查真实 YouTube，仍取得 144×144；千问深色主题单独确认取到白色 80×80 变体。
- Firefox 157.0 M3 26 项通过；共享修复进入两版开发包。Chrome／Firefox 构建 3／1 项、ESLint 和差异空白检查通过。web-ext 为 0 错误、0 notices、52 个既有 warnings。
- 未重跑第四步完整数据迁移／更新生命周期矩阵，也未宣称所有网站或所有 CSS media 已全部验收。

本地证据：`.local/site-icons/run-1791007890500/report.json`、`run-1791007911367/report.json` 为修正前结果；`.local/site-icons/run-1791008474564/report.json` 为原站选择与实际刷新验证。运行回归为 `.local/chrome-runtime/run-1791008316175/report.json` 与 `.local/icon-source-fix-firefox/firefox-smoke.json`。

当前运行包：Chrome 119 文件／547646 字节，SHA-256 `2b00a8e274a8f05275c4aefcbafedd318fb92a4e2a5ac29dae6724dd03bb9729`；Firefox 118 文件／546798 字节，SHA-256 `6164bc6b3851bc749cc36ae29198bc429a2a74af63d6da6bb4a735755c334064`。安装新包后重新加载扩展，再在两个链接的编辑窗口刷新图标。安装更新见 [Chrome 自用说明](CHROME_SELF_USE.md)。

最新自用 ZIP 为 `dist/ember-tab-0.1.2-chrome-self-use.zip`，123 文件／563560 字节，SHA-256 `2ba4d4990b183696da7827c5f5aaddb8a18bacf873be06f11367776e4061871b`。重复打包结果一致；普通 ZIP 与交付目录逐文件相同，122 条文件校验及可携带文档链接通过。结果为 `.local/icon-source-fix-delivery-report.json`。
