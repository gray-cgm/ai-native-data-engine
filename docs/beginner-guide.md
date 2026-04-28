# AI Native Data Engine Beginner Guide

> 面向初学者的个人开发版入门文档
> 主题：如何在一台笔记本上，从 0 到 1 理解并运行一个面向自动驾驶数据闭环的本地 DataLake 工作台

---

# 1. 这是什么项目？

`AI Native Data Engine` 是一个面向自动驾驶 / 机器人场景的数据闭环 mono repo。

它的目标不是一开始就做成重型企业平台，而是先做一个：

- 能在本地跑起来
- 能帮助初学者理解数据平台
- 能逐步扩展到团队版 / 企业版
- 具有正确数据系统边界

的个人开发版 MVP。

这个项目围绕六层架构组织：

1. **文件格式层**：Parquet / Lance / Mcap / Lerobot，同类文件格式，当前主格式为 Lance
2. **存储层**：local fs / S3 / MinIO / OSS / HDFS
3. **湖表格式层**：Iceberg / Paimon / Hudi
4. **计算层**：local Python / Dagster / Spark / Flink / Fluss
5. **查询层**：DuckDB / Trino / StarRocks
6. **应用层**：BI、挖掘检索、标注、需求管理、工作台等

它不是一个“文件堆 + 脚本集合”，而是一个：

> 在存储层、格式层、计算层、查询层之上，逐步长出应用层能力的数据平台。

---

# 2. 为什么要做这个项目？

很多自动驾驶 / 机器人项目在初期都会遇到类似问题：

- 原始数据散落在本地磁盘、NAS、OSS 中
- 图像、点云、轨迹、日志、标注各有自己的目录结构
- metadata 大量使用 JSON
- 查询慢、复用难、路径混乱
- 不知道一个数据集版本是怎么来的
- 用户只能拿底层文件路径或存储密钥直接访问数据

这些问题在项目还小的时候不明显，但当数据量开始增长、用户开始增加、任务开始并发时，系统会迅速失控。

因此，我们希望搭建一个最小但正确的系统，解决以下问题：

## 目标 1：统一数据资产入口
系统应能统一管理自动驾驶领域的核心数据资产，而不是让不同人靠目录约定和脚本各自维护。

## 目标 2：统一数据资产出口
系统应通过 SDK / API 提供数据访问，而不是让用户直接拿底层存储路径、OSS 账号或数据库连接去读写。

## 目标 3：加速查询和访问
通过列式存储、查询下推、索引等方式，提高数据访问效率。

## 目标 4：逐步治理存储格式
原始 JSON 可以保留，但分析和访问路径要逐步转成 Parquet 等更适合查询的格式。

---

# 3. 你会学到什么？

完成这个项目之后，你会理解：

- 为什么 DataLake 不等于“文件都放一起”
- 为什么数据平台要先设计统一数据资产模型
- 为什么 JSON 适合作为入口格式，但不适合作为主查询格式
- 为什么 DuckDB + Parquet 非常适合个人开发版
- 为什么 asset-oriented pipeline 比单纯 task/job 更适合数据平台
- 为什么即使是本地 MVP，也应该有 adapter / profile / runtime container
- 为什么元数据、分析查询、检索、导出应该拆开设计

更重要的是，你会获得一套符合《Designing Data-Intensive Applications 2nd Edition》思路的实践心智：

> 先理解数据模型、访问模式和系统边界，再选择技术实现。

---

# 4. 这个项目的设计理念

这个项目吸收了《Designing Data-Intensive Applications 2nd Edition》中的几个核心思想。

## 4.1 数据模型优先
不要先问“用什么数据库”，而是先问：

- 你要管理什么数据资产？
- 用户是怎么访问这些资产的？
- 哪些是高频查询？
- 哪些是检索？
- 哪些是导出？
- 哪些是元数据？

在这个项目里，我们统一围绕下面这条主线组织：

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

---

## 4.2 访问模式分层
不同访问模式应交给不同层处理：

- **Metadata**：数据集、版本、任务、导出记录
- **Query**：分布统计、过滤查询、分析聚合
- **Search**：相似检索、基础样本搜索
- **Table**：列式样本表、导出表
- **Storage**：底层文件和对象访问

这就是为什么我们在 MVP 阶段就区分了：

- `MetadataAdapter`
- `QueryAdapter`
- `SearchAdapter`
- `TableAdapter`
- `StorageAdapter`
- `ComputeAdapter`

如果映射到更完整的系统分层，可以这样理解：

- **文件格式层**：负责数据如何编码，例如 Parquet、Lance；它们属于同类文件格式组件，当前主格式为 Lance
- **存储层**：负责文件和对象放在哪里，例如 local fs、S3、MinIO、OSS、HDFS
- **湖表格式层**：负责表快照、schema 演进、分区和事务语义，例如 Iceberg、Paimon、Hudi
- **计算层**：负责 ingestion、物化、编排、批流处理如何执行，例如 local Python、Dagster、Spark、Flink、Fluss
- **查询层**：负责 SQL 查询、聚合、交互式分析如何读取数据，例如 DuckDB、Trino、StarRocks
- **应用层**：负责把底层能力组织成面向角色的产品体验，例如 BI、挖掘检索、标注、需求管理、工作台

---

## 4.3 资产导向，而不是脚本导向
在这个项目里，Pipeline 用的是 **Dagster**，但重点不是“写几个 job”，而是：

> 用 asset-oriented 的方式表达数据资产的生成、变换和依赖关系。

这很重要，因为在自动驾驶场景中，真正需要被管理的是：

- 一个 dataset 是否已生成
- 一个 distribution asset 是否已更新
- 一个 dataset version 是否可复现
- 一个 export 是否已经完成

而不仅仅是“脚本跑没跑完”。

---

## 4.4 可演进，而不是一步到位
个人版系统不应该一开始就上重型基础设施。
但如果一开始把边界设计错了，后面升级就会非常痛苦。

所以这个项目采用的是：

- **本地实现轻量**
- **接口抽象稳定**
- **未来基础设施可替换**

也就是：

- 个人版用 DuckDB 作为本地查询引擎，不代表未来不能切 StarRocks 这类分布式查询引擎
- 个人版直接写裸 Parquet 文件，不代表未来不能演进到由 Iceberg / Paimon / Hudi 管理的湖表层
- 个人版用 SQLite 作为 metadata 存储，不代表未来不能切 Postgres
- 个人版用 local fs 作为底层文件存储，不代表未来不能切 S3 / MinIO / OSS / HDFS

---

# 5. 项目整体结构

项目是一个 mono repo，同时容纳 TypeScript 和 Python。

## 顶层目录概览

```text
apps/
packages/
python/
sdk/
infra/
examples/
data/
```

## 目录职责

### `apps/`
应用入口：

- `apps/web`：工作台前端
- `apps/bff`：Node.js + TypeScript BFF，负责页面场景聚合、前端友好接口、会话与权限上下文
- `apps/api`：FastAPI Platform API，负责平台资源与控制面能力
- `apps/orchestrator`：Dagster OSS user code project / 资产编排入口

### `packages/`
TypeScript 共享包：

- schema
- contract
- profile
- config

### `python/`
Python 核心实现：

- `core`：领域模型和接口
- `adapters`：具体实现
- `workflows`：数据工作流
- `profiles`：profile resolver

### `sdk/`
统一数据访问出口，目前包含最小 Python SDK。

### `infra/`
profile 配置与本地运行环境。

### `examples/`
本地 demo 数据。

### `data/`
本地产生的 DuckDB、Parquet、Lance、metadata、export 文件。

---

# 6. 当前个人开发版 MVP 包含什么？

当前个人版 MVP 已具备以下能力：

## 已支持
- 本地目录数据导入
- 图像 + JSON metadata ingestion
- 统一样本物化
- Dagster asset-oriented pipeline
- DuckDB 查询
- Lance 基础检索
- SQLite 元数据存储
- FastAPI Platform API
- Node.js + TypeScript BFF
- 数据集 / 版本 / 任务 / 工作空间 / 导出 API
- Web 工作台
- Parquet / CSV / JSONL 导出
- Python SDK 最小访问能力

## 当前刻意不做
- 完整标注系统
- 分布式计算
- 企业级对象存储
- 真正的 StarRocks / Iceberg / Paimon 集成
- 完整多租户隔离
- 复杂 RBAC / SSO

这是一个“正确但轻量”的 MVP，而不是一个空谈企业架构的 demo。

---

# 7. 统一数据资产模型

理解这个项目，最重要的是理解它不是围绕“文件路径”组织的，而是围绕“数据资产”组织的。

## 7.1 Sample
`Sample` 是系统内部最小的统一样本单元。

它来自于：

- 图像文件
- JSON metadata
- 后续可扩展到点云、轨迹、视频等

它是分析、检索、导出的基础对象。

---

## 7.2 Dataset
`Dataset` 是逻辑数据集对象。
表示一组被平台统一管理的数据。

---

## 7.3 DatasetVersion
`DatasetVersion` 是数据集快照版本。

这非常关键，因为它让你能回答：

- 当前工作台看到的是哪一版数据？
- 训练到底用了哪一版？
- 这个版本对应的表是什么？
- 这个版本能不能导出？

---

## 7.4 JobRun
记录任务运行实例。

例如：

- ingestion run
- materialization run
- export run

---

## 7.5 ExportJob
表示导出请求和导出结果。

目前支持：

- Parquet
- CSV
- JSONL

---

## 7.6 LineageEvent
记录版本和任务之间的血缘事件。

即使是个人版 MVP，也应该从第一天开始保留最小血缘对象，这会帮助你建立正确的数据系统习惯。

---

# 8. 本地 DataLake 是怎么组成的？

个人开发版采用的是一个非常轻量但合理的技术组合。

## 8.1 Local Filesystem
存放原始数据和本地输出文件。

它是事实层，不负责高级查询。

这一层属于**存储层**。

---

## 8.2 Parquet
承载结构化样本表。

为什么要有 Parquet？

因为原始 JSON 不适合作为主查询格式。
Parquet 是列式文件格式，更适合：

- 查询加速
- 列裁剪
- 后续导出
- 未来作为 Iceberg / Paimon 等湖表格式的底层数据文件之一

这一层属于**文件格式层**，不是查询层，也不是湖表格式层。当前本地 MVP 的主结构化文件格式是 Lance，Parquet 主要作为同类兼容格式理解。

---

## 8.3 DuckDB
本地查询层。

它负责：

- scene distribution
- 基础统计
- 本地分析

DuckDB 特别适合个人版，因为：

- 不需要独立服务
- 本地就能跑
- 对 Parquet 支持很好
- 上手成本低

这一层属于**查询层**。

---

## 8.4 Lance
检索与索引层。

它负责：

- 基础检索
- 向量/样本索引
- search preview

个人版里先做最小能力，后续可以继续增强。

在这套分层里，Lance 与 Parquet 属于同类文件格式组件；当前主线已经切到 Lance，而真正面向用户的“搜索体验”属于上层应用能力。

---

## 8.5 SQLite
元数据与事务控制层。

它负责：

- workspaces
- datasets
- dataset_versions
- job_runs
- tasks
- export_jobs
- lineage_events

为什么不是一开始就上重型数据库？

因为个人版最重要的是：

- 一台笔记本可启动
- 安装简单
- 可跑通主路径

SQLite 很适合这个阶段。
但因为我们已经通过 `MetadataAdapter` 抽象，所以未来切 Postgres 不需要推翻业务逻辑。

SQLite 不属于上面五个 lakehouse 主层，而更接近独立的 **元数据与事务控制层**。

---

# 9. Adapter / Profile / RuntimeContainer 是什么？

这是这个项目最关键的可演进机制。

## 9.1 Adapter
定义某一类能力的具体实现，比如：

- `DuckDBQueryAdapter`
- `SQLiteMetadataAdapter`
- `ParquetTableAdapter`
- `LanceVectorAdapter`
- `LocalFileStorageAdapter`

---

## 9.2 Profile
定义某个运行环境应该使用哪组 adapter。

例如：

- `local-dev`
- `team-dev`
- `enterprise-saas`

---

## 9.3 RuntimeContainer
把当前 profile 下的所有能力统一装配起来。

在 `local-dev` 下，目前容器里会有：

- storage = local fs
- metadata = sqlite
- query = duckdb
- table = parquet
- search = lance
- compute = local dagster
- auth = local auth

把它翻译成更严格的分层语言，就是：

- 存储层 = local fs
- 文件格式层 = Parquet / Lance（当前主格式 Lance）
- 查询层 = DuckDB
- 计算层 = local Python / Dagster
- 元数据与事务控制层 = SQLite
- 应用层 = Web / BFF / Platform API / SDK 提供的工作台、检索预览、导出、运营入口

这样 Platform API、workflow、Dagster 都不需要直接依赖底层实现。BFF 通过调用 Platform API 间接使用这些能力，而不直接持有底层 runtime provider。

---

# 10. 数据是怎么流动的？

当前 MVP 的数据流大致如下：

```text
Local image/json files
-> ingestion
-> SampleRecord
-> Lance files
-> DuckDB query
-> Dataset / DatasetVersion metadata
-> Platform API
-> BFF / Web / SDK / Export / Search experience
```

这就是个人版在“存储/格式/计算/查询/应用”之间的最小闭环。

---

# 11. 为什么 JSON 不是长期查询主格式？

这是很多初学者最容易忽略的一点。

## JSON 适合什么？
- 采集入口
- 原始保留
- 非结构化/半结构化记录
- 调试与追溯

## JSON 不适合什么？
- 大规模分析查询
- 列裁剪
- 高效聚合
- 作为稳定的数据产品层

所以这个项目采用的策略是：

> JSON 作为入口格式保留，但结构化分析层尽快转成 Parquet。

这可以显著改善：

- 查询性能
- 存储成本
- 导出能力
- 后续表层治理能力

---

# 12. 快速开始

## 12.1 准备环境

需要：

- Node.js 20+
- pnpm 10+
- Python 3.11+
- uv

安装 uv：

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

---

## 12.2 安装依赖

```bash
cp .env.example .env
make install
```

---

## 12.3 启动服务

建议开 4 个终端分别启动。

### Web
```bash
make dev-web
```

### BFF
```bash
make dev-bff
```

### API
```bash
make dev-api
```

### Dagster（本地单进程开发）
```bash
make dev-dagster
```

### Dagster OSS Docker Compose 部署
```bash
make compose-dagster
```

该模式会启动 Dagster OSS 的三个服务：

- `dagster-user-code`
- `dagster-webserver`
- `dagster-daemon`

其中 `apps/orchestrator` 作为 Dagster code location，通过 gRPC 暴露给 webserver / daemon。

如果你准备专项开发 `apps/*`，推荐先一键启动所有容器化依赖：

```bash
make up-deps
```

该命令会统一启动：

- `postgres`
- `dagster-user-code`
- `dagster-webserver`
- `dagster-daemon`
- `jupyter`
- `superset`

然后你可以在宿主机分别启动：

```bash
make dev-web
make dev-bff
make dev-api
```

默认端口（推荐）：

- Web: `http://localhost:3000`
- BFF: `http://localhost:3100`
- API: `http://localhost:8000/docs`
- Dagster: `http://localhost:3001`

---

# 13. 先跑一遍最小链路

## 13.1 导入 demo 数据并物化资产
```bash
make ingest
```

## 13.2 查询 DuckDB 分布结果
```bash
make query
```

## 13.3 查看 Lance 检索样本索引
```bash
make lance
```

---

# 14. 为什么不让 Web 直连 FastAPI？

因为工作台页面需要的通常不是“原始平台资源”，而是面向页面场景的聚合结果。

BFF 的作用主要有三个：

- 把多个 Platform API 结果拼成前端更容易消费的页面数据
- 承接浏览器侧的 session、权限、tenant 等上下文边界
- 让 Platform API 继续保持稳定的资源语义，便于 SDK 和自动化直接使用

所以推荐的访问路径是：`Web -> BFF -> Platform API`，而不是让浏览器长期直接耦合到底层平台资源接口。

---

# 15. 用 Platform API 验证系统

当前默认验证链路不是抽象的 mock ingest，而是一个真实自动驾驶场景：`Night Intersection VRU Hard-Case Triage`。
它会从样本中筛出夜间行人过街与路口遮挡相关 hard-case，生成可 review、可 export、可 search 的最小 scenario package。

## 15.1 触发场景筛选 / asset materialization
```bash
curl -X POST http://localhost:8000/samples/ingest-demo
```

关注返回里的 `scenario` 字段：

- `scenario_name`
- `priority_sample_ids`
- `focus_scenes`
- `focus_tags`

## 15.2 查看样本分布
```bash
curl http://localhost:8000/samples/distribution
```

## 15.3 查看基础检索预览
```bash
curl http://localhost:8000/samples/search-preview
```

## 15.4 查看 catalog / operations
```bash
curl http://localhost:8000/datasets
curl http://localhost:8000/datasets/demo-dataset
curl http://localhost:8000/datasets/demo-dataset/versions
curl http://localhost:8000/tasks
curl http://localhost:8000/workspaces
curl http://localhost:8000/exports
```

---

# 16. 用 Platform API 验证导出

## 16.1 导出 Parquet
```bash
curl -X POST "http://localhost:8000/exports/dataset/demo-dataset?format=lance"
```

## 16.2 导出 CSV
```bash
curl -X POST "http://localhost:8000/exports/dataset/demo-dataset?format=csv"
```

## 16.3 导出 JSONL
```bash
curl -X POST "http://localhost:8000/exports/dataset/demo-dataset?format=jsonl"
```

输出文件默认会写到：

```bash
./data/exports/demo-dataset-v1.lance
./data/exports/demo-dataset-v1.csv
./data/exports/demo-dataset-v1.jsonl
```

---

# 17. 用 Python SDK 访问系统

目前已经提供最小 Python SDK。

目录：

```text
sdk/python
```

示例能力：

- `ingest_demo()`
- `get_scenario_summary()`
- `list_datasets()`
- `get_dataset(dataset_id)`
- `list_exports()`
- `export_dataset(dataset_id, format='lance')`
- `search_preview()`

你也可以直接运行：

```bash
make sdk-demo
```

---

# 18. Web 工作台里你会看到什么？

当前工作台优先展示这些内容：

- Overview
- Datasets
- Dataset Versions
- Search Preview
- Tasks
- Workspaces
- Exports
- **Requirements（需求管理）**
- **Pipelines（运行事实视图：Overview / Runs / Lineage / Quality / Cost）**

这些都属于**应用层**，不是查询引擎本身。查询引擎只负责把数据读出来，真正的页面、检索体验、导出运营和工作流入口属于上层产品能力。

这符合个人开发版的目标：

- 不做复杂协作平台
- 不做完整标注系统
- 优先把搜索、数据集、任务、工作空间、导出跑通

---

# 19. Dagster 在这个项目里扮演什么角色？

Dagster 在这里不是一个“为了有编排而有编排”的工具。
它的作用是：

- 用 **资产（asset）** 描述数据处理链路
- 让数据生成、分布更新、版本物化具有明确依赖
- 为未来 schedule / sensor / partition 留演进空间
- 作为独立 orchestration control plane 运行，而不是塞进 `apps/api`

在当前仓库里：

- `apps/orchestrator` 是 Dagster OSS user code project / code location
- 本地可用 `make dev-dagster` 进行单进程开发
- 更接近正式部署形态时，可用 `make compose-dagster` 启动 `dagster-webserver + dagster-daemon + dagster-user-code`

从分层上看，Dagster 属于**计算层 / 编排层**，不是查询层，也不是应用层。

因此：

> 我们优先采用 asset-oriented 设计，而不是只写 jobs/tasks。

这对于数据平台尤其重要，因为真正要被管理的不是“脚本”，而是“数据资产”。

---

# 19. 为什么这个个人版系统值得做？

因为它不是一个随手拼起来的 demo，而是一个：

- 本地可运行
- 面向初学者
- 符合数据密集型系统设计理念
- 可以平滑演进到团队版 / 企业版

的练习场。

它会帮助你理解：

- 数据资产建模
- 查询层与元数据层分离
- 为什么导出也是数据平台核心能力
- 为什么文件系统之上也可以建立“类数据库”的访问体验
- 为什么轻量实现和可演进设计可以同时成立

---

# 20. 接下来你应该怎么学？

建议按这个顺序理解项目：

## 第一步：先跑通
只关注：

- 启动服务
- 跑 ingest
- 看 datasets
- 看 query
- 看 search
- 看 export
- 跑 `make req-demo` 创建 Demo 需求，看 requirements 列表

## 第二步：理解数据资产模型
重点看：

- Dataset
- DatasetVersion
- ExportJob
- JobRun
- LineageEvent

## 第三步：理解 adapter / profile / container
重点看：

- `RuntimeContainer`
- `build_container()`
- `local-dev.yaml`
- 各类 adapter

## 第四步：理解未来怎么演进
当你已经理解个人版之后，再去思考：

- 底层存储：local fs -> S3 / MinIO / OSS / HDFS
- 湖表格式：裸 Parquet 文件集 -> Iceberg / Paimon / Hudi
- 文件格式：Parquet 与 Lance 属于同类组件；当前主格式是 Lance，并由更上层的湖表与应用能力管理和消费
- 计算层：local Python / Dagster -> Spark / Flink / Fluss
- 查询层：DuckDB -> StarRocks / Trino
- 应用层：从本地工作台扩展到 BI、挖掘检索、标注、需求管理等多角色系统
- 元数据与事务控制层：SQLite -> Postgres

你会发现，真正重要的是：

> 一开始有没有把系统的边界设计对。

---

# 21. 一句话总结

这个项目想教给你的，不只是怎么用几个工具搭一个 demo，
而是：

> 如何在一台笔记本上，用正确的数据系统思维，搭出一个面向自动驾驶数据闭环的本地 DataLake 工作台。

如果你理解了这件事，后面无论是走向团队版还是企业版，都会自然很多。

---

# 22. 需求管理系统是什么？

前面几节讲的是数据平台的底层能力：采集、物化、查询、检索、导出。
但在真实的自动驾驶项目里，还有一个更上层的问题：

> **数据是怎么来的？谁提出来的？做了哪些任务？最后有没有被验收？**

这就是需求管理系统要解决的问题。

## 22.1 为什么需要需求管理？

在没有系统的情况下，典型的混乱是：

- 算法工程师口头或用飞书提需求，数据团队不清楚哪些在做、哪些做完了
- 采集任务和标注任务各自维护进度，没有统一状态视图
- 数据交付后没有签收流程，"做完了"全靠人工确认
- 遇到模型问题，回溯不了数据需求链路

需求管理系统把这条链路变成可跟踪的结构化流程：

```
需求提出  →  评审打合  →  拆解为数据任务
                              ↓
             采集作业  →  标注任务  →  流水线运行
                              ↓
                         签收交付（Sign-off）
```

## 22.2 核心概念

| 概念             | 说明                                                           |
| ---------------- | -------------------------------------------------------------- |
| **Requirement**  | 由算法/产品/DRE 提出的数据需求，描述需要什么场景的数据         |
| **DataTask**     | 从需求拆解出来的具体数据工作，如采集/标注/流水线               |
| **Sign-off**     | 大数据团队对 DataTask 的审批动作，批准后任务才能进入执行状态   |
| **scene_tags**   | 描述目标场景的标签，如 `["夜间", "十字路口", "VRU"]`           |
| **vehicle_tags** | 适用车型标签，如 `["L4", "乘用车"]`                           |

需求状态流转：

```
draft  →  pending_review  →  approved  →  in_progress  →  completed
                                                        ↘  cancelled
```

Sign-off 状态流转：

```
pending  →  approved  （任务变为 in_progress）
         →  rejected  （任务变为 blocked，等待需求方修改）
```

## 22.3 系统架构与三层设计

需求管理系统遵循项目的标准三层设计：

- **API 层**（FastAPI）：领域逻辑与 SQLite 持久化，路径前缀 `/api/v1/requirements/*`
- **BFF 层**（Koa.js）：ViewModel 聚合与分页，路径前缀 `/api/requirements/*`
- **Web 层**（React）：需求列表页（`/requirements`）和详情页（`/requirements/:id`）

在 Web 工作台的左侧导航栏中，你会看到 📋 **Requirements** 入口。

---

# 23. 需求管理系统快速上手

## 23.1 前置条件

确保 API 服务已启动：

```bash
make dev-api
```

新开一个终端，验证 API 正常：

```bash
curl http://localhost:8000/api/v1/requirements/stats
# 应返回 {"total":0,...}
```

## 23.2 创建 Demo 需求与数据任务

```bash
make req-demo
```

这个命令会自动创建 3 条自动驾驶场景的 Demo 需求，以及各自的数据任务：

| 需求                             | 优先级 | 任务数 |
| -------------------------------- | ------ | ------ |
| 夜间十字路口 VRU Hard-Case 补采  | high   | 3      |
| 隧道入口强光鬼影场景数据采集     | medium | 2      |
| 雨天高速切入 Corner Case 闭环    | high   | 2      |

每条需求包含：场景标签、车型标签、预估数据量；每个任务包含：类型（采集/标注/流水线）、负责人、目标数据量。

## 23.3 查看需求列表

```bash
make req-list
```

输出示例：

```
────────────────────────────────────────────────────────────────────────────────
需求列表  (共 3 条)
────────────────────────────────────────────────────────────────────────────────
#   优先级     状态           任务数 标题
────────────────────────────────────────────────────────────────────────────────
1   high     draft          3      夜间十字路口 VRU Hard-Case 补采
2   medium   draft          2      隧道入口强光鬼影场景数据采集
3   high     draft          2      雨天高速切入 Corner Case 闭环
────────────────────────────────────────────────────────────────────────────────
```

## 23.4 查看统计看板

```bash
make req-stats
```

输出按状态、优先级、来源分组的聚合统计：

```
────────────────────────────────────
需求统计
────────────────────────────────────
  总计: 3

  按状态:
    draft                3

  按优先级:
    high                 2
    medium               1

  按来源:
    algorithm            1
    dre                  1
    product              1
────────────────────────────────────
```

## 23.5 审批数据任务（Sign-off）

```bash
make req-sign-off
```

这会取首个 `pending` 状态的 DataTask，执行 approve 操作。
审批后任务状态变为 `in_progress`，sign_off_status 变为 `approved`。

## 23.6 用 curl 直接调用 API

```bash
# 查看所有需求
curl http://localhost:8000/api/v1/requirements

# 按优先级筛选
curl "http://localhost:8000/api/v1/requirements?priority=high"

# 按状态筛选
curl "http://localhost:8000/api/v1/requirements?status=draft"

# 关键词搜索
curl "http://localhost:8000/api/v1/requirements?keyword=夜间"

# 查看统计
curl http://localhost:8000/api/v1/requirements/stats

# 获取需求详情（含数据任务列表）
curl http://localhost:8000/api/v1/requirements/<id>

# 创建新需求
curl -X POST http://localhost:8000/api/v1/requirements \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "新场景补采",
    "source": "algorithm",
    "dre_owner": "you@example.com",
    "priority": "medium",
    "scene_tags": ["雨天", "夜间"]
  }'

# 审批 DataTask
curl -X POST http://localhost:8000/api/v1/data-tasks/<task_id>/sign-off \
  -H 'Content-Type: application/json' \
  -d '{"approved": true, "sign_off_by": "admin", "comment": "LGTM"}'
```

## 23.7 在 Web 工作台里使用需求管理

同时启动 API、BFF 和 Web 服务：

```bash
# 终端 1
make dev-api

# 终端 2
make dev-bff

# 终端 3
make dev-web
```

打开 `http://localhost:3000`，在左侧导航栏点击 📋 **Requirements**，你会看到：

- **统计卡片区**：总计、按状态分布（Draft / In Progress / Completed）、按优先级分布
- **筛选栏**：状态下拉、优先级下拉、标题关键词搜索
- **需求列表**：优先级颜色标签、状态 Badge、场景标签 chip、任务数

点击任意一行进入**需求详情页**，你会看到：

- 需求基本信息卡（状态、优先级、DRE负责人、预估数据量等）
- 描述文字 + 场景标签 + 车型标签
- 数据任务列表，含签收状态 Badge
- 对 `pending` 签收状态的任务显示 **Approve / Reject** 按钮，点击即完成签收闭环

---

# 24. 需求管理与数据闭环的关系

需求管理系统不是独立的，它是整个数据闭环中"人"的那一层入口。

```
算法工程师发现模型缺陷
        ↓
在需求管理系统提交 Requirement（描述需要什么场景、多少数据）
        ↓
数据团队拆解为 DataTask（采集/标注/流水线）
        ↓
大数据 Sign-off 审批后任务进入执行
        ↓
数据采集 / 标注 / 流水线运行，结果写入 DataLake（Parquet/Lance/DuckDB）
        ↓
通过 Platform API / Web / SDK 验证数据质量
        ↓
完成签收，需求状态 → completed，回流训练闭环
```

这就是为什么这个项目叫 **AI Native Data Engine**：
数据不是被动存储的，而是由需求驱动、经过完整闭环流程主动生产出来的。

---

# 25. Pipelines & Streaming Console

§22–§24 解决 "需求—任务—签收" 这条人这一侧的链路；这一节解决另一半：**机器执行如何被建模、追踪、聚合**。

## 25.1 四层闭环对象

整套数据闭环对应四层对象，从业务承诺到机器运行依次降阶：

| 层 | 对象 | 关心的问题 |
|---|---|---|
| 业务承诺层 | `Requirement` | 为什么要做、验收口径是什么 |
| 数据定义层 | `DataTask` | 这条需求需要什么数据、谁负责采集/标注/流水线 |
| 人机协同运营层 | `OperationsTask` | 谁、按什么流程、用哪个 ops 模块去做 |
| 机器执行与成本层 | `PipelineRun` | 一次运行实际怎么跑、用了多少资源、Gate 是否通过 |

`PipelineRun` 是**独立事实表**，不是 `OperationsTask` 的子资源 —— 一条 run 可能直接来自 Scheduler、Manual、External（外部回放），不强求 OperationsTask 一定存在。它向 Requirement / DataTask / OperationsTask 三个上层对象都持**可选**外键。

## 25.2 PipelineRun 关键字段

- `x_trace_id`：跨需求全链路追踪键，与 HTTP `X-Trace-Id` 对齐，会沿 HTTP header / 日志 / Dagster op_config / Kafka header 传播。
- `trigger_source`：`data_task | operations_task | scheduler | manual | external` —— 这条 run 是谁触发的。
- `run_purpose`：`initial_build | backfill | repair | reindex | replay | validation` —— 区分 "首次构建" 与 "回补/重放/校验"。
- `stage`：`raw_ingest | clip_extraction | feature_extraction | structured_dataset` —— 即 Bronze → Silver → Gold。
- `metrics`：`{cost_usd, cpu_seconds, gpu_seconds, storage_gb, duration_s, gate_result, gate_reason}`。

为什么这样设计？因为没有 `run_purpose`，历史 run 容易被误读成 "重复初始化"；没有 `x_trace_id`，跨需求/任务/运行的审计需要在多张表里 fuzzy join。

## 25.3 Web Pipelines 五视图

打开 `http://localhost:3000/pipelines`，按 Tab 阅读：

| Tab | 你能看到什么 |
|---|---|
| Overview | Dagster Batch runs + Streaming pipeline 综合态势；流式块显示 partition lag / DLQ 计数 |
| Runs | PipelineRun 全链路过滤（`x_trace_id` / `requirement_id` / `operations_task_id` / `stage` / `status` / `trigger_source` / `run_purpose`），点行弹出 RunDetail 抽屉 |
| Lineage | 按 `x_trace_id` 聚合的 Mermaid DAG：Requirement → DataTask → OperationsTask → PipelineRun |
| Quality | Gate 结果分布（pass / waiver / block）、失败原因 Top-N、按 stage / run_purpose 钻取 |
| Cost | 总成本与 CPU/GPU/Storage 聚合，按 Requirement / Pipeline / Stage / Purpose 归因 |

RunDetail 抽屉用 Timeline 呈现 Requirement → DataTask → OperationsTask → Run 四层面包屑，并展示该 run 携带的 trace keys。

## 25.4 一键灌一份 Demo Trace 数据

```bash
make seed-trace-demo            # 随机生成完整 4 层链路（共享同一 x_trace_id）
make seed-trace-demo-reset      # 清库重灌
```

生成完成后，刷新 Pipelines 页面，每个 Tab 都会有可演示数据。

## 25.5 Kafka Streaming Console（broker + DLQ + lag）

`make stream-demo` 是最轻量的本地 streaming demo（写 JSONL、micro-batch 处理），细节见
[`docs/tutorials/local-first-streaming-demo.md`](./tutorials/local-first-streaming-demo.md)。

要把 streaming pipeline 提升到与 Batch（Dagster Console）同等的可观测层级，可走 **Kafka 模式** —— 真正的 broker、消费者 lag、DLQ 与 kafka-ui 控制台都齐备：

```bash
make up-deps                 # 拉起 broker(9092) + kafka-ui(8085)
make kafka-topics-init        # 预创建 streaming.events.{raw,dlq}
make stream-demo-kafka        # producer → streaming.events.raw（x_trace_id 作 partition key）
make stream-kafka-consumer    # 幂等消费者（另开终端，写 Bronze + DLQ + lag 快照）
# 打开 http://localhost:3000/pipelines (Overview Tab) —— Streaming 卡片实时显示 lag / DLQ
# 点 "Open Kafka UI console" 跳到 http://localhost:8085 直查 topic / consumer-group / 消息
```

实现的几个关键约束：

- **幂等账本**：消费者用 SQLite 维护 `(event_id, x_trace_id)` 复合键，重复投递不会重复落 Bronze。
- **DLQ**：解析失败 / 写 Bronze 失败的消息直接入 `streaming.events.dlq`，envelope 含 `error_class / error_message / original_topic / original_offset / payload`。
- **Lag 可视化**：消费者每个 poll 周期把 partition lag + counters 写入 `data/streaming/kafka_lag.json`，由 Platform API `GET /streaming/health` 读取，BFF `GET /api/pipelines/streaming-health` 合并 kafka-ui `/actuator/health` 与 Platform 返回值，给前端一个 page-specific ViewModel。
- **Trace 透传**：producer 用 `x_trace_id` 作为 partition key，并把 `x-trace-id` / `x-requirement-id` 写到 Kafka header，下游消费/重放可继续按 trace 聚合。

## 25.6 BFF 透传与平台 API 路径速查

| 目的 | BFF 路径 | Platform API 路径 |
|---|---|---|
| 多维过滤的 run 列表 | `GET /api/pipelines/runs` | `GET /api/v1/pipeline-runs` |
| 单 run 面包屑 | `GET /api/pipelines/runs/:id` | `GET /api/v1/pipeline-runs/{id}` |
| 按 trace 聚合 | `GET /api/pipelines/trace/:traceId` | `GET /api/v1/trace/{x_trace_id}` |
| 最近 trace 列表（Lineage 下拉） | `GET /api/pipelines/traces` | `GET /api/v1/traces` |
| Stage × Status 矩阵 | `GET /api/pipelines/stage-stats` | `GET /api/v1/pipeline-stats/stages` |
| Quality 聚合 | `GET /api/pipelines/quality-stats` | `GET /api/v1/pipeline-stats/quality` |
| Cost 聚合 | `GET /api/pipelines/cost-stats` | `GET /api/v1/pipeline-stats/cost` |
| Streaming 健康 | `GET /api/pipelines/streaming-health` | `GET /streaming/health` |

## 25.7 与 ADR 的对应关系

这一节的设计来自 [`docs/adr/adr-pipelinerun-unified-fact-model.md`](./adr/adr-pipelinerun-unified-fact-model.md)（PipelineRun 统一事实模型 + x_trace_id 全链路追踪 + Kafka Streaming 集成）。后续演进 Action（Quality Gate 配置化、Cost drill-down、DLQ replay、Dagster sensor 包装 KafkaStreamingTrigger 等）见同一 ADR 的 §7 / §8.5。

---


