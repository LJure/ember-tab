# Mini4K 与 Lunaris 刷新图标修复

本页保留该轮实现、包哈希和验收记录。后续加入 HTTP 链接的 HTTPS 取图和候选选择，见 [候选图标记录](CHROME_ICON_CHOOSER.md)，当前包以 [验证记录](CHROME_SELF_USE_VALIDATION.md) 为准。

2026-10-03。用户确认千问和谷歌翻译正常后，报告 `https://www.mini4k.com/` 和 `https://lunaris.moe/` 手动刷新图标模糊。

## 复现与修正

隔离 Chrome 154.0.8037.93 中，两站均选到了 Vemetric 返回的 128×128 PNG。Mini4K 的页面与部分常见图标路径返回 403，favicon.ico 返回 404；Google 备用来源则返回可用的 48×48 PNG。Lunaris 的原站 favicon.ico 只有一个 32×32 帧，旧策略要求原站至少 64 像素，因而让备用 128 像素画布压过原图。此次 Chrome 内置 favicon 回退返回相同的默认 64 像素地球图。

保存的 Vemetric 图可见模糊；较大的画布不能证明它包含更多原始细节。此处依据实际返回图与来源选择定位，没有宣称已知第三方服务内部的具体缩放算法。

共享代码调整为：

1. 原站声明、manifest、apple-touch 或常见路径的 SVG／至少 32×32 图标优先；已有这种原图就不再取备用源。小于 32 像素的非矢量原图仍不进入主要候选，保留 YouTube 高清声明图的发现。
2. 需要备用源时，矢量图及实际至少 128 像素的 Chrome 图仍保留原有优先级；Google 返回至少 32×32 的可用图优先于 Vemetric 栅格图和小尺寸 Chrome 回退。Google 太小、失败或不可用时仍可回退。
3. 保留前两轮的大页面有限前段解析、网络限制、主题选择和已确认的 SVG 占位图过滤。缓存存原始字节，不增加放大或锐化处理。

这是一项来源规则修正，没有添加针对这两个域名的特判，也没有新增权限、数据库迁移或改变固定 ID。

| 地址 | 最新选择 | 解码尺寸 |
| --- | --- | --- |
| Mini4K | Google S2 备用来源 | 48×48 |
| Lunaris | 原站 favicon.ico | 32×32 |
| 千问 /chat | 原站浅色主题 PNG；深色变体另验 | 80×80 |
| 谷歌翻译 | 原站 gstatic favicon.ico | 64×64 |
| YouTube | 原站声明 PNG | 144×144 |

## 验证与边界

- 将四站缓存预置为此前错误的 Vemetric 图，在真实 Chrome 编辑窗口点击刷新；解码尺寸、来源及原图 SHA-256 与直接发现结果一致，页面重载后保留。
- 五站直接发现及千问深色主题通过；710 项单元测试、Chrome 15 项后台、Firefox M3 26 项、两版构建与 ESLint 通过。Firefox web-ext 0 错误、0 notices、52 个既有 warnings。
- 共享修复进入本地 Chrome／Firefox 开发包；本次实际四站刷新操作只在隔离 Chrome 验证，没有操作日常浏览器资料。
- 原图仅 32／48 像素时，Dock 放大或高 DPI 下仍受源图细节限制。当前可访问来源没有提供这两站的高清原图；不能承诺任意网站都能自动获得高清图标。
- 没有重跑完整迁移／升级矩阵，也没有发布 GitHub 或商店版本。

证据：`.local/site-icons/run-1791009110950/report.json`（修正前）、`.local/site-icons/run-1791009465528/report.json`（五站及刷新）、`.local/chrome-runtime/run-1791009437312/report.json`、`.local/icon-native-fix-firefox/firefox-smoke.json`。

安装更新见 [Chrome 自用说明](CHROME_SELF_USE.md)，当前运行哈希见 [验证记录](CHROME_SELF_USE_VALIDATION.md)。同版本本地更新后重新加载扩展，再分别刷新两个快捷链接的图标；永久缓存不会自动清空。

自用交付 ZIP：`dist/ember-tab-0.1.2-chrome-self-use.zip`，123 文件／564120 字节，SHA-256 `87c8ddccb9fd9cbbd9adb4a5b7db4a36353a2910b2ab4b3c13cff23be93ee4ca`。重复打包一致，119 个运行文件逐字节匹配普通 Chrome ZIP，122 条校验清单、许可、固定身份、HTTPS 权限及文档可携带链接检查通过；证据为 `.local/icon-native-fix-delivery-report.json`。
