# FDL 融合设计说明

## 目的

`file_data_lake`（FDL）项目的价值不在于直接照搬它的目录，而在于吸收它对 management、query、scheduler 三类服务的清晰分层，以及对共享 layout / data access 基础层的重视。

本说明用于回答两个问题：

1. FDL 的优秀设计在 `ai-data-loop-engine` 中应该如何映射？
2. 哪些边界适合现在就吸收，哪些能力应该作为后续演进方向保留？

## FDL 的三个核心服务如何映射

### 1. Management service -> `apps/web` + `apps/bff`

FDL 的 management service 同时承担：

- 管理后台 API
- 前端静态资源服务
- 面向管理操作的入口

在 `ai-data-loop-engine` 中，更适合拆成：

- `apps/web`：React 管理后台前端
- `apps/bff`：Node.js + TypeScript BFF

这样做的原因是：

- 当前仓库已经明确采用前后端分离
- BFF 更适合承接页面聚合、浏览器上下文、前端友好 ViewModel
- 不需要把 app-facing 逻辑继续压进 `apps/api`

因此，FDL 的 management 思路在本项目中不应被实现成“一个服务里同时塞前端和管理 API”，而应被实现成“`apps/web` + `apps/bff` 共同组成 management access layer”。

### 2. Query service -> `apps/api` + Python service/workflow layer

FDL 的 query service 并不只是一个 HTTP/gRPC 壳。它背后还有：

- query coordinator
- 请求解析与执行编排
- 输出组织
- 对底层 layout 和 DAO 的调用

因此，在本项目中不应简单理解为“query service = `apps/api`”。

更准确的映射是：

- `apps/api`
  - 作为 Platform API / query-control plane 的外部入口
  - 负责稳定资源语义、参数校验、响应协议、自动化访问、SDK 访问
- `python/core`
  - 提供 query/search/export/task 等领域接口与 capability contracts
- `python/adapters`
  - 提供 DuckDB、Lance、SQLite、filesystem 等具体实现
- `python/workflows` 或未来的 `python/services`
  - 负责 query orchestration、search orchestration、export orchestration 等应用服务逻辑

这样可以避免把执行编排、结果拼装、多 adapter 协调全部堆进 FastAPI route handler。

### 3. Scheduler service -> 独立服务，而不是 `python/core`

FDL 的 scheduler service 有明显的独立服务特征：

- 独立 server 入口
- 生命周期管理
- 后台调度循环
- callback API
- resource manager
- 任务触发与状态推进

这些职责都不适合放进 `python/core`。

在 `ai-data-loop-engine` 中，推荐原则是：

- `python/core` 只放领域模型、接口定义、contracts、capabilities
- 调度相关的应用服务逻辑放在 `python/workflows/scheduler` 或未来的 `python/services/scheduler`
- 如果需要独立进程与外部 API，再新增 `apps/scheduler`

推荐演进路径：

### 当前阶段

- 继续以 `apps/orchestrator` + `python/workflows` 承接资产编排与批处理能力
- 若出现更明确的常驻调度循环需求，可先在 Python 侧增加 `scheduler` 子模块

### 中期阶段

在当前已预留目录骨架的基础上，逐步补齐：

- `apps/scheduler` 的真实服务入口
- `python/services/scheduler`

让调度服务成为真正独立的服务边界，而不是继续向 `python/core` 膨胀。

## FDL 中值得吸收的三个设计点

### 1. 统一 layout/path abstraction

FDL 的一个重要优点是将路径与目录布局规则集中管理，而不是分散在查询、任务、输出逻辑中。

本项目后续也建议引入统一 layout 抽象，用于管理：

- raw dataset path
- dataset version table path
- search index path
- export output path
- task artifact path
- mining result path
- labeling / ops 相关产物路径

这样可以避免路径规则散落在：

- API route
- workflow script
- adapter implementation
- export logic

### 2. 共享 metadata/data access 基础层

FDL 的 management、query、scheduler 三类服务共享同一套基础数据访问能力。

本项目对应的正确方向不是复制 DAO 形式本身，而是确保：

- `apps/api`
- `apps/orchestrator`
- 未来的 `apps/scheduler`
- BFF 间接依赖的平台能力

都通过统一 runtime container、metadata/query/search/export services 访问底层，而不是各自绕过抽象层直接操作 SQLite、DuckDB 或 filesystem。

### 3. service 和 core 的边界清晰

FDL 最值得吸收的思想之一是：

- service 是 service
- shared library 是 shared library
- 常驻服务生命周期不要塞进 core

这对本项目后续扩展需求管理、采集运营、标注、挖掘等 app 很重要。

未来即使增加多个 app-facing service，也应共享：

- `python/core`
- `python/adapters`
- `python/profiles`
- `packages/contracts`
- `packages/profiles`

而不是把所有 service entrypoint 和后台循环都挤进同一个 core 包。

## 推荐目录落位

```text
apps/
  web/            # 管理后台前端
  bff/            # 管理后台 BFF / app-facing API
  api/            # Platform API / query-control plane entry
  orchestrator/   # Dagster pipelines / asset orchestration
  scheduler/      # placeholder: 独立批任务调度服务目录已预留

python/
  core/           # 领域模型、接口、contracts、capabilities
  adapters/       # SQLite / DuckDB / Lance / FS 等实现
  workflows/      # ingestion/query/index/export/scheduler flows
  services/       # placeholder: query/scheduler/export service layer 骨架已预留
  profiles/       # runtime/profile/capability resolution

sdk/
  python/         # 对外 SDK
```

## 当前结论

当前阶段的推荐结论是：

- 管理后台服务：`apps/web` + `apps/bff`
- 查询引擎服务：`apps/api` 作为入口层，真正能力落在 Python service/workflow/adapter 组合层
- 批任务调度服务：不要放 `python/core`；应放在 `python/workflows` 或未来 `python/services`，必要时新增 `apps/scheduler`

这条路径既保持了当前 MVP 的轻量实现，也为未来吸收 FDL 式的 service decomposition 留出了自然演进空间。
