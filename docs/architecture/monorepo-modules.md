# Monorepo 模块划分

## 目录树

```text
docs/
apps/
  api/
  bff/
  orchestrator/
  scheduler/      # placeholder for future service
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
  services/       # placeholder for future service layer
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
- `apps/bff`
  - Node.js + TypeScript BFF
  - 面向浏览器请求、页面聚合、会话与权限上下文
  - 消费 Platform API contract，并输出前端友好的 app-facing ViewModel
- `apps/api`
  - FastAPI Platform API
  - 提供 datasets、tasks、workspaces、exports 与 sample operations 等平台资源路由
  - 作为 query / export / control plane 的外部入口层，而不是吞下全部执行编排逻辑
- `apps/orchestrator`
  - Dagster 项目
  - 定义资产物化与衍生输出相关的 assets
- `apps/scheduler`（目录已预留）
  - 未来独立批任务调度服务入口
  - 当前只保留目录占位，不声明为已实现可运行服务

### `packages/`
TypeScript 侧共享包。

- `packages/schemas`
  - UI 和 TS 集成层共用的数据结构定义
- `packages/contracts`
  - Node/Web 侧共享 contract 与 API schema 演进落点
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
  - capability contracts
  - 不承载 scheduler server、调度 loop、callback handler 等常驻服务职责
- `python/adapters`
  - storage、query、metadata、table、search、compute、auth 的具体 provider 实现
- `python/profiles`
  - YAML profile 加载
  - runtime container 装配
- `python/workflows`
  - ingestion 逻辑
  - 资产物化逻辑
  - demo pipeline 工具
  - 当前阶段也可承载部分 query/export/scheduler orchestration
- `python/services`（目录已预留）
  - 未来沉淀 query、export、scheduler 等应用服务层
  - 当前只保留最小 package 骨架，不迁移现有 `python/workflows` 逻辑

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
- `apps/bff`
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
- 浏览器相关的后端编排逻辑放在 `apps/bff`，而不是塞进 `apps/web`
- 稳定的平台资源 API 放在 `apps/api`，避免与 BFF 混层
- 查询协调、导出协调、调度推进等应用服务逻辑放在 `python/workflows` 或未来的 `python/services`，而不是直接堆在 route handler 里
- `python/core` 保持为领域模型与接口边界，而不是承载 scheduler server 等常驻进程
- 跨应用共享 TS contract 放在 `packages/`
- 运行时与领域逻辑放在 `python/`
- 环境选择放在 `infra/`
- 外部用户访问出口放在 `sdk/`

这样的划分很适合当前“本地易跑 + 后续企业可演进”的 monorepo 目标，也更容易吸收 FDL 这类项目中 management / query / scheduler 分层清晰的优点。
