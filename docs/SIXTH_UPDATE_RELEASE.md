# Ember Tab 0.1.6 发布记录

更新日期：2026-10-31。版本 0.1.6 在 0.1.5 的冷启动修复之上恢复 Unsplash 在线壁纸来源，并保持其余来源、权限与数据类别不变。

## 变更内容

1. **Unsplash 来源恢复**
   设置页新增 Unsplash 选项与 Access Key 输入行；用户使用自己的密钥，申请入口指向 unsplash.com/developers。来源重新进入在线来源清单、自动更换策略与照片库分类。
2. **请求与署名**
   随机照片请求 `api.unsplash.com/photos/random`（横向、高内容过滤），可选搜索使用 `/search/photos`；请求只带 `Authorization: Client-ID` 与 `Accept-Version: v1`。摄影师与图片页链接追加 `utm_source=ember_tab&utm_medium=referral`；按 API 要求调用 `download_location` 记录下载，目标限定为 api.unsplash.com。
3. **兼容与隐私**
   `pixabay` 旧配置仍回退本地，`unsplash` 不再回退；历史 Unsplash 收藏与缩略图参数继续可用。隐私说明更新 Unsplash 请求字段；清单权限、主机权限、数据类别、第三方服务、Gecko ID 与隐私政策以外的商店字段未变。

## 验证

- 单元测试：99 文件 / 728 项通过（新增 3 项 Unsplash provider 与照片库分类覆盖）
- ESLint：通过
- web-ext lint：0 错误 / 0 notices / 52 项既有警告
- 构建：Firefox 与 Chrome 均成功；源码包独立解压重建后与运行包逐字节一致
- 用户测试：用户确认 0.1.6 本地测试无问题
- 未覆盖：真实 Unsplash 密钥联网取图未进自动化测试；provider 测试使用 mock 响应、请求头与下载计数地址

## 产物

| 产物 | 文件数 | 字节 | SHA-256 |
| --- | --- | --- | --- |
| Firefox 运行包 | 119 | 556610 | `122928255ce70f31d1ccb2634f7ffa189f6747ca0a59eeb3a473cfa3d469a823` |
| Chrome 运行包 | 120 | 557457 | `b2fa6054846188bd4a4397389971d2ba8bd139caedcb79126d016de5d8a65d04` |

源码包与商店材料由 `tools/package-firefox-release.mjs` 从本次源提交生成，提交、文件数与校验值见 `dist/amo/0.1.6/submission.json` 及打包后的 [材料回执](SIXTH_UPDATE_PACKAGE.json)。

源码包单独解压到隔离目录，在 Node 24.22.1 下执行 `node tools/build-firefox.mjs --release`，无需 npm 安装或 Git 检出，输出与上述 Firefox 运行 ZIP 逐字节一致。`SHA256SUMS.txt` 覆盖其余十二份材料。删除材料目录后重复打包，运行包、源码包和材料整包哈希均不变。源包包含发布前记录，不包含后补回执。

## 商店状态

AMO 公开版本经 API 核实为 **0.1.5**（文件 ID `5182094`，2026-10-31 查询）。0.1.6 材料已准备，等待维护者手动上传；本次不记录为已上传、已审核、已签名或已公开。商店隐私字段需与更新后的隐私说明保持一致。

## GitHub 推送

本轮代码提交 `44f6cdd` 与发布准备提交 `4656697` 已推送 `origin/main`。2026-10-31 创建注释标签 `v0.1.6`（指向 `46566970b2d2b6365dc50eddc7b7033da108ecd3`）与 [GitHub Release](https://github.com/LJure/ember-tab/releases/tag/v0.1.6)，上传 `firefox.zip`、`source.zip`、`amo-materials.zip`、`submission.json` 及三个 `.sha256`；七个附件的名称、大小与 SHA-256 已核对，运行包与源码包哈希与上方记录一致。

## 文件与重建

材料位于 `dist/amo/0.1.6/`，整包为 `dist/ember-tab-0.1.6-amo-materials.zip`。使用 Node.js 24 解压源码包并执行 `node tools/build-firefox.mjs --release` 即可重建，无需 npm 安装或 Git 检出。

## 边界

- Unsplash 需要用户自己的 API Key；Demo 应用默认每小时 50 次请求。
- 权限、主机权限、数据类别、第三方服务与 Gecko ID 均未改变；隐私说明文字已更新。
- Chrome 自用交付包本轮未重建，0.1.6 只准备 Firefox 商店材料。
- 正式签名包的同 ID 升级验收要等 AMO 审核通过后进行。
