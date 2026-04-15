# 个人版 vs 企业版分层对比

## 分层对比表

| 层 | 个人版 / 本地 MVP | 团队版 / 企业版演进 |
|---|---|---|
| Ingestion | 本地目录接入、图像 + JSON demo、简单 manifest | 多数据源接入、对象存储、流式 / 事件源、更完整的 schema 治理 |
| Pipeline | 基于 Dagster 的本地 asset-oriented 编排 | 带 schedule、sensor、partition、团队协作与更强治理能力的 Dagster |
| Storage | local filesystem | S3 / MinIO / OSS / HDFS 等对象或分布式存储 |
| Table Format | 裸 Parquet 文件集 | Iceberg / Paimon / Hudi 管理的湖表 |
| File Format | 当前主格式 Lance，Parquet 仅作为同类兼容格式理解 | 继续在 Lance 主线上演进，并由更上层管理与访问方式承载 |
| Query | DuckDB 查询本地 Parquet / Lance 衍生结果 | StarRocks / Trino / DuckDB 等面向湖表的查询服务 |
| Compute | 本地 Python / 本地 Dagster 执行 | Flink / Spark / Fluss / 分布式批流计算 |
| Application | 本地 workbench、search preview、导出与基础运营入口 | BI、挖掘检索、标注、需求管理、多角色工作台 |
| 元数据与事务控制层 | SQLite | Postgres 或服务化元数据与事务控制层 |
| Auth | 本地 auth stub | OIDC / SSO / 面向租户的认证体系 |
| Platform | 单用户本地 workbench | 多用户 SaaS 工作台、审批、治理、配额、审计 |
| Export | 本地文件导出：Lance / CSV / JSONL | 受治理的导出、签名访问、大规模异步交付 |

## 为什么它们仍然是一套系统

本项目不会把个人版和企业版拆成两套完全独立的仓库。
相反，它们共享：

- 同一套领域模型
- 同一套 adapter contracts
- 同一套 runtime container 模式
- 同一套 profile 驱动配置模型
- 同一套以 Web -> BFF -> Platform API 为基础的访问分层思路

真正变化的主要是 provider 选择和部署拓扑，而不是业务主干。

## 稳定抽象边界

当前抽象策略围绕这些接口展开：

- `StorageAdapter`
- `QueryAdapter`
- `ComputeAdapter`
- `MetadataAdapter`
- `SearchAdapter`
- `TableAdapter`
- `AuthAdapter`

这使得下面这些演进成为可能：

- 底层对象存储：local fs -> S3 / MinIO / OSS / HDFS
- 湖表格式：本地裸 Parquet 文件集 -> Iceberg / Paimon / Hudi
- 查询引擎：DuckDB -> StarRocks / Trino
- 计算层：local Python / Dagster -> Spark / Flink / Fluss
- Metadata 存储：SQLite -> Postgres

同时不需要推翻 Platform API、workflow 和核心领域模型；BFF 作为 app-facing 层可以随业务场景继续演进，但不应重写平台底座。

## 实际上的区别

### 个人版重点优化
- 一台笔记本即可启动
- 安装和依赖成本低
- 适合本地学习和跑通 demo 主链路
- 系统边界正确
- 能看到端到端的数据资产生命周期

### 企业版重点优化
- 多用户协作
- 更大数据规模和更高并发
- 更强的治理与血缘
- 分布式执行
- 服务化、组织级控制与运维能力
- 面向多 app 的 BFF 分层与更稳定的前后端协作边界

## 建议

不要把个人版当作一次性原型，而应把它看作“第一层真正可落地的产品形态架构”。本地栈可以轻，但必须从第一天就区分存储、湖表、文件格式、计算、查询、检索和 metadata 这些概念，否则后续企业化演进会在认知层先失真。
