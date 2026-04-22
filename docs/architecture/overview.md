# 总体架构说明

`AI Native Data Engine` 是一个面向自动驾驶 / 机器人数据闭环的平台型 monorepo。它从“本地优先”的个人开发版 MVP 起步，通过稳定的抽象层逐步演进到团队版和企业版，而不是中途再拆出第二套系统。

整体上需要分成两种视角来理解：

1. **业务流程视角**
   - Ingestion：接入本地或远端原始数据资产，例如图像、JSON metadata、点云、轨迹、日志等。
   - Pipeline：使用 Dagster 等编排能力表达数据物化、转换、索引、导出和血缘。
   - Application：把数据能力组织成工作台、BI、挖掘检索、标注、需求管理等面向角色的产品能力。

2. **系统分层视角**
   - **文件格式层**：Parquet / Lance / Mcap / Lerobot，属于同类文件格式组件；当前主格式为 Lance。
   - **存储层**：local fs / S3 / MinIO / OSS / HDFS，决定文件和对象存放位置。
   - **湖表格式层**：Iceberg / Paimon / Hudi，决定表快照、schema 演进、分区和事务语义。
   - **计算层**：local Python / Dagster / Spark / Flink / Fluss，决定 ingestion、物化、批流处理与编排如何执行。
   - **查询层**：DuckDB / Trino / StarRocks，决定聚合、过滤、分析查询如何读取数据。
   - **应用层**：BI、挖掘检索、标注、需求管理、工作台等，决定最终用户怎样消费平台能力。

## 统一架构表

| 层级 | 核心职责 | 代表技术 | 当前 local-first MVP |
|---|---|---|---|
| 文件格式层 | 定义数据如何编码、落盘与索引表达 | Parquet / Lance | 当前主格式 Lance |
| 存储层 | 保存原始文件、导出文件与对象数据 | local fs / S3 / MinIO / OSS / HDFS | local fs |
| 湖表格式层 | 管理表快照、schema 演进、分区与事务语义 | Iceberg / Paimon / Hudi | 预留演进方向，当前仍是裸文件集 |
| 计算层 | 执行 ingestion、物化、编排、批流处理 | local Python / Dagster / Spark / Flink / Fluss | local Python + Dagster |
| 查询层 | 提供 SQL 查询、聚合、交互式分析读取能力 | DuckDB / Trino / StarRocks | DuckDB |
| 应用层 | 组织面向角色的产品入口与工作流体验 | BI / 挖掘检索 / 标注 / 需求管理 / 工作台 | Web + BFF + FastAPI + SDK |

当前 local-first MVP 的现实组合是：**local fs 存储 + Lance 主文件格式 + local Python/Dagster 计算 + DuckDB 查询 + Web/BFF/API 应用访问 + SQLite 元数据与事务控制层**。

SQLite 不属于上述六层中的 lakehouse 主层，更接近独立的元数据与事务控制层。未来切换到底层对象存储、湖表格式、计算引擎、查询引擎时，应通过 adapter 和 profile 边界完成，而不是通过产品重写完成。

### 技术归属速查表

| 技术 / 组件 | 所属层 | 说明 |
|---|---|---|
| local fs / S3 / MinIO / OSS / HDFS | 存储层 | 保存原始文件、导出文件与对象数据 |
| Iceberg / Paimon / Hudi | 湖表格式层 | 存算分离，提供统一、廉价、可靠的数据存储，并通过表格式提供ACID和元数据管理能力 |
| Parquet | 文件格式层 | 与 Lance 同类的列式文件格式，可作为兼容/历史格式理解 |
| Lance | 文件格式层 | 当前主结构化与检索文件格式 |
| local Python / Dagster / Spark / Flink / Fluss | 计算层 | 执行 ingestion、物化、编排与批流处理 |
| DuckDB / Trino / StarRocks | 查询层 | 提供 SQL 查询、聚合和分析读取能力 |
| SQLite / Postgres | 元数据与事务控制层 | 记录数据集、版本、任务、导出、血缘、权限、审计等状态 |
| Web / BFF / FastAPI / SDK / BI / 标注工作台 | 应用层 | 面向角色提供工作流入口与产品体验 |

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
- Parquet / Lance 属于同类文件格式组件；当前主格式是 Lance
- local Python / Dagster 负责本地计算与编排
- DuckDB 负责本地分析与查询加速
- SQLite 负责元数据与事务控制层
- Web / BFF / Platform API 负责应用访问层

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
