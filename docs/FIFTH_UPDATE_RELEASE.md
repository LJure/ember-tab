# Ember Tab 0.1.5 发布记录

更新日期：2026-10-29。版本 0.1.5 把 0.1.4 的首屏修复补完，并解决 Edge / Chromium 冷启动仍能观察到的两处问题。

## 修复内容

1. **首屏壁纸占位为纯灰**
   快照原先在 `requestIdleCallback` 中捕获；回调执行时壁纸 blob URL 可能已被回收，直接 `<img>` 又受 CORS 限制，画布捕获静默失败，只写入平均色。现在改为壁纸应用后立即捕获，失败时用扩展主机权限 `fetch` 成同源 blob 重试，仍失败则保留上一次的真实缩略图。
2. **Dock 冷启动长时间为空**
   新增 `localStorage` 快照（`aura:quicklinks-cache:v1`），启动时先绘制链接、结构、Dock 固定项、标签与显示设置，`store.init()` 返回后刷新。缓存仅在完整加载后写入；14 天过期或版本不符即丢弃；加载完成前缓存项 `pointer-events: none`，避免对旧顺序拖拽或编辑。
3. **初始化顺序**
   快捷链接初始化提前到语言与主题存储读取之前。

## 验证

- 单元测试：99 文件 / 725 项通过（新增 7 项：首屏快照保留旧预览、不依赖空闲回调、Dock 缓存 5 项）
- ESLint：通过
- web-ext lint：0 错误 / 0 notices / 52 项既有警告
- 构建：Firefox 与 Chrome 均可重复构建；源码包独立解压重建后与运行包逐字节一致
- 用户实测：Chrome / Edge 自用版 0.1.5 启动正常，关于页版本与更新日志正确
- 无头 Edge 对照：模拟 `storage.sync` 延迟 6 秒，Dock 链接 72ms 出现，壁纸 6.1s 恢复，快照缩略图 5431 字节

自动化浏览器矩阵未重跑；0.1.5 只改动首屏绘制与缓存路径，功能矩阵沿用 0.1.3 记录，启动表现由用户实测覆盖。

## 产物

| 产物 | 文件数 | 字节 | SHA-256 |
| --- | --- | --- | --- |
| Firefox 运行包 | 119 | 554818 | `c952f50f969b347ea58904ae2022f4ef70dd42b052f92c61faacf61142b48bf6` |
| Chrome 运行包 | 120 | 555661 | `20fdd076f7f5a5dd6a7ef9a1fbe867caff54ac1ed813300a5b558d4d14844a41` |
| Chrome 自用交付包 | 124 | 573515 | `7b5d0cf4721a4f80c7c6ba6a4d3a0e3aeb49e2a1464e42272ed044b8cf6afecf` |

源码包与商店材料由 `tools/package-firefox-release.mjs` 从本次源提交生成，提交、文件数与校验值见 `dist/amo/0.1.5/submission.json` 及打包后的 [材料回执](FIFTH_UPDATE_PACKAGE.json)。

源码包单独解压到隔离目录，在 Node 24.22.1 下执行 `node tools/build-firefox.mjs --release`，无需 npm 安装或 Git 检出，输出与上述 Firefox 运行 ZIP 逐字节一致。删除材料目录后重复打包，运行包、源码包和材料整包哈希均不变，`SHA256SUMS.txt` 覆盖其余十二份材料。源包包含发布前记录，不包含后补回执。

## 商店状态

AMO 公开版本经 API 核实为 **0.1.4**（文件 ID `5178253`，2026-10-29 查询）。0.1.5 材料已准备，等待维护者手动上传；本次不记录为已上传、已审核、已签名或已公开，也没有创建 GitHub Release 或标签。

## GitHub 推送

本轮代码与发布准备提交随后推送 `origin/main`；没有创建 `v0.1.5` 标签或 GitHub Release。材料与回执提交单独推送，最终远程 HEAD 在推送后核对，避免把回执自身提交 SHA 写入自身。

## 文件与重建

材料位于 `dist/amo/0.1.5/`，整包为 `dist/ember-tab-0.1.5-amo-materials.zip`。使用 Node.js 24 解压源码包并执行 `node tools/build-firefox.mjs --release` 即可重建，无需 npm 安装或 Git 检出。

## 边界

- 权限、主机权限、数据类别、第三方服务、隐私政策与 Gecko ID 均未改变。
- 首次安装没有本地缓存，仍需等待一次扩展存储初始化。
- 正式签名包的同 ID 升级验收要等 AMO 审核通过后进行。
