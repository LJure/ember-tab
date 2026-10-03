# Chrome 自用版验证记录

记录日期：2026-10-03。交付版本 **0.1.3（含 HTTPS 取图修复和图标候选选择）**，固定 ID **ikjonccnpooflmknleniaiicpogiaieb**。0.1.2 自用版经用户测试后递增版本；图标功能代码保持相同。本记录适用于下列普通运行包；外层自用交付 ZIP 只增加说明、收据与校验清单，运行文件保持一致。

| 运行包 | 文件数 | 字节数 | SHA-256 |
| --- | --- | --- | --- |
| ember-tab-0.1.3-chrome.zip | 120 | 552731 | `589e9f3781d16b9c007156e1ca83a98bd4bbab0d4271e33f4e1d62393c68f991` |
| ember-tab-0.1.3-firefox.zip | 119 | 551888 | `c2faea140d97d70ef42967d1bd1d47410b4964fb179334377942c81a91be479d` |

## 已完成的检查

| 检查 | 结果和范围 |
| --- | --- |
| Chrome 第三步功能检查 | 40 项通过：后台唤醒、offscreen、图标、书签、Dock、设置、搜索、壁纸、照片、ZIP／WebDAV 等 |
| Chrome 最终固定 ID 后台检查 | 18 项通过；含大页面取图、实际分辨率、主题 media 和候选选择／保存／重载／恢复自动选择检查，最终普通运行包哈希与上表一致 |
| 实际站点与旧缓存刷新 | 0.1.2 自用包：腾讯新闻 HTTP 链接取得 HTTPS 原站 96×96，B站 HTTP 链接取得 HTTPS 原站 512×512；Mini4K 48×48、Lunaris 32×32、千问 80×80、谷歌翻译 64×64，六站实际编辑窗口刷新后重载保留。YouTube 为 144×144，深色千问及腾讯新闻／B站真实候选界面通过。0.1.3 取图功能代码相同，本轮重测受控图标与候选交互，没有重跑七站在线矩阵 |
| Chrome／Firefox 生命周期与迁移 | 第四步旧包 13 项通过：实际 Firefox 原生导出、Chrome 设置页恢复、重载、4 次独立 Chrome 进程、同目录更新、同 ID 更换路径、离线图片、手动回退、无 key 旧包过渡；本次图标修复后未重跑此矩阵 |
| Firefox 共享功能回归 | 0.1.3 在 Firefox 157.0、ESR 140.16.0 各 M3 29 项、UI 6 项、搜索 10 项通过；普通未注入包基础 10 项通过 |
| 单元测试 | 最新图标修复后 98 个文件、717 个测试通过，含取消／URL 和模式变化的异步失效、失败写入及晚返回自动请求防覆盖 |
| 构建检查 | Chrome 3 项、Firefox 1 项通过；重复构建一致，身份异常被拒绝，普通包排除测试 HTTP 权限 |
| Firefox web-ext 检查 | 图标修复后 0 错误、0 notices、52 个既有 warnings |

Chrome 154.0.8037.93、Firefox 157.0；隔离浏览器配置，不操作日常浏览器数据。第三步 40 项记录对应当时的包，之后调整过隐私文字、固定 ID 与图标发现逻辑；第四步完成了生命周期检查，0.1.2 完成实际七站图标检查，0.1.3 保留相同取图功能代码并重测后台、两版候选交互和 Firefox M3／UI／搜索，未把历史报告表述为当前哈希的全量重测。原图尺寸有限的站点不能保证高 DPI／Dock 放大时仍有高清细节；本次没有人为放大或锐化缓存图。

迁移使用在真实 Firefox 中创建的合成小数据集：链接、文件夹、Dock、设置，以及四个 IndexedDB store 的 4 条记录、6 个 Blob 字段。Firefox 现有导出器通过原生下载生成 ZIP，Chrome 通过实际设置页导入；图片按 ID、类型、大小和 SHA-256 比较。目的端搜索历史、搜索开关／来源与 WebDAV 凭据保持本机范围。第四步使用的 0.1.3 是隔离测试副本、当时交付 0.1.2；本轮正式递增为 0.1.3，没有重跑该生命周期矩阵。

第五步额外核对交付包与普通 ZIP 的全部运行文件、目录文件、许可、固定身份、HTTPS 权限、完整清单、文档链接及重复打包一致性；检查新增打包工具的代码规范。该步骤的操作结果与交付 ZIP 校验值记录在仓库 `docs/CHROME_MIGRATION.md`；每次新构建的收据见交付目录的 `RELEASE.json`。

## 验证边界

- 在线壁纸和搜索联想的自动化检查使用受控服务响应；不能据此保证所有外部服务当前均可用。实际 Chrome 搜索导航已验证，Google 页面曾返回 429／验证码。
- 保存选择器测试写入真实 OPFS 文件句柄并覆盖取消逻辑；未自动操作操作系统原生保存对话框。Blob 下载和实际 Firefox ZIP 下载已验证。
- 本轮未验收用户完整资料、大容量迁移、Chrome 最低版本、实际隐身模式、未上架扩展跨设备账号同步、新增权限升级或长期备份轮换。
- 正常手动恢复通过，不代表具备跨数据库全局自动回滚；Firefox 商店签名升级仍属于单独验收事项。

## 可复查的本地证据

以下为仓库内隔离测试路径，交付包不携带浏览器配置、原始备份、凭据或测试 HTTP 包：

- `.local/chrome-runtime/run-1790964711181/report.json`：第三步 40 项。
- `.local/chrome-runtime/run-1790997771933/report.json`：最终固定 ID 13 项后台检查。
- `.local/chrome-lifecycle/run-1790997713891/report.json`：13 项生命周期／迁移。
- `.local/chrome-step3-firefox/firefox-smoke.json`：Firefox M3。
- `.local/chrome-step3-firefox-search/report.json`：Firefox 搜索。
- `.local/chrome-runtime/run-1791007113273/report.json`：图标修复后的 14 项 Chrome 检查。
- `.local/youtube-icon/run-1791007354065/report.json`：实际 YouTube 与编辑窗口刷新旧缓存。
- `.local/youtube-icon-firefox/firefox-smoke.json`：图标修复后 Firefox M3。
- `.local/chrome-runtime/run-1791008316175/report.json`：上一轮 15 项 Chrome 运行检查。
- `.local/site-icons/run-1791008474564/report.json`：千问、谷歌翻译原站图选择和实际刷新；YouTube 与深色千问复查。
- `.local/icon-source-fix-firefox/firefox-smoke.json`：上一轮 Firefox M3。
- `.local/site-icons/run-1791009110950/report.json`：Mini4K／Lunaris 修正前结果。
- `.local/site-icons/run-1791009465528/report.json`：五站取图、四站实际刷新与重载、深色千问。
- `.local/chrome-runtime/run-1791009437312/report.json`：上一轮 15 项 Chrome 运行检查。
- `.local/icon-native-fix-firefox/firefox-smoke.json`：上一轮 Firefox M3。
- `.local/chrome-runtime/run-1791010906347/report.json`：0.1.2 的 18 项 Chrome 检查与候选布局截图。
- `.local/icon-chooser-firefox-final/firefox-smoke.json`：0.1.2 的 29 项 Firefox M3。
- `.local/site-icons/run-1791011101793/report.json`：0.1.2 七站、六站刷新和腾讯新闻／B站候选界面。
- `.local/icon-chooser-vitest-final.log`：717 项单元测试。
- `.local/chrome-runtime/run-1791012174611/report.json`：0.1.3 的 18 项 Chrome 检查。
- `.local/third-update-m3-stable/firefox-smoke.json`、`.local/third-update-m3-esr/firefox-smoke.json`：0.1.3 两版 Firefox M3。
- `.local/third-update-vitest.log`：0.1.3 的 717 项单元测试。

维护者复查命令：

```powershell
npm run test:chrome-build
npm run test:firefox-build
npm run lint
npm run test:chrome:runtime
npm run test:chrome:features
npm run test:chrome:lifecycle
```

浏览器测试依赖本机浏览器和匹配驱动；安装包本身无需 Node.js、驱动或测试材料。源码更改后应按影响范围重新验收，旧记录不自动适用于新包。
