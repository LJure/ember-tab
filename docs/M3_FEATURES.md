# M3：主要功能适配与验收

日期：2026-09-27。分支：`feat/m3-core-features`；起点：M2 `cdf624f`。上游仍为 Aura Tab 3.5.3 / `a706cee56e43b80777de697dd4462083b1f97ef8`，保留 nil-byte 的 MIT 版权和既有数据格式。

## 实现

- 图标 DOM 解析和图片解码抽到 `scripts/platform/favicon-dom.js`。Firefox 构建使用事件页直接调用；根目录 Chromium 构建继续使用离屏文档适配器。未将所有 `chrome.*` 调用机械替换。
- Firefox 不再生成 Chrome `/_favicon/` 地址；Chrome 图标端点及照片内置资源使用本扩展的实际协议、主机和精确路径校验。照片窗口允许本扩展的 `moz-extension:` 资源，拒绝其他扩展资源。
- 网站图标支持页面声明、重定向、HTML base、manifest、SVG 和常规 favicon；限制页面候选数量和 manifest 请求数量。IP、单标签主机和本地域名不再发送给公网图标回退服务；公网域名的第三方回退仍需 M5 隐私审查。
- 图标请求限制 512 KiB，3 秒网络时限覆盖响应体读取，流式读取达到上限即中止；图片解码和前端逐项回退也有时限。手动图标需成功解码才返回，避免缓存损坏数据。
- Firefox 书签显式忽略 `type: separator`，并对一次导入中的跨目录重复 URL 去重；重复记录与已有快捷链接的集合分开，避免预览错误排除本次新增项目。保留嵌套目录的上游展平方式及 500 项导入上限。
- 快捷链接资源协议识别补充 `moz-extension:`；不改变存储键、IndexedDB 或备份结构。

## 验证环境与结果

Windows，Firefox 156.0.1，Node 24.14.1，npm 11.11.0，geckodriver 0.36.0。浏览器验证使用 Selenium 创建的独立临时配置和 headless 模式，不读取日常浏览器配置。合成壁纸、书签与本地 HTTP 图标服务均由测试脚本生成。

| 检查 | 结果与证据范围 |
| --- | --- |
| 完整 Vitest | 78 个文件、589 项通过；新增 11 项平台、书签和图标限制回归 |
| ESLint | 0 错误、0 警告 |
| Firefox 构建回归 | 1 项通过；重复构建字节一致、保留许可、原 manifest 不变、生成 Firefox DOM 适配器 |
| Firefox 实机脚本 | 26 项通过：M2 的 10 项复核，加 M3 的 16 项功能检查 |
| web-ext | 0 错误、0 notices、55 警告；不支持 API 的警告由 2 降到 0 |

M3 实机检查覆盖：

1. 站点声明 SVG、base 地址、重定向和 manifest 图标；解析的脚本及图片子资源未执行／加载。
2. 常规 favicon、无图标、损坏图片；超大响应和发出响应头后停滞的请求能终止。
3. 手动图标 Blob 缓存可读、可解码，重复读取不新增网络请求。
4. Firefox 工具栏、菜单、其他书签根目录及嵌套、空目录、分隔符、重复项；合成 4 条书签去重后实际导入 3 条。500 项上限另由真实导入器单测验证。
5. 界面新增自定义图标快捷链接并固定到 Dock；真实存储中编辑、删除、文件夹创建／解散／重命名／子项排序及 26 条批量分页。Dock 鼠标拖拽后读回排序；启动台搜索和 Escape 关闭。
6. 上传 1200×800 PNG，本地图片选中状态、Blob 解码、cover 裁剪显示及刷新恢复；纯色背景与三个需要密钥的在线来源缺少密钥时回退本地图片。
7. 照片缩略图、窗口展开与拖动、沉浸预览图片解码、Escape 退出；离线刷新本地壁纸；800×700 和 1920×1080 窗口下主要入口可见且无横向溢出。
8. 简体／繁体／英文设置切换，Ctrl+K 搜索、Ctrl+. 启动台和 80%／125% 浏览器缩放。
9. 默认搜索用仅存在于测试配置的本地搜索引擎，真实调用 Firefox `search.query`；内置 Bing 经界面选择，允许其地区重定向。两者均验证中文、`& +?`、当前页／新页及标签数量。

“自定义搜索”在此指上游已有的引擎选择器；项目目前没有任意 URL 模板编辑器。窗口展开／沉浸预览属于扩展内显示模式，未把它称为浏览器 F11 全屏测试。

### 壁纸范围与在线服务

可选的 Bing 公网检查已通过：在已稳定加载的 Firefox 新标签页选择 Bing 来源并点击刷新，读回壁纸 `bing-20260926-zh-cn`，图片成功解码为 1366×768，最后恢复本地壁纸。该结果单独记录在 `firefox-smoke.json` 的 `liveBing`，不计入固定的 26 项检查。首次把检查安排在刚新建的标签页时超时；移到已经完成加载的页面后通过，未据此修改产品逻辑。新标签页刚启动时立即刷新在线来源的时序，在 M4 生命周期检查中继续覆盖。

Unsplash、Pixabay、Pexels 没有使用真实账户密钥；已验证缺失密钥后的回退及现有适配器单测，不宣称鉴权、配额、真实下载和长期缓存均通过。定时机制复核了 alarm 创建、休眠唤醒和刷新广播；时间策略另由单测覆盖，没有等待真实的一小时或跨自然日。上游本地图片是“选定图片优先，否则随机选取”，后台明确跳过本地图片定时刷新，本次不新增本地相册自动轮播。

智能裁剪算法沿用上游，现有相关测试通过；Firefox 实测确认裁剪后的显示、尺寸和恢复，没有以单张合成图片证明所有照片的取景效果。

## 复现与产物

```powershell
npm ci
npm test
npm run lint
npm run test:firefox-build
npm run lint:firefox
$env:FIREFOX_BINARY = 'D:\Firefox\firefox.exe'
npm run test:firefox:m3
# 可选：访问 Bing 公网壁纸服务，结果单独记录，不能用离线通过替代
npm run test:firefox:m3 -- --live-bing
```

运行 `test:firefox-build` 会构建两次并校验产物，也可单独运行 `npm run build:firefox`。随后在独立 Firefox 配置的 `about:debugging#/runtime/this-firefox` 临时载入 `dist/firefox/manifest.json`。不要载入根目录的 Chrome manifest。

开发包仍为 0.1.0，99 个文件，4,427,862 字节。未签名，浏览器退出后临时安装会移除。SHA-256：

```text
8e858825797dc1fefbb468bb83d07820ecdb236c46002f2fc0a588a6dcf5e0cb
```

本地证据位于忽略的 `.local/m3/`：`vitest.json`、`test.log`、`eslint.json`、`build-test.log`、`web-ext-lint.json`、`firefox-smoke.json`、`geckodriver.log`、`smoke.log`、`photos.png`、`m3-ui.png`。浏览器报告含包校验值与版本。`failure.png` 若存在，是开发过程中前一次失败的快照，以最终 JSON 的状态为准。

测试脚本会删除并生成临时配置的书签，建立临时搜索引擎、切换测试实例的离线状态，最后关闭浏览器；不得改为连接日常配置运行。脚本依赖 Firefox 内部测试入口，其中搜索服务导入路径针对本次 156 版本验证；将来 ESR 的测试适配与生产扩展 API 兼容应分开判断。

## 保留的限制与后续门槛

- **M4**：完整浏览器重启、升级、并发写入、备份往返、真正跨设备 Firefox Sync 和 WebDAV。M2 记录的页面销毁与壁纸写入交叠问题继续跟踪。
- **M5**：55 个 web-ext 警告为 3 个图标尺寸、1 个数据声明、51 个 HTML 动态赋值审查项。没有将检查无错误当成 AMO 审核通过；第三方图标服务、网络权限、HTTP 与 CSP 的取舍、素材许可和独立品牌仍待完成。
- 本地 HTTP 图标样本可经后台获取后转为 Blob；直接 `<img>` 回退中的 HTTP 地址会被现有 `img-src` CSP 拦截，记录在实机日志。未放宽 CSP，失败后用文字图标回退。正式分发策略由 M5 统一处理。
- **M6**：Firefox ESR、其他桌面系统、签名安装包和长期在线壁纸／配额矩阵。当前只声明 Windows / Firefox 156.0.1 的上述范围。
- **Chromium 对照**：本轮未运行 Chromium 实机；保留原 manifest、离屏适配路径，并通过共同回归与 Chrome URL 分支测试，不宣称两个浏览器都已实机通过。

## API 参考

- [Mozilla BookmarkTreeNode](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/bookmarks/BookmarkTreeNode)：书签、文件夹和分隔符节点。
- [Mozilla search.query](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/search/query)：默认搜索引擎和标签页打开方式。
- [Firefox SearchService 源码](https://github.com/mozilla-firefox/firefox/blob/main/toolkit/components/search/SearchService.sys.mjs)：仅用于独立测试配置创建搜索夹具；生产扩展不调用这个内部服务。
