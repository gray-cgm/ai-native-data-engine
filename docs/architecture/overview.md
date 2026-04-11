# 总体架构说明

`AI Native Data Engine` 是一个面向自动驾驶 / 机器人数据闭环的平台型 monorepo。它从“本地优先”的个人开发版 MVP 起步，通过稳定的抽象层逐步演进到团队版和企业版，而不是中途再拆出第二套系统。

整体架构分为四层：

1. **Ingestion（数据接入层）**
   - 接入本地或远端的原始数据资产，例如图像、JSON metadata、点云、轨迹、日志等。
   - 将异构数据源结构归一化为统一的数据资产模型。
   - 保留原始文件作为事实来源（source of truth）。

2. **Pipeline（资产编排层）**
   - 使用 **Dagster** 以 asset-oriented 的方式表达数据物化、转换、索引、导出和血缘。
   - 关注的是“资产生命周期”，而不只是某个脚本有没有执行完成。

3. **Lakehouse / DataLake（数据访问层）**
   - 在原始文件之上构建类数据库（DB-like）的数据访问层。
   - 本地 MVP 使用 **Parquet + DuckDB + Lance + SQLite**。
   - 未来企业版可以演进到 **Iceberg/Paimon + StarRocks + Flink/Spark/Fluss + Lance**。
   - 切换通过 adapter 和 profile 边界完成，而不是通过产品重写完成。

4. **Platform（平台访问层）**
   - 提供面向用户的工作台访问层、Platform API，以及后续可独立演进的调度/查询服务入口。
   - 当前 MVP 重点覆盖 datasets、versions、tasks、workspaces、search preview、exports 和基础 operations API。
   - 这一层在实现上进一步拆成 Experience Access（Web + BFF）、Platform API（FastAPI）以及未来可独立部署的 scheduler/query services。
   - 完整协作、多租户治理、复杂 RBAC、生产级标注系统等能力当前刻意延后。

## 核心设计原则

### 1. 数据模型优先
系统围绕数据资产组织，而不是围绕文件路径，更不是围绕某个基础设施产品组织。

核心资产主线：

```text
Raw Data
-> RawRecord
-> Sample
-> Dataset
-> DatasetVersion
-> JobRun
-> ExportJob
-> LineageEvent
```

### 2. 按访问模式分层
不同访问模式由不同 adapter 负责：

- `MetadataAdapter`
- `QueryAdapter`
- `SearchAdapter`
- `TableAdapter`
- `StorageAdapter`
- `ComputeAdapter`
- `AuthAdapter`

这样既能保持本地 MVP 足够轻量，也能保留未来企业版的演进路径。

### 3. 资产导向编排
Dagster 在这里用于建模 dataset、distribution、export、lineage 等资产及其依赖关系，而不是只作为“脚本调度器”。

### 4. 本地优先、可演进实现
项目明确从“一台笔记本可启动”的配置开始：

- local filesystem 负责底层存储
- SQLite 负责 metadata
- Parquet 负责表层物化
- DuckDB 负责本地分析与查询加速
- Lance 负责样本检索与索引

这样既保证首版真正可运行，也保证未来升级时系统边界不被推翻。

## Platform 层内部边界

当前推荐的访问路径是：

```text
Web
-> BFF
-> Platform API
-> RuntimeContainer / adapters
```

其中跨语言共享的核心不是直接复用 Python 代码，而是通过 Platform API 暴露稳定的 HTTP / JSON contract，让 Node.js BFF 与 Python 平台层共享同一套资源语义、字段结构与状态约定。

其中：

- `apps/web` 负责 UI 呈现
- `apps/bff` 负责浏览器请求接入、页面聚合、会话与权限上下文，以及把平台 contract 编排成前端友好的 ViewModel
- `apps/api` 负责稳定的平台资源语义、Platform API contract，以及 Python SDK / 自动化集成访问
- 未来如查询协调或批任务调度演进为独立常驻服务，应作为独立 app/service 部署，而不是继续挤进 BFF 或 route handler

BFF 不拥有底层数据资产事实，也不直接持有 runtime provider；平台 domain 事实、workflow 触发、query/search/export 等能力仍由 Platform API 与其背后的 Python runtime 负责。

这里的关键边界是：

- `apps/api` 是 Platform API / query-control plane 的外部入口层
- `python/core` 负责领域模型、接口定义、capability contracts，不负责常驻服务生命周期
- `python/adapters` 负责 DuckDB、Lance、SQLite、filesystem 等具体实现
- `python/workflows` 与未来可新增的 `python/services` 负责查询编排、导出编排、调度编排等应用服务逻辑

因此，批任务调度服务不应放在 `python/core`；如果后续需要独立调度服务，更合理的方向是 `apps/scheduler` + `python/services/scheduler`（或 `python/workflows/scheduler`）的组合。

## 当前运行时机制

当前代码通过以下机制装配运行时：

- `RuntimeContainer`
- `infra/profiles/local-dev.yaml` 等 YAML profile
- `python/adapters` 中的具体 provider 实现
- `python/profiles` 中的 profile resolver

这使得 Platform API、workflow、Dagster definitions 依赖的是运行时能力，而不是 DuckDB / SQLite / Lance / local fs 这些具体实现。BFF 通过调用 Platform API 间接使用这些能力，而不直接与底层 provider 耦合。
