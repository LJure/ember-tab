Ember Tab 0.1.5 修复了 0.1.4 之后反馈的两处冷启动问题：首屏壁纸占位可能只有平均色、没有缩略图；Dock 在扩展存储初始化完成前一直是空的。用户已在 Chrome / Edge 的自用版完成测试，Firefox 商店更新材料已准备。

- 首屏壁纸快照改为壁纸应用后立即捕获，不再等待空闲回调，避免图片地址已失效导致只存下纯色。
- 直接加载图片失败时，用扩展已有的主机权限取回同源 blob 再绘制；仍失败则保留上一次的真实缩略图，不再用纯色覆盖。
- Dock 启动时先从本地缓存立即绘制快捷链接，扩展存储返回后刷新；缓存项在加载完成前不可拖动或编辑。
- 只在完整加载成功后写入缓存，过期超过 14 天或版本不符的缓存会被忽略。
- 快捷链接初始化提前到语言和主题读取之前。

Firefox 权限、主机权限、数据类别、第三方服务和扩展 ID 均未改变，隐私政策不变，没有远程可执行代码。验证：99 个测试文件 / 725 项单元测试、ESLint 通过、Firefox 与 Chrome 可重复构建、web-ext 0 错误 / 0 notices / 52 项既有警告；Chrome / Edge 自用版由用户完成启动测试。签名包升级验收仍需在商店版本公开后进行。

## 文件与商店状态

- `firefox.zip`：AMO 上传或开发者临时加载用的未签名运行包。
- `source.zip`：对应源码，独立解压重建后与运行包逐字节一致。
- `amo-materials.zip`：手动更新整包，含两个压缩包、隐私文本、说明、审核备注、可选截图和指南。
- `submission.json` 与 `.sha256`：源提交、验证摘要与校验值。

使用 Node.js 24 解压源码并执行 `node tools/build-firefox.mjs --release` 即可重建，无需 npm 安装或 Git 检出；本地浏览器配置、凭据和测试专用扩展已排除。

经 AMO API 核实，商店当前公开版本为 **0.1.4**（文件 ID `5178253`，2026-10-29 查询）。0.1.5 由维护者手动上传；本次准备不代表已上传、已审核、已签名或已公开。

[商店手动更新指南](https://github.com/LJure/ember-tab/blob/main/docs/FIFTH_UPDATE_STORE_GUIDE.md) · [发布验证记录](https://github.com/LJure/ember-tab/blob/main/docs/FIFTH_UPDATE_RELEASE.md)
