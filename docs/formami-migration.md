# Formami SDK 迁移

维护仓库为 `SeeTForest/formami-sdk`，宿主 submodule 路径为 `formami-sdk/`。Git 历史保留。

## 包与版本

npm 从 `@perrin-yong/umami-sdk` 改名为 `@seetheforest/formami-sdk`；保留 NuGet `Pystone.Analytics`、Python `pystone-analytics`。本次迁移及 Web 热路径修复使用版本 `0.1.2`，对应 GitHub Release `v0.1.2`；旧 `v0.1.1` 标签和已发布包保持不变。安装新版本使用 `npm install --save-exact @seetheforest/formami-sdk@0.1.2`。后续版本仍须检查发布身份、权限与版本唯一性，不能覆盖已发布内容。

## 源码与协议兼容

- TypeScript 主类型为 `FormamiPayload`、`FormamiRequest`、`FormamiTracker`、`FormamiHttpTransportConfig`、`FormamiHttpTransport`；旧 `Umami*` 导出保留为兼容别名。
- Python 默认使用 `FormamiHttpTransport`，保留 `UmamiHttpTransport` 导入别名。
- .NET 默认使用 `FormamiHttpTransport`，保留旧 Transport 包装类。新增 `FormamiRequest` / `FormamiPayload` 继承兼容 DTO；`IAnalyticsTransport.SendAsync` 的旧参数类型及 `UmamiRequest.Payload` 属性类型保留，避免已有自定义 Transport 或消费者失效。
- Browser 优先使用 `window.formami`，回退到 `window.umami`；新脚本标记为 `data-analytics-provider="formami"`，仍识别旧脚本标记。
- Consent 同步维护 `formami.disabled` 与 `umami.disabled`；现有旧 Tracker 继续受停发控制。
- Node/.NET/Python 同一请求携带相同值的 `x-formami-cache` 与 `x-umami-cache`；请求次数、JSON 字段、端点、重试和队列语义不因改名改变。
- 六个业务方法、Schema、Policy 保持。npm 消费者将依赖名改为 `@seetheforest/formami-sdk`，导入仅使用 `@seetheforest/formami-sdk/web`、`@seetheforest/formami-sdk/node` 或 `@seetheforest/formami-sdk/core` 子路径（无根导出）；旧包不自动重定向，本次不废弃或撤下旧包。上游 `@umami/node` 与 `docs.umami.is` 是外部资源名称，不随本仓库改名。

个人环境参数只由宿主工程提供。通用文档和分发包使用示例域名，不内置个人 Endpoint、Website ID、账号或凭据。

## 验证边界

本地运行生成/版本/Schema/文档检查、三端测试及 npm/NuGet/wheel 隔离安装冒烟。旧类型导入、Tracker 回退、双请求头和 Consent 兼容需纳入回归。宿主产品仍须完成真实 Browser/Bun、代理/CSP、身份切换和 Staging 验收。

`0.1.2` 修复 Web 热路径问题：`track`、`identify`、`page` 仅校验、更新内存身份/队列并调度微任务，不访问 `localStorage`、DOM 或直接调用 Tracker。Storage 兼容键只在初始化、Consent 切换和 `disable` 阶段更新；Tracker 加载失败后的重试在后台微任务进行，执行前重新检查 Consent。
