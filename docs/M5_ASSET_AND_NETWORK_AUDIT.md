# M5 素材、服务与权限审计

> 最新复核见 [M6 服务与素材审核](M6_SOURCE_REVIEW.md)：Wallhaven、Pexels 和随包素材已按当前范围复核；Bing 按用户决定保持现状。以下 M5 待办为历史，不恢复已经移除的来源。

> 后续变更：用户已要求移除 Unsplash 和 Pixabay；现已删除取图入口与 API 适配器，加入 Wallhaven。下文对应两者的实现／门槛是 M5 初轮历史记录，不是当前启用状态。当前使用方法、验证与剩余事项见 [Wallhaven 补充记录](WALLHAVEN.md)。

审计日期：2026-09-27。本文件记录事实、工程决定和正式发布门槛，不等同于法律意见或 AMO 审核通过。

## 品牌及素材

| 范围 | 来源／处理 |
| --- | --- |
| manifest 三语言名称／描述 | Firefox 构建使用 Ember Tab，说明独立移植；源根 Chromium manifest 仍保留历史基线 |
| 关于页／帮助／隐私／变更记录 | 改为 Ember 维护入口、上游致谢、本地隐私说明和 0.1.0 分叉变更，不把上游 3.5.3 当作 Ember 版本 |
| icon16/48/128.png | `assets/brand/ember.svg` 自制余烬图案，按声明尺寸输出，无 Firefox 标志 |
| photo.jpg / setting.jpg | 自制几何相册／调节器图形，替换来源未单独确证的上游系统图标；兼容原路径 |
| Background1.jpg | 自制渐变山丘图，替换来源未单独确证的上游默认照片；兼容原路径 |
| scripts/libs | fflate 0.8.3、Interact.js 1.10.27、SortableJS 1.15.7 与官方 npm 包按 LF 归一化逐字节一致，完整 MIT 已附入 `licenses/` |
| toast 内联图标 | 上游注释指向 Heroicons；补入 Heroicons MIT，其他内联 SVG 仅有上游项目级 MIT 依据，最终发布仍应核对外部来源疑点 |
| assets/other | 上游历史演示截图，不打包、不作为 Ember 宣传图 |

原 MIT 许可证未修改。依赖原始文件未改写。复现品牌导出方法见 [分发说明](DISTRIBUTION.md)。本次不替换数据库、storage、WebDAV 目录或备份格式中的 Aura 标识，也不修改 Dock 默认设置。

## 网络清单与权限决定

| 入口 | 数据／目的地 | 时机与控制 |
| --- | --- | --- |
| search.js | 搜索词 → 选定引擎或 Firefox 默认搜索 | 用户提交，既有引擎选择 |
| background-worker.js / icon-network.js | 快捷链接完整 URL → 网站；声明的图标／manifest → 对应主机；域名 → favicon.vemetric.com、Google s2 | 自动图标加载／缓存未命中；文字图标可避免该链接的图标请求 |
| favicon.js / 图标渲染 | 自定义图片 URL → 用户图床；失败时直接 img 回退 | 新标签页、导入／同步或编辑后，受 HTTPS CSP 限制 |
| backgrounds/source-remote.js | Bing 语言市场参数；Unsplash／Pixabay／Pexels 查询与 API 密钥；图片主机；Unsplash download_location | 选择在线源、手动／定时刷新；默认本地，可切回本地 |
| bookmarks/validator.js | 选定链接 URL → 对应网站 | 用户发起有效性检查；HTTP 在普通包被阻止 |
| storage.sync | 设置、链接、图标 URL、壁纸 API 密钥 → Firefox 管理的同步 | Firefox 账号及其同步开关；不传本地 Blob |
| webdav-client.js / backup-manager.js | 认证与备份 ZIP → 用户服务器，ZIP 含设置、链接、图片、API 密钥，不含 WebDAV 配置 | 用户主动测试／列表／备份／恢复／删除；凭据存本地；无额外 ZIP 加密 |
| i18n、changelog | 扩展内本地 JSON | 不联网 |
| 项目／帮助链接 | 用户主动导航到项目或服务文档 | 无后台拉取更新／统计逻辑 |

普通 Firefox 包保留任意 HTTPS 主机访问：用户可指定任何图床、图标及 WebDAV 服务器，有限域名清单不能覆盖该功能。未新增网页 content script、history 或 tabs 权限。bookmarks 仍用于主动导入；storage／unlimitedStorage 用于设置与大图片；alarms 用于用户选择的刷新。

本版使用 Firefox 140+ 内置安装同意，声明 `authenticationInfo`、`bookmarksInfo`、`browsingActivity`、`searchTerms`、`websiteContent` 为 required；这些覆盖现有整合功能的传输，拒绝安装即可拒绝整组声明。功能开关仍单独有效，没有技术统计采集。不采用仅添加 optional 声明却未实现授权检查的做法；后续如拆分可选授权，需为后台加载、恢复配置和权限撤销补全拦截。

普通包只声明 HTTPS 主机权限，并用 `connect-src` 阻止明文远端请求与重定向降级。WebDAV 表单和客户端另校验 HTTPS、拒绝 URL 内凭据，并拒绝自动重定向，避免凭据／备份发往非预期路径。`--test-http` 仅为本机集成测试开放 loopback，并另命名测试 ZIP。不能宣称旧的 HTTP WebDAV 仍兼容。

参考：[Firefox 内置数据同意](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)、[Mozilla 扩展政策](https://extensionworkshop.com/documentation/publish/add-on-policies/)。声明与实际签名包的安装／升级提示仍需 M6 验证。

## 图片服务条款：发布前仍须处理

用户决定暂时停用 Pixabay，保留 Unsplash 并争取上线前解决。未把“用户自带密钥”当作自动符合服务条款。以下是具体发布门槛，不能由单测通过抵消：

- **Unsplash：阻塞正式发布。** [API 指南](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines)要求热链、署名／摄影师链接和下载事件，限制壁纸类复制体验，且不应要求终端用户注册开发者账号。现有自带 key、缓存／下载及自动轮换模式未获该服务确认。发布前需取得适用授权或停用此来源，不能只加免责声明。
- **Pixabay：已暂时停用新 API 请求。** [API 文档](https://pixabay.com/api/docs/)要求 24 小时请求缓存并限制大量自动查询。界面选项禁用，生产 provider 选择返回空，旧配置的获取入口回退本地；密钥、收藏和已有图片不删除。恢复来源前补足缓存／请求策略并用真实 key 验证。原实现保留于源码供后续修复，不能因其单测通过就重新启用。
- **Pexels：须核实最终呈现。** [官方用途说明](https://help.pexels.com/hc/en-us/articles/4405588861721-Can-I-use-the-API-as-a-wallpaper-app)区分以图库为核心的应用和其他产品的背景选择功能，自动背景还需显示署名。Ember 是新标签页工具，但当前可隐藏信息、收藏／下载等组合不能据此直接宣布许可通过；发布前审查署名和用途，必要时向服务方确认。
- **Bing：未取得通用图片再分发授权。** 当前运行时按需获取并展示版权信息，HTTP 200 不等同于可自由再分发图片。正式宣传或捆绑内容不能直接使用下载的 Bing 图片；正式上线前核对适用服务条款和图片权利。

本轮为 Unsplash 新获取图片增加摄影师个人页、来源署名和 utm 归属参数，在线 Unsplash／Pexels 信息不再随“隐藏信息”而消失；收藏保存这些署名字段。下载事件只允许访问 `https://api.unsplash.com`，拒绝跳转和响应提供的其他主机，避免发送密钥。旧收藏缺失的署名不会凭空补造。

Unsplash 上线前仍需：确定应用级凭据／OAuth 或服务方认可的方案（不在本地扩展内嵌共享秘密）；按对本项目适用的要求处理热链、缓存、下载与轮换；明确用途资格并验证实际署名路径。本轮没有联系服务方或代申请权限。主许可证与 M5 工程完成不代表这些外部条件通过。
