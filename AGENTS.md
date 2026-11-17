# AGENTS.md

## 项目定位

本目录是独立的 Formami Analytics SDK 工程。它为 Browser、Node/OpenCode、Windows Desktop 和 Python CLI/Agent 提供一致的薄 Adapter，将产品事件安全、异步地映射到 Formami。

仓库：`git@github.com:SeeTForest/formami-sdk.git`。npm 包名为 `@seetheforest/formami-sdk`；NuGet/Python 包坐标与版本保留；改名不得移除旧公共类型、Tracker、请求头和 Consent 兼容入口。个人 Endpoint、Website 登记、账号和凭据只属于宿主工程配置，不得写入本仓库或分发包。

## 核心边界

- 稳定接口只有 `track`、`identify`、`page`、`setConsent`、`flush` 和 `disable`。
- `track`、`identify`、`page` 只允许本地校验和有界内存入队，不得等待网络或磁盘。
- Analytics 故障不得改变宿主产品的返回值、退出码、事务、UI 或稳定性。
- Consent 默认为 `unknown`；只有 `granted` 才发送。拒绝或撤回必须停止发送、清空队列并删除本地分析身份。
- 事件与属性必须来自 `schema/` 的 allowlist；禁止采集 Prompt、代码、路径、命令、凭据、个人联系方式、堆栈、日志和请求体。
- 保持零运行时第三方依赖。没有已验证需求时不增加 Provider 插件层、DI 框架或自动采集。
- 不把 Website ID 当作 Secret；可信支付、订阅、退款和许可证事实只能由业务后端确认后发送。

## 修改前阅读

1. 阅读 `README.md`。
2. 事件、Identity、Consent 或隐私改动阅读 `docs/analytics-spec.md`。
3. 接入行为改动阅读 `docs/integration-guide.md` 和 `docs/product-integration-template.md`。
4. 可靠性改动阅读 `docs/architecture.md` 和 `docs/production-readiness.md`。

## 单一事实来源

- `schema/event-registry.json`：事件定义、版本、Identity Scope 和属性。
- `schema/privacy-policy.json`：公共属性、Session 属性、禁采规则和硬上限。
- 修改 Schema 后运行 `python tools/generate_policy.py`，不得手工维护各语言生成文件。

## 必须验证

```powershell
python tools/generate_policy.py --check
python tools/check_version.py
python tests/validate_schema.py
python tests/validate_docs.py
.\tools\build-sdk.ps1
```

完整构建必须通过 TypeScript、.NET、Python 测试，并实际安装 npm、NuGet 和 wheel 制品做隔离冒烟。生成物位于忽略 Git 的 `artifacts/sdk/`。

## Git 与 Secret

- 不提交构建产物、缓存、Website 私有配置、HMAC Key、Token、Cookie 或真实用户数据。
- npm 发布坐标固定为 `@seetheforest/formami-sdk`；发布配置和版本必须通过 `tools/check_version.py`。
- 尊重现有修改；禁止 `git reset --hard`、强制覆盖或大范围清理工作区。
- 发布必须固定 SDK、Schema 和 Policy 版本，并记录制品 SHA-256。
