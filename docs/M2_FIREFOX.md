# M2：Firefox 最小可运行版

日期：2026-09-27。工作分支：`feat/m2-firefox-runtime`，起点：M1 `6341901`。

## 结果与范围

M2 已完成。Windows / Firefox 156.0.1 的独立临时配置通过 10 项真实浏览器检查：临时安装、Gecko ID、新标签页覆盖与启动、默认设置、异步消息、设置界面、多语言与主题持久化、事件页休眠／唤醒、定时器、扩展重载。不是完整功能验收或商店发布。

Firefox 构建使用 `ember.project.json`：名称 Ember Tab，版本 0.1.0，固定 ID `ember-tab@ljure.github.io`，最低版本目标 140.0。ESR 尚未实测，不能把 manifest 下限当作兼容验收结论。

原 `manifest.json` 与 Chrome 打包脚本保留。生成产物移除 `favicon`、`offscreen`、`minimum_chrome_version`、`offline_enabled`，后台改为 `scripts: ["background-worker.js"]` 和 `type: "module"`。Firefox MV3 以非持久事件页运行；不增加常驻后台。

实测已有 `chrome.*` Promise 调用及 `sendResponse` 异步消息可用，因此本阶段没有机械替换全部 API 名称，也未引入多余兼容层。网站图标的 Chrome 离屏路径尚待 M3 适配；本阶段不宣称网站图标已可用。

## 构建与临时安装

在项目目录执行（Node 24.14.1 / npm 11.11.0 已验证）：

```powershell
npm ci
npm run build:firefox
npm run lint:firefox
```

输出：

- `dist/firefox/manifest.json`：可临时加载目录的入口。
- `dist/ember-tab-0.1.0-firefox.zip`：未签名开发包。
- `dist/ember-tab-0.1.0-firefox.zip.sha256`：包校验值。

在单独的 Firefox 测试配置打开 `about:debugging#/runtime/this-firefox` → “临时载入附加组件” → 选择生成的 manifest，然后新建标签页。临时扩展在浏览器退出后移除；不要把这种方式当成正式签名安装。不要直接加载仓库根目录的 Chrome manifest。

打包采用运行文件白名单，含原 MIT LICENSE 和独立来源 NOTICE；不打包 `.local`、测试数据、浏览器配置、开发工具、node_modules、文档、Git 或 `assets/other`。源文件相同时重复构建 ZIP 的 SHA-256 一致；目前验证的是同一环境／检出内容，未宣称跨操作系统字节完全一致。

本轮产物：94 个文件，4,426,285 字节，SHA-256：

```text
c1c68d79c9be69da29c5c542e31cd53d0982fe1334d060bc61ce6b97e1775cd1
```

生成目录及 ZIP 均被 Git 忽略；仓库保存源码和复现步骤。

## 自动验证

```powershell
npm test
npm run lint
npm run test:firefox-build
$env:FIREFOX_BINARY = 'D:\Firefox\firefox.exe'
npm run test:firefox
```

其他机器可设置其 Firefox 可执行文件路径；不设置时交由 Selenium 寻找安装位置。先构建再运行浏览器测试。第一次运行会从 Mozilla 的 GitHub releases 下载 geckodriver 0.36.0，缓存于忽略的 `.local/drivers/`，需要网络。

浏览器脚本创建全新的临时配置，使用无窗口模式，并在结束时退出。只在该自动化实例启用系统测试访问，以调用真实的新标签页命令和事件页休眠机制；不改变日常 Firefox 配置或生产扩展权限。后台休眠测试使用 Firefox 自身 `terminateBackground` 测试入口，未来 Firefox 内部接口变更时可能需要更新测试脚本。

| 验证 | 实际结果 |
| --- | --- |
| Vitest | 75 文件，578 项通过；新增启动时按已存设置重建 alarm 的回归检查 |
| ESLint | 75 文件，0 错误、0 警告；包含新增构建和浏览器测试工具 |
| 真实包构建回归 | 1 项通过；重复构建校验值一致、上游 manifest 未改、权限／入口正确、来源许可与白名单检查通过 |
| Firefox 临时安装 | 固定 ID 安装成功，manifest 显示 Ember Tab / 0.1.0 |
| Firefox 新标签页 | 使用浏览器自身新建标签页命令打开扩展页面；时钟、搜索本地化和设置入口启动 |
| 默认设置 | 首装 backgroundSettings 与既有默认值一致 |
| 异步消息 | 无效协议图标请求收到明确失败回复，无超时或消息通道阻断 |
| 设置 UI | 实际操作语言下拉框与深色主题开关，写入 sync；刷新后仍为英文／深色 |
| local/session | Promise 写入与读取通过，页面刷新后值保留；未做跨浏览器同步声明 |
| 后台休眠 | 确认状态 stopped，runtime 消息和 storage 事件分别唤醒事件页 |
| 定时器 | 存储更改触发 60 分钟 alarm；把首次触发提前后，真实 alarm 唤醒后台并广播刷新；切回本地壁纸清除定时器 |
| 扩展重载 | Firefox AddonManager 重载后设置与 local 值保留，新标签页和后台消息恢复 |

浏览器测试不使用真实账号或 API Key；定时器测试不代表在线图片下载验收。完整浏览器重启、正式升级、跨设备 Sync 和数据往返仍属于后续阶段。浏览器源码的休眠实现参考 [Mozilla event-page implementation](https://github.com/mozilla-firefox/firefox/blob/main/toolkit/components/extensions/parent/ext-backgroundPage.js)。

原始证据保存在忽略的 `.local/m2/`：`vitest.json`、`test.log`、`eslint.json`、`web-ext-lint.json`、`firefox-smoke.json`、`geckodriver.log`、`newtab.png`。浏览器报告关联安装包 SHA-256。初次测试曾遇到驱动配置差异与 Firefox Nimbus 远程实验服务退出等待，均属于测试工具／浏览器环境问题；脚本在测试配置退出时停止该无关加载器。

重载压力步骤偶发记录 `Promise resolved after context unloaded`（壁纸状态写入时页面正被扩展重载销毁）。本轮重载后设置和后台功能检查通过，未见启动阻断；这不等于数据并发验收通过。M4 需覆盖壁纸写入与禁用／重载交叠时的状态完整性，不能只吞掉日志。

## web-ext 检查与后续门槛

web-ext 10.7.0：**0 错误、0 notices、57 警告**。未关闭规则或把警告当作审核通过。

| 警告 | 数量 | 后续处理 |
| --- | --- | --- |
| UNSUPPORTED_API | 2 | M3 将网站图标的 offscreen DOM 操作改为 Firefox 后台实现 |
| ICON_SIZE_INVALID | 3 | M5 制作独立图标并输出正确尺寸；上游 icon16/48/128 实际宽度均为 1254 |
| MISSING_DATA_COLLECTION_PERMISSIONS | 1 | M5 审计网络行为后如实声明；当前不填虚假的 none，不提交 AMO |
| UNSAFE_VAR_ASSIGNMENT | 51 | M5 逐项检查上游 innerHTML 路径的输入来源、转义与安全处理；不能仅凭警告数量认定漏洞或安全 |

其余待办：M3 网站图标、搜索、书签、壁纸、快捷链接完整流程；M4 备份／WebDAV／跨设备与重启；M5 界面残留上游名称、素材与库许可、权限及隐私审计；M6 ESR 和发布候选验收。

## GitHub Actions

用户本轮明确同意“暂停 GitHub Actions”。已将 `LJure/ember-tab` 的 Actions 设置为 `enabled: false` 并读回核对。M1 中的自动审批拒绝是历史记录，当前不再是阻塞。上游 workflow 文件暂时保留；在 M5 调整 Firefox 发布流程前不恢复自动发布。
