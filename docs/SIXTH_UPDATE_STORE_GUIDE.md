# Ember Tab 0.1.6 商店手动更新指南

更新日期：2026-10-31。目标：已公开的 Firefox 附加组件 `ember-tab-firefox`（固定 ID `ember-tab@ljure.github.io`，桌面 Firefox 140+）。经 AMO API 核实，当前公开版本为 **0.1.5**（文件 ID `5182094`）。

## 材料位置

完整材料：`dist/amo/0.1.6/`；打包后的整包为 `dist/ember-tab-0.1.6-amo-materials.zip`。

| 文件 | 用途 |
| --- | --- |
| `ember-tab-0.1.6-firefox.zip` | 上传到 AMO 的扩展运行包 |
| `ember-tab-0.1.6-source.zip` | 审核源码包，需在“提交源码”处附交 |
| `version-notes-en-US.txt` / `version-notes-zh-CN.txt` / `version-notes-zh-TW.txt` | 版本说明，按语言分别粘贴 |
| `reviewer-notes.txt` | 审核备注（英文） |
| `privacy-policy.txt` | 从 `privacy.html` 提取的纯文本副本，已包含 Unsplash |
| `icon128.png` | 商店图标（沿用现有图标） |
| `05-icon-choices.png` + `screenshot-captions.txt` | 可选截图与中英说明，沿用 0.1.3 图标候选界面 |
| `upload-guide.md` | 本指南的副本 |
| `SHA256SUMS.txt` | 其余 12 项材料的校验值 |
| `submission.json` | 源提交、运行时哈希与验证摘要 |

## 上传步骤

1. 打开 <https://addons.mozilla.org/zh-CN/developers/addon/ember-tab-firefox/versions/>，选择“上传新版本”。
2. 上传 `ember-tab-0.1.6-firefox.zip`，确认版本号为 **0.1.6**、固定 ID 不变。
3. 勾选“提交源码”，上传 `ember-tab-0.1.6-source.zip`，说明可用 Node.js 24 执行 `node tools/build-firefox.mjs --release` 重建，无需 npm 安装或 Git 检出。
4. 按语言分别粘贴 `version-notes-*.txt`；审核备注使用 `reviewer-notes.txt`。
5. 核对商店隐私字段仍与 `privacy-policy.txt` 一致：本次新增 Unsplash 请求说明，但清单权限与数据类别未变。
6. 提交后记录版本 ID、文件 ID 与审核状态，并更新 [当前进度](AMO_SUBMISSION_STATUS.md)。
7. 审核通过、签名包公开后，在 `about:addons` 原地升级并做一次签名包升级验收。

## 与 0.1.5 的差异

0.1.6 在 0.1.5 的冷启动修复之上恢复 Unsplash 在线来源：

- 设置新增 Unsplash 选项和 Access Key 输入；用户使用自己的密钥，Demo 应用默认每小时 50 次请求。
- 随机照片按横向、高内容过滤获取，署名链接带 utm 参数，并按 API 要求记录下载计数。
- 照片库新增 Unsplash 收藏分类；历史收藏、其他来源和旧配置行为不变。
- 隐私说明补充 Unsplash 的请求字段；清单权限、主机权限、数据类别、第三方服务与扩展 ID 均未改变。

## 说明

- `dist/` 不进入 Git，材料需从本地构建产物取用。
- 本轮不代为上传 AMO；上传、审核、签名与公开是四个独立状态。
- 若商店页面显示的仍是 0.1.5，属于正常，待 0.1.6 审核通过后才会切换。
