# Monorepo 模块划分

## 目录树

```text
docs/
apps/
  api/
  orchestrator/
  web/
packages/
  config/
  contracts/
  profiles/
  schemas/
python/
  adapters/
  core/
  profiles/
  workflows/
sdk/
  python/
infra/
  profiles/
examples/
data/
```

## 各目录职责

### `apps/`
面向用户的应用入口与运行时入口。

- `apps/web`
  - React 工作台前端
  - 数据集浏览
  - 检索预览
  - tasks / workspaces / exports 视图
- `apps/api`
  - FastAPI 控制面 API
  - 提供 datasets、tasks、workspaces、exports 与 sample operations 等路由
- `apps/orchestrator`
  - Dagster 项目
  - 定义资产物化与衍生输出相关的 assets

### `packages/`
TypeScript 侧共享包。

- `packages/schemas`
  - UI 和 TS 集成层共用的数据结构定义
- `packages/contracts`
  - TS 侧 adapter 与 runtime contract
- `packages/profiles`
  - runtime profile 与 capability 模型
- `packages/config`
  - TS 通用配置与 workspace 配置基座

### `python/`
Python 侧领域、适配器、profile 与 workflow。

- `python/core`
  - 领域模型
  - Protocol 接口
  - RuntimeContainer 类型定义
- `python/adapters`
  - storage、query、metadata、table、search、compute、auth 的具体 provider 实现
- `python/profiles`
  - YAML profile 加载
  - runtime container 装配
- `python/workflows`
  - ingestion 逻辑
  - 资产物化逻辑
  - demo pipeline 工具

### `sdk/`
统一数据访问出口 SDK。

- `sdk/python`
  - 最小 Python SDK，支持 datasets、exports、ingestion、search preview

### `infra/`
环境与运行时配置。

- `infra/profiles`
  - `local-dev.yaml`
  - `team-dev.yaml`
  - `enterprise-saas.yaml`

### `examples/`
用于本地学习与端到端验证的 demo 数据。

### `data/`
本地运行时输出目录。

典型内容包括：

- DuckDB 文件
- Parquet 物化表
- Lance 索引
- metadata 数据库
- export 输出文件

## 首版必须创建的部分

首版 MVP 必须具备：

- `apps/web`
- `apps/api`
- `apps/orchestrator`
- `packages/schemas`
- `packages/config`
- `packages/contracts`
- `packages/profiles`
- `python/core`
- `python/adapters`
- `python/profiles`
- `python/workflows`
- `infra/profiles`
- `examples/`
- `data/`
- `sdk/python`
- `docs/`

## 预留扩展部分

这些能力应作为未来扩展点保留，而不是首版强行落地：

- 高级多租户服务
- 企业版专属部署模块
- 生产级认证服务
- 大规模流式接入服务
- 完整标注平台模块
- 高级治理与审计服务

## 为什么这样拆分

这个结构将：

- 产品入口放在 `apps/`
- 跨应用共享 TS contract 放在 `packages/`
- 运行时与领域逻辑放在 `python/`
- 环境选择放在 `infra/`
- 外部用户访问出口放在 `sdk/`

这样的划分很适合当前“本地易跑 + 后续企业可演进”的 monorepo 目标。
