# M6 服务与素材复核

> 2026-10-01 首次更新：相册／设置图标已按用户要求恢复上游 JPEG；这两个图标不再属于下表中的原创素材。来源边界见 [首次更新修复与功能评估](FIRST_UPDATE_ASSESSMENT.md)。

核查日期：2026-09-27。本文替代 M5 审计中的当前服务待办；M5 原记录保留为历史。结论针对本项目当前接入方式，不代表服务方单独背书或对所有远端图片作权利保证。

## Wallhaven：接入审核完成，保留图片权利边界

[官方 API 文档](https://www.whvn.cc/help/api)提供随机搜索、图片详情和公开／私有收藏集接口，说明每分钟 40 次请求及 429 响应。本项目只获取 SFW，跨页面请求间隔为 1.5 秒，遇到限流至少等待 60 秒；密钥仅发往固定 API 主机，拒绝重定向。公开集自动化与用户私有集验收已有证据。

[服务条款](https://www.whvn.cc/terms)的 Content 部分说明用户保留权利，并授予服务展示和向其他用户提供内容的许可；[版权说明](https://www.whvn.cc/about)明确图片属于原权利人，并提供侵权处理方式。条款页从官方 About 页链接取得，浏览工具读取失败后以 HTTPS 请求读取成功，页面标注更新于 2016-08-03。

审核判断：官方接口和条款为当前用户自选、直接连接服务的背景功能提供接入依据，可以保留。不把上传者等同于作者：界面使用 Uploaded by，并链接图片详情页。扩展不捆绑 Wallhaven 图片，也不将远端内容重新声明为 MIT；商店宣传仅使用原创素材。此结论不保证每一张用户上传图片均已获作者授权。

代码依据：`scripts/domains/backgrounds/source-wallhaven.js`、`scripts/domains/layout.js`；数据与收藏集实测见 M6 报告。

## Pexels：背景功能用途与署名复核完成

[官方背景应用说明](https://help.pexels.com/hc/en-us/articles/4405588861721-Can-I-use-the-API-as-a-wallpaper-app)允许为其他主要用途的产品增加背景选择功能，并要求自动背景显示时包含署名。Ember 的主要功能为新标签页链接和搜索，壁纸是附属功能；这是依据其公开说明作出的用途判断，不是 Pexels 对 Ember 的个别批准。

[署名说明](https://help.pexels.com/hc/en-us/articles/900005851903-How-should-I-give-credit-Can-I-use-your-logo)建议显示摄影师、Pexels 并链接图片页面。当前自动背景强制显示摄影师及 Pexels，收藏保留来源和署名字段；本轮将署名链接优先指向图片页面，以便查看具体作品和来源。缺失旧数据不伪造作者，危险协议链接仍禁止。

[完整条款](https://www.pexels.com/terms-of-service/)及[官方 API 条款解释](https://help.pexels.com/hc/en-us/articles/900005880463-What-are-the-Terms-and-Conditions)禁止单独再分发原图、复制竞争图库及未经许可的大规模采集。当前包不包含 Pexels 图片，没有运营公共图库或图片转售；个人收藏、缓存和备份不得作为面向他人的原图分发服务。用户已确认自带 Key 取图通过；不将其解释为取得额外配额或商业再分发许可。

代码依据：`source-remote.js`、`layout.js`、`library-store.js`；署名及恢复 URL 边界测试在 `tests/photos.test.js`。

## Bing：按用户决定保持现状

[Microsoft 服务协议的 Bing and MSN 条款](https://www.microsoft.com/en-us/servicesagreement#14_BingandMSN)限制图片等内容的用途；产品使用、复制和再分发需要适用授权或法律依据。当前 `HPImageArchive.aspx` 能返回图片，但未发现适用于此扩展的明确接口／图片授权依据。开源和免费本身不能替代该依据。

用户基于与上游相同的开源协议和用途、以及其报告的上游 Edge 商店上架情况，明确决定不作处理。本轮据此保留 Bing 壁纸，移除待决策的候选构建门槛；代码与搜索功能均不变。该记录是用户的发布范围决定，不写成已取得 Microsoft 单独授权或已核验上游商店授权材料。未联系服务方，也未以用户身份申请授权。

## 随包素材与依赖

| 内容 | 当前依据与复核结果 |
| --- | --- |
| 项目源代码 | 上游 MIT 及 nil-byte 版权声明保留；独立分叉身份已写入名称、关于和 README |
| 产品图标、默认壁纸、相册和设置图片 | `assets/brand/*.svg` 原创几何素材；包内只含对应生成图，不含上游宣传截图 |
| fflate、Interact.js、SortableJS | 完整 MIT 位于 `licenses/`，版本与字节对照沿用 M5 证据；本轮未更换依赖 |
| Heroicons | 已识别的 toast 图标完整 MIT 随包；不把 Iconify 承载平台误当作图标本身的许可证 |
| 其他内联 SVG | 使用上游项目 MIT 作为来源依据。本轮按库名、版权与来源注释检索，未发现新增的独立授权标记；不保证识别所有图形的外部来源，不要求在没有具体疑点时重画全部图形 |
| 运行时图片、网站 favicon、用户文件 | 不在应用 MIT 再许可范围内；仍受原权利人和服务条件约束 |

素材工程审核据上述范围完成，未来出现具体第三方来源线索时重新核对。隐私、HTTPS、三方许可及动态 HTML 审计继续沿用 M5 实现；恢复保护与权限撤销按用户决定延期，不在本轮新增。

## 分发接续

Wallhaven、Pexels 与随包素材的本轮复核已记录；Bing 按用户决定保留。候选构建门槛已处理，签名后的实际安装／升级、数据同意界面、商店条目和最终发布作为独立分发门槛保留，不以生成 ZIP 代替验收。详见 [发布交接](RELEASE_HANDOFF.md)。
