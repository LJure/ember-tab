# Ember Tab 0.1.4 发布记录

2026-10-28：用户反馈启动页出现壁纸缺失、Dock 不显示、时钟停在 00:00，十几秒后才恢复。定位为启动初始化串行等待扩展存储；修复后用户在 Firefox 和 Chrome 自用版本地测试通过，授权准备 0.1.4 商店更新材料并推送代码。本轮没有上传 AMO，也没有创建 GitHub Release 或标签。

## 更新范围

- 新标签页先启动时钟和壁纸，再并行读取语言与主题设置，不再让首屏排在多次 `storage.sync` 之后。
- 时钟先用默认格式绘制并启动走时，设置返回后刷新；修复冷启动停留在静态 `00:00`。
- 快捷链接去掉额外的 `requestIdleCallback` 延迟，Dock 更早初始化；其数据读取顺序未改。
- 首屏壁纸兜底撤离从 3 秒放宽到 30 秒，正常只在真实壁纸应用后撤离。
- 首屏预览从 48×27 提升到 480×270，冷启动瞬间不再是难以辨认的色块。

Firefox 权限、host_permissions、Gecko 身份和数据声明与已公开 0.1.3 一致；没有新增服务、网络请求或远程可执行代码。版本号与更新日志递增为 0.1.4。签名／升级验收不因此完成。

## 发布验收

| 检查 | 结果 |
| --- | --- |
| 单元测试 | 98 文件、718 项通过（新增时钟先绘制回归测试） |
| 用户测试 | Firefox 与 Chrome 自用版启动表现通过 |
| 两版构建 | Firefox 1 项、Chrome 3 项；运行包可重复构建 |
| ESLint | 通过 |
| web-ext | 0 错误、0 notices、52 个既有 warnings |
| Firefox 运行包 | 119 文件、552776 字节 |
| Chrome 运行包 | 120 文件、553620 字节 |

本次未重跑 Firefox/ESR 浏览器验收矩阵和完整 Chrome 生命周期矩阵；0.1.4 只改变首屏初始化顺序与预览分辨率，功能代码与 0.1.3 相同。机器可读结果见 [验证 JSON](FOURTH_UPDATE_VALIDATION.json)。

Firefox 运行包 `ember-tab-0.1.4-firefox.zip`：119 文件、552776 字节；SHA-256 `e6122aa351d0dcc9a01432a3537dac2955b1393333f1fae20e779bae2550587e`。Chrome 运行包 `ember-tab-0.1.4-chrome.zip`：120 文件、553620 字节；SHA-256 `b375cb6ec028df99855489a00fec96fae3fb0ce50857ba2009e912200bf1b9ff`。

源码包与商店完整材料由 `tools/package-firefox-release.mjs` 从本次源提交生成；源包包含发布前记录，不包含后补回执。打包后回执在本文件、[材料验证](FOURTH_UPDATE_PACKAGE.json) 和 `dist/amo/0.1.4/SHA256SUMS.txt` 中记录。

## 商店状态

AMO 公开 API 于 2026-10-28 核实当前公开版本 **0.1.3**，ID **ember-tab@ljure.github.io**，文件 ID `5081375`。本轮不代为上传 0.1.4，不标记审核、签名或商店公开完成。材料在 `dist/amo/0.1.4/`，步骤见 [手动上传指南](FOURTH_UPDATE_STORE_GUIDE.md)。

GitHub 本轮只推送源码与文档，不创建 Release 或标签；GitHub Actions 保持暂停，继承的 Chromium 发布工作流未启用。历史发布记录：[0.1.3](THIRD_UPDATE_RELEASE.md)、[0.1.2](SECOND_UPDATE_RELEASE.md)、[0.1.1](FIRST_UPDATE_RELEASE.md)。
