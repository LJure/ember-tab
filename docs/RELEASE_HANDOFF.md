# Ember Tab 首版发布交接

更新：2026-09-27。0.1.0 已提交 AMO 公开上架审核，源码已附交，当前等待审核。尚未取得签名包或创建 GitHub Release；签名安装和分发验收仍未完成。提交信息见 [Mozilla 提交进度](AMO_SUBMISSION_STATUS.md)，包和证据以 [M6 报告](M6_ACCEPTANCE.md) 为准。

## 已确认的首版范围

- 保留本地、Wallhaven、Pexels、Bing 来源。用户最新确认 Pexels 已验证，替代此前移除选择；Unsplash／Pixabay 已移除。
- 用户已通过：Brave 备份迁移、基本账号同步、真实 WebDAV、慢图床加载、自动图标尺寸、Wallhaven 私有收藏集、Pexels 真实取图。
- 双设备离线冲突合并延期至后续版本；首版不承诺并发修改自动合并。
- 长期定时轮换转为上线后持续验证，不写成已经完成长期运行测试。
- 恢复中断保护、权限撤销验证按用户决定留待后续版本；首版维持现有处理方式，不新增机制、不回退已完成的兼容修复。未实现／未验证的项目保持未勾选，从首版门槛移出。

## 恢复中断的当前处理步骤

当前实现会先校验 ZIP，再依次恢复各数据库和设置。单库事务不能覆盖全部数据库；中断可能留下新旧数据混合状态。尚无自动安全副本或自动回滚。用户决定沿用现有方式，额外保护留待后续版本；本项不再阻挡首版，也不标记实现完成。以下仅说明现有操作步骤。

1. 恢复前，在“设置 → 数据管理”导出当前数据，等待下载完成，另存为易识别的恢复前 ZIP；同时保留准备导入的原始 ZIP。没有成功保存旧备份时，先不要覆盖现有数据。
2. 暂停其他设备上的编辑，关闭其他 Ember 新标签页；恢复过程中保持当前页面打开。若浏览器提示离开正在恢复的页面，选择留下。
3. 本地导入或 WebDAV 恢复失败后，保留错误提示；不要把此时的数据导出并覆盖唯一的旧备份。不要通过卸载扩展或清空存储排错。
4. 要继续迁移：排除磁盘空间、文件或网络问题后，用同一个完整 ZIP 重试。WebDAV 下载失败时可重新下载原有备份，不要用当前混合状态覆盖远端原备份。
5. 要回到原状态：导入步骤 1 另存的旧 ZIP，等待成功提示及页面刷新，再核对链接、设置和本地图片。此过程是再次恢复，不是原子回滚，也不会撤回已传播到其他设备的同步修改。
6. 连续失败时保留两份 ZIP 和错误信息，停止继续写入；反馈时不要公开私人备份、API Key 或 WebDAV 凭据。

现有证据仅证明受控故障后完整重试成功。恢复旧 ZIP、进程强杀后找回和空间不足等路径仍需独立验收。

## 下一步工程与验收顺序

| 顺序 | 工作 | 关闭条件 |
| --- | --- | --- |
| 1 | 服务条款及素材核对（已记录） | 见 [当前审核](M6_SOURCE_REVIEW.md)；Bing 按用户决定保持现状，不把上游商店记录当成单独授权证明 |
| 2 | 整理候选包与审阅资料 | 固定版本及哈希，复跑受影响检查；[英文审阅说明](AMO_REVIEWER_NOTES.md)包含权限、隐私、构建和检查步骤 |
| 3 | 签名与正式分发 | 已获授权并完成 AMO 公开提交与源码附交，等待审核；取得签名包后验收初次安装、同 ID 升级、权限／数据同意和重启数据保留 |

本地上传材料已准备：`dist/ember-tab-0.1.0-firefox.zip`（未签名扩展）、`dist/ember-tab-0.1.0-source.zip`（审核源码）及各自 `.sha256`。源码解包重建与候选包字节一致，提交、大小和校验值见 [提交清单](M6_SUBMISSION.json)。不要上传 `.local` 中的浏览器配置和原始测试日志。

后续版本待办（本轮不实现、不验证）：

- [ ] 恢复中断额外保护，包括安全副本／回滚方案、进程终止及找回失败路径。
- [ ] 权限撤销及重新授权的专项验证，按发现的问题补充处理。

## 商店介绍草稿

以下为介绍基础文案；已提交包含功能边界的中英双语版本，实际网址与提交状态见 Mozilla 提交进度。

**名称：** Ember Tab

**中文简介：** 基于 Aura Tab 的非官方 Firefox 新标签页扩展，提供快捷链接、搜索与个性化壁纸。

**中文介绍：** Ember Tab 将快捷链接、Dock、搜索和壁纸整合到 Firefox 新标签页。支持书签导入、本地图片、在线壁纸、ZIP 备份和 HTTPS WebDAV。基于 nil-byte 的 Aura Tab 独立维护，保留上游 MIT 许可证，与原作者及 Mozilla 无隶属关系。在线功能直接连接所选网站或服务；数据用途与第三方请求见隐私说明。

**English summary:** An unofficial Firefox port of Aura Tab with shortcuts, search and customizable wallpapers.

**English description:** Ember Tab brings shortcuts, a Dock, search and wallpapers to your Firefox new tab. It supports bookmark import, local images, online wallpapers, ZIP backups and HTTPS WebDAV. Independently maintained from Aura Tab by nil-byte under its MIT license; not affiliated with the original author or Mozilla. Online features connect directly to selected websites and services. See the privacy notice for data use and third-party requests.

项目与支持：[Ember Tab](https://github.com/LJure/ember-tab) · 来源：[Aura Tab](https://github.com/nil-byte/aura-tab) · [隐私源文件](../privacy.html) · [第三方声明](../THIRD_PARTY_NOTICES.md) · [复现构建步骤](DISTRIBUTION.md)。AMO 隐私字段使用随包隐私说明的完整文本；截图应使用原创默认素材与合成链接，不包含个人数据。具体上传文件与校验值见 M6 报告。

GitHub Actions 保持暂停。本文不记录 API Key、账号密码或用户私人备份。
