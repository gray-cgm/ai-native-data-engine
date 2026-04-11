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

这个项目围绕四层架构组织：

1. **Ingestion**：数据接入层
2. **Pipeline**：资产编排层
3. **Lakehouse / DataLake**：本地数据访问层
4. **Platform**：工作台层

它不是一个“文件堆 + 脚本集合”，而是一个：

> 在裸文件（File）之上构建类数据库（DB-like）数据访问体验的本地数据平台。

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

- 个人版用 DuckDB，不代表未来不能切 StarRocks
- 个人版用 Parquet，不代表未来不能切 Iceberg/Paimon
- 个人版用 SQLite，不代表未来不能切 Postgres
- 个人版用 local fs，不代表未来不能切 S3 / MinIO

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
- `apps/orchestrator`：Dagster 资产编排

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

---

## 8.2 Parquet
承载结构化样本表。

为什么要有 Parquet？

因为原始 JSON 不适合作为主查询格式。
Parquet 是列式存储，更适合：

- 查询加速
- 列裁剪
- 后续导出
- 未来演进到 Iceberg/Paimon

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

---

## 8.4 Lance
检索与索引层。

它负责：

- 基础检索
- 向量/样本索引
- search preview

个人版里先做最小能力，后续可以继续增强。

---

## 8.5 SQLite
元数据控制面。

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

这样 Platform API、workflow、Dagster 都不需要直接依赖底层实现。BFF 通过调用 Platform API 间接使用这些能力，而不直接持有底层 runtime provider。

---

# 10. 数据是怎么流动的？

当前 MVP 的数据流大致如下：

```text
Local image/json files
-> ingestion
-> SampleRecord
-> Parquet table
-> DuckDB query table
-> Lance index
-> Dataset / DatasetVersion metadata
-> Platform API
-> BFF / Web or SDK / Export
```

这就是个人版 DataLake 的核心路径。

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

### Dagster
```bash
make dev-dagster
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

## 15.1 触发 demo ingestion / asset materialization
```bash
curl -X POST http://localhost:8000/samples/ingest-demo
```

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
curl -X POST "http://localhost:8000/exports/dataset/demo-dataset?format=parquet"
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
./data/exports/demo-dataset-v1.parquet
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
- `list_datasets()`
- `get_dataset(dataset_id)`
- `list_exports()`
- `export_dataset(dataset_id, format='parquet')`
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

- DuckDB -> StarRocks
- Parquet -> Iceberg / Paimon
- SQLite -> Postgres
- local fs -> S3 / MinIO

你会发现，真正重要的是：

> 一开始有没有把系统的边界设计对。

---

# 21. 一句话总结

这个项目想教给你的，不只是怎么用几个工具搭一个 demo，
而是：

> 如何在一台笔记本上，用正确的数据系统思维，搭出一个面向自动驾驶数据闭环的本地 DataLake 工作台。

如果你理解了这件事，后面无论是走向团队版还是企业版，都会自然很多。

---
