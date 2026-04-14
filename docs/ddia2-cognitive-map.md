# DDIA2 × AI Native Data Loop Engine 认知地图

> 目标：帮助项目开发者先建立对数据密集型系统的整体认知，再回到本项目的 local-first data closed-loop engine 设计。
>
> 这份文档不把 DDIA2 当成“读书笔记”，而是把它变成一个理解本仓库的架构地图：先看 trade-off，再看数据模型，再看存储与处理，最后看系统如何从个人版演进到企业版与 SaaS 版。

---

## 1. 为什么这个项目要先学 DDIA2

这个仓库当前最重要的，不是先把某个具体产品功能堆满，而是先建立下面这几个问题的整体认知：

- storage
- replication
- partitioning
- batch processing
- stream processing
- system design trade-off

这一点已经直接写在项目主 README 的学习路线里：项目建议优先补数据密集型系统基础，再理解闭环平台设计。[readme.md:252-280](readme.md#L252-L280)

原因很简单：

这个项目虽然表面上是“自动驾驶 / 机器人数据闭环平台”，但底层本质仍然是一个数据密集型系统。它需要回答的并不是“用什么框架”，而是：

- 什么数据应该走 transaction path，什么数据应该走 analytics path
- 什么能力适合单机 local-first，什么能力未来必须分布式化
- 什么对象应该被建模为 metadata，什么应该物化为 analytical table
- 什么流程现在是 batch，什么将来会演进成 stream
- 什么能力应该先做轻量 MVP，什么能力要为企业版和 SaaS 版预留边界

如果这些问题没有先想清楚，后面无论接 SQLite、DuckDB、Parquet、Lance、Dagster，都会沦为工具堆叠。

---

## 2. 先用一句话理解本项目

本项目当前可以概括为：

> 一个面向自动驾驶 / 机器人场景的 local-first data closed-loop engine，主链路是 ingestion -> lakehouse -> platform。

这个定位在 README 中已经明确给出：[readme.md:3-5](readme.md#L3-L5)、[readme.md:383-389](readme.md#L383-L389)

当前推荐访问拓扑是：

```text
Browser / Web App
-> BFF (Node.js + TypeScript)
-> Platform API (FastAPI)
-> RuntimeContainer / adapters / lakehouse
```

对应说明见 [readme.md:217-243](readme.md#L217-L243)。

而在 Python 侧，系统边界已经被拆成：

- `core`: 稳定语义、领域模型、接口契约
- `adapters`: 各种能力实现
- `profiles`: 运行时装配
- `workflows`: 可复用流程编排
- `apps/orchestrator`: Dagster 运行时绑定层

对应文档见 [docs/architecture/layering-and-orchestrator-boundaries.md:44-99](docs/architecture/layering-and-orchestrator-boundaries.md#L44-L99)。

所以，理解这个项目最好的方式，不是“从某个接口开始看”，而是先把它放回 DDIA2 的问题域中。

---

## 3. 一张图先建立整体认知

```text
DDIA2
├─ Part 1: Big Picture
│  ├─ 系统场景与边界
│  └─ 非功能目标
├─ Part 2: Data Representation
│  ├─ 数据模型
│  ├─ 存储与检索
│  └─ 编码与演化
├─ Part 3: Scale-Out Core
│  ├─ 复制
│  ├─ 分片
│  └─ 事务
├─ Part 4: Distributed Reality
│  ├─ 分布式故障模型
│  └─ 一致性与协调
├─ Part 5: Data Processing
│  ├─ 批处理
│  ├─ 流处理
│  └─ 以 dataflow 视角集成系统
└─ Part 6: Responsibility
   └─ 隐私、治理、责任边界
```

把它映射到本项目，就是：

```text
AI Native Data Loop Engine
├─ Why
│  ├─ 为什么先做 local-first MVP
│  └─ 为什么要沿 personal -> enterprise -> SaaS 演进
├─ Representation
│  ├─ Sample / Dataset / DatasetVersion / ExportJob / LineageEvent
│  ├─ SQLite metadata
│  ├─ Parquet tables
│  ├─ DuckDB queries
│  └─ Lance search
├─ Processing
│  ├─ ingestion workflows
│  ├─ asset materialization
│  ├─ exports
│  └─ Dagster orchestration
├─ Scale-out Future
│  ├─ enterprise replication
│  ├─ multi-tenant sharding
│  ├─ stronger transaction boundaries
│  └─ distributed coordination
└─ Responsibility
   ├─ autonomous driving data governance
   ├─ privacy
   └─ accountability
```

你可以把这份文档理解成：把上面两棵树接起来。

---

## 4. Part 1：先看全景，不要先看工具

### 4.1 Chapter 1：Trade-Offs in Data Systems Architecture

这一章对本项目最重要的价值是：

> 先分清系统场景与架构边界，再决定技术组合。

### 你在本项目里要先分清的几类系统

#### 1) Transaction path

这类路径强调“状态正确性”和“对象关系”。
在本项目中，典型对象有：

- dataset
- dataset version
- workspace
- task
- export job
- lineage event

这些对象都属于平台控制面或元数据面。当前它们由 SQLite metadata 承载，见 [infra/profiles/local-dev.yaml:14-20](infra/profiles/local-dev.yaml#L14-L20)。

#### 2) Analytical path

这类路径强调“扫描、聚合、过滤、统计、导出”。
在本项目中，典型路径有：

- 分布统计
- DuckDB 查询
- Parquet 导出
- 未来更复杂的数据分析

当前 `local-dev` profile 明确把 query provider 配成 DuckDB：[infra/profiles/local-dev.yaml:7-10](infra/profiles/local-dev.yaml#L7-L10)

#### 3) Search / index path

这类路径不完全等同于关系查询，也不等同于离线分析。它是单独的访问模式。

本项目把 search 单独作为能力暴露，而不是塞进 metadata 或 query 中。`RuntimeContainer` 中 `search` 是一等能力：[python/core/src/core/profiles/runtime.py:15-25](python/core/src/core/profiles/runtime.py#L15-L25)

当前 local-dev 使用 Lance：[infra/profiles/local-dev.yaml:18-20](infra/profiles/local-dev.yaml#L18-L20)，对应实现见 [python/adapters/src/adapters/vector/lance/adapter.py:10-56](python/adapters/src/adapters/vector/lance/adapter.py#L10-L56)。

### 对本项目的核心启发

这一章要求你先回答：

- 平台里哪些是 transaction，哪些是 analytics，哪些是 pipeline
- 哪些是控制面，哪些是数据面
- 哪些路径追求事务正确性，哪些路径追求吞吐与扫描效率

只有这样，才会自然得到现在这组技术组合：

- SQLite 做 metadata / control plane
- Parquet 做 analytical table format
- DuckDB 做 local analytics engine
- Lance 做 search / vector-like access
- Dagster 做 orchestration

这不是“技术栈拼盘”，而是 trade-off 之后的结果。

---

### 4.2 Chapter 2：Defining Nonfunctional Requirements

这一章的核心不是“列指标”，而是明确：

> 系统当前阶段到底优化什么。

README 已经把项目扩展路径写得很清楚：

1. personal local edition
2. enterprise-reproducible edition
3. multi-tenant SaaS edition

见 [readme.md:372-379](readme.md#L372-L379)。

这意味着三个阶段的目标函数并不一样。

### 当前 local-first MVP 的非功能目标

从现有实现可以看出，当前阶段主要优化的是：

- 可跑起来
- 可理解
- 可演进
- 一台机器可启动
- 依赖轻量
- 架构边界尽量正确

而不是：

- 跨节点高可用
- 强一致分布式协调
- 大规模多租户吞吐
- 企业级容灾

这一点也体现在 `local-dev` capabilities 上：

- `multi_tenant: false`
- `sso: false`
- `distributed_compute: false`
- `advanced_governance: false`
- `object_storage: false`

见 [infra/profiles/local-dev.yaml:26-32](infra/profiles/local-dev.yaml#L26-L32)

### 对开发者的要求

读本仓库时，不要用“为什么现在不用更重的企业方案”来否定 MVP。
正确的问题是：

- 当前阶段要不要为后续企业版保留抽象
- 哪些非功能要求必须先抽象，哪些可以晚一点再实现

本项目给出的答案是：

- 先用轻量实现
- 但通过 adapter / profile / runtime container 保留替换能力

这也是 beginner guide 明确强调的设计原则：[docs/tutorials/beginner-guide.md:146-162](docs/tutorials/beginner-guide.md#L146-L162)

---

## 5. Part 2：数据表示，比数据库选型更重要

### 5.1 Chapter 3：Data Models and Query Languages

这一章对本项目最关键的价值是：

> 样本、元数据、检索索引、导出视图，并不适合一种模型全包。

### 本项目当前的核心数据对象

在领域模型里，目前已经显式定义了：

- `SampleRecord`
- `DatasetSummary`
- `ComputeRun`
- `LineageEvent`
- `ProfileCapabilities`
- `RuntimeProfile`

见 [python/core/src/core/domain/models.py:6-57](python/core/src/core/domain/models.py#L6-L57)

而 beginner guide 把更高层的统一资产模型概括为：

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

见 [docs/tutorials/beginner-guide.md:95-106](docs/tutorials/beginner-guide.md#L95-L106)

### 为什么这说明 Chapter 3 很重要

因为这里至少同时存在四种不同的数据表示需求：

#### 1) Relational / metadata model

例如：

- datasets
- dataset_versions
- tasks
- workspaces
- export_jobs
- lineage_events

这些对象天然更接近关系模型，需要稳定字段、主键、关联和事务边界。

#### 2) Analytical table model

例如样本物化后的结构化表。它更适合列式表与 DataFrame/SQL 访问。

#### 3) Search / index model

检索索引不是传统 relational schema 的直接投影。它是为查找路径服务的派生数据结构。

#### 4) API / resource model

前端、SDK、BFF 看到的是 resource-oriented model，而不是底层表结构。

例如 BFF 聚合 dashboard 时，会分别读取：

- `/datasets`
- `/tasks`
- `/workspaces`
- `/exports`
- `/samples/search-preview`

再组装成页面 payload，见 [apps/bff/src/services/dashboard.ts:14-38](apps/bff/src/services/dashboard.ts#L14-L38)

### 对项目的认知落点

Chapter 3 帮你避免一个常见误区：

> 不要试图用“一种数据库、一种 schema、一种接口”吃掉所有问题。

本项目当前分开的 metadata / query / search / export，就是对这个原则的直接实践。

---

### 5.2 Chapter 4：Storage and Retrieval

这一章几乎就是本项目 local MVP 的技术主轴。

如果只用一句话概括本项目当前存储检索组合，就是：

> SQLite metadata + Parquet table + DuckDB query + Lance search

这个组合在 README 中已直接说明：[readme.md:387-389](readme.md#L387-L389)

### 逐个映射理解

#### 1) SQLite：metadata storage

本地元数据放在 SQLite：

- database: `./data/metadata/metadata.db`

见 [infra/profiles/local-dev.yaml:14-16](infra/profiles/local-dev.yaml#L14-L16)

它适合当前阶段的原因不是“最强”，而是：

- 嵌入式
- 无需独立部署
- 足够承载本地控制面
- 有事务能力

#### 2) Parquet：columnar analytical storage

在 pipeline 中，样本会被写入 `table.overwrite('dataset_samples', ...)`：[python/workflows/src/workflows/assets/pipeline.py:15-18](python/workflows/src/workflows/assets/pipeline.py#L15-L18)

这对应的是把结构化样本数据落成列式表，用于后续分析、导出和演进。

#### 3) DuckDB：embedded analytical query engine

workflow 会调用 `container.query.create_sample_table(records)` 和 `query_distribution()`，见 [python/workflows/src/workflows/assets/pipeline.py:13-14](python/workflows/src/workflows/assets/pipeline.py#L13-L14)、[python/workflows/src/workflows/assets/pipeline.py:68-69](python/workflows/src/workflows/assets/pipeline.py#L68-L69)

这说明 DuckDB 在这里承担的是本地分析引擎，而不是元数据主库。

#### 4) Lance：search / vector-like retrieval

当前 Lance adapter 会构建一份带 `scene` 和 `vector` 的表，并支持按 filters 查询：[python/adapters/src/adapters/vector/lance/adapter.py:23-31](python/adapters/src/adapters/vector/lance/adapter.py#L23-L31)、[python/adapters/src/adapters/vector/lance/adapter.py:48-56](python/adapters/src/adapters/vector/lance/adapter.py#L48-L56)

虽然现在是最小 demo，但它已经表达出一个很重要的思想：

- search path 是独立访问模式
- index 是派生数据，不是主数据真相

### 对开发者的启发

读 Chapter 4 时，请始终带着这组映射来理解：

- B-Tree / row store -> metadata path
- columnar store -> analytics path
- search / vector index -> retrieval path
- local embedded engine -> local-first MVP 的合理选择

这个项目最值得学的地方，不是“用了哪些工具”，而是它把不同访问模式拆成了不同技术责任。

---

### 5.3 Chapter 5：Encoding and Evolution

这一章在本项目里对应的是：

> 系统怎样演化而不崩。

### 当前有哪些演化边界

#### 1) 统一资产模型边界

当 `Sample`、`Dataset`、`DatasetVersion`、`ExportJob`、`LineageEvent` 这些对象一旦被 SDK、API、BFF、workflow 同时依赖时，它们就不只是“代码结构”，而是演化边界。

#### 2) API 契约边界

FastAPI 暴露的是平台资源接口，例如：

- `/datasets`
- `/datasets/{dataset_id}`
- `/datasets/{dataset_id}/versions`
- `/exports`
- `/exports/dataset/{dataset_id}`
- `/samples/ingest-demo`

见 [apps/api/src/api/routes/catalog.py:8-28](apps/api/src/api/routes/catalog.py#L8-L28)、[apps/api/src/api/routes/export.py:7-18](apps/api/src/api/routes/export.py#L7-L18)、[apps/api/src/api/routes/samples.py:8-23](apps/api/src/api/routes/samples.py#L8-L23)

#### 3) BFF 适配边界

BFF 不是简单转发层，它在做页面语义聚合。比如 dashboard 聚合多个 API 结果，exports route 适配前端导出动作：[apps/bff/src/routes/exports.ts:17-40](apps/bff/src/routes/exports.ts#L17-L40)

这意味着未来平台 API 可能保持资源语义稳定，而 BFF 可以随页面场景变化而演进。

#### 4) 导出格式边界

当前已经支持：

- Parquet
- CSV
- JSONL

见 [readme.md:165-179](readme.md#L165-L179)

导出格式本质上就是跨系统数据交换的编码边界。

### 为什么这一章重要

因为这个项目并不只是本地脚本集，而是一个未来要演进成：

- SDK
- API
- BFF
- workflow
- enterprise adapters
- multi-tenant SaaS

的系统。

一旦进入这个阶段，真正难的不是“加字段”，而是：

- 如何保持资源语义稳定
- 如何让 profile 切换不破坏调用方
- 如何让导出格式长期可用
- 如何让不同层的契约演化同步而不过度耦合

所以 Chapter 5 是这类平台长期演进的核心章。

---

## 6. Part 3：从单机 MVP 走向 scale-out 之前，先理解三大问题

### 6.1 Chapter 6：Replication

这一章在本项目当前阶段不是主战场，但在 enterprise / SaaS 阶段会迅速变成主问题。

### 为什么现在可以弱化

当前 local-dev 明确是单机、单 profile、本地文件、本地 SQLite、本地 DuckDB、本地 Lance：[infra/profiles/local-dev.yaml:1-32](infra/profiles/local-dev.yaml#L1-L32)

此时 replication 不是第一优先级。

### 为什么以后绕不过去

一旦进入企业版或托管版，下面的问题都会出现：

- metadata 要不要主从复制
- 查询引擎和存储层是否需要多副本
- 索引是否需要异步复制
- 任务状态如何跨节点同步
- 多地部署如何处理 lag 和 failover

### 对本项目的认知落点

当前可以把 replication 视为“未来企业版基础设施问题”，但要提前认识到：

- 今天 profile 抽象存在的意义之一，就是为未来 provider 替换留口子
- 今天 local-first 没有 replication，不代表架构可以假装 replication 永远不存在

---

### 6.2 Chapter 7：Sharding

这一章对应的是本项目从单用户 / 小样本库走向多租户和大规模数据之后的必经之路。

### 当前为什么还没发生

当前系统主要是：

- 本地单机
- demo dataset
- 单工作空间语义
- 本地导出和本地分析

还没有真正碰到热分区、rebalance、cross-tenant routing 这些问题。

### 未来会在哪里爆发

一旦进入 multi-tenant SaaS edition，就会遇到：

- 数据按 tenant 分片还是按 dataset 分片
- metadata 按租户还是按业务域分片
- 大规模样本表按时间、场景、客户还是 hash 分片
- 热门租户 / 热门数据集造成热点怎么办

### 对项目的认知落点

目前 `ProfileCapabilities.multi_tenant` 已经被建模，但在 local-dev 下为 false：[python/core/src/core/domain/models.py:41-46](python/core/src/core/domain/models.py#L41-L46)、[infra/profiles/local-dev.yaml:26-27](infra/profiles/local-dev.yaml#L26-L27)

这说明项目已经在语义层承认“多租户是未来系统形态之一”。

所以读 Chapter 7 的目标，不是立即实现 sharding，而是先建立这种判断力：

- 你的 key 是什么
- 将来按什么路由
- 现在的对象模型是否允许按租户 / 数据集 / 版本切分

---

### 6.3 Chapter 8：Transactions

这一章对本项目当下其实已经很重要。

### 哪些地方天然需要事务边界

至少有三类：

#### 1) 数据集创建与版本登记

在当前 `Night Intersection VRU Hard-Case Triage` 主链路中，批处理会依次做：

- create workspace
- create sample table
- build index
- overwrite parquet table
- 计算场景样本打分与 priority sample package
- create dataset
- create dataset version
- submit scenario triage job
- create job_run
- create review task
- create export_job
- append lineage event

见 [python/services/src/services/__init__.py](python/services/src/services/__init__.py) 和 [python/workflows/src/workflows/demo/pipeline.py](python/workflows/src/workflows/demo/pipeline.py)

这其实已经是一串跨多个子系统的多步写操作。

#### 2) 导出任务

导出本质上不是单次查询，而是：

- 解析 dataset
- 找 latest version
- 生成文件
- 更新 export metadata

这种动作天然有任务状态边界。

#### 3) 元数据与派生数据一致性

比如：

- dataset version 已登记，但 Parquet 表还没成功落盘
- index 已更新，但 metadata 未更新
- export job 已记录 ready，但文件不存在

这些都是典型的事务边界或补偿边界问题。

### 对本项目的核心启发

当前 MVP 可以不追求严格分布式事务，但必须尽早识别：

- 哪些操作需要同一提交语义
- 哪些操作应该拆成异步状态机
- 哪些地方允许最终一致，哪些地方不允许

换句话说，Chapter 8 不是“以后做分布式再看”，而是现在就应该用来切分 workflow 边界。

---

## 7. Part 4：一旦走向企业部署，分布式现实会逼你重画边界

### 7.1 Chapter 9：The Trouble with Distributed Systems

这一章在 local MVP 阶段最容易被忽视，因为本地单机环境天然屏蔽了很多问题。

### 当前为什么感觉不到

因为当前主路径大部分都在单机内完成：

- local fs
- SQLite
- DuckDB
- Lance
- 本地 Dagster

### 未来必须显式面对的问题

一旦走向企业版 / SaaS：

- 部分节点失败怎么办
- 调度器和执行器之间网络超时怎么办
- metadata service 与 compute service 时钟不一致怎么办
- lease 失效、进程暂停、重复执行如何处理
- 一个任务到底是没执行、执行了、还是执行成功但回执丢了

### 对项目的认知落点

这也是为什么项目专门把 orchestrator 边界单独拉出来，而不是把编排直接塞进 API。文档明确强调：

- `python/workflows` 是流程能力本身
- `apps/orchestrator` 是把这些流程接入 Dagster 运行时

见 [docs/architecture/layering-and-orchestrator-boundaries.md:28-40](docs/architecture/layering-and-orchestrator-boundaries.md#L28-L40)

这其实就是在提前为“分布式运行时现实”做隔离。

---

### 7.2 Chapter 10：Consistency and Consensus

这一章在今天的 MVP 里还不是显性复杂点，但它会成为未来 control plane 的核心问题。

### 未来哪些地方会碰到一致性

- 元数据主控
- 调度状态推进
- task / run 状态协调
- 多租户控制面更新
- 某些关键资源的唯一性判定

### 现在就该学会的判断

并不是所有路径都需要 linearizability，但有些路径必须有更强一致性，例如：

- 某个 dataset version 是否已经注册成功
- 某个 export job 是否已经进入最终完成态
- 某个调度任务是否已经被领取执行

### 对项目的认知落点

当前系统通过 platform resource、workflow、orchestrator 三层分离，已经给未来一致性策略留了位置：

- API 负责资源语义
- workflow 负责业务链路
- orchestrator 负责运行时协调

这意味着后面即使需要引入更强的一致性手段，也不需要把所有逻辑推翻重来。

---

## 8. Part 5：这个项目本质上是一个 dataflow 系统

### 8.1 Chapter 11：Batch Processing

这一章与当前项目高度贴合，因为你今天看到的大多数流程，本质上都是 batch pipeline。

### 当前哪些能力属于 batch

- ingest demo data
- 物化样本表
- 构建 distribution
- 构建 Lance index
- 生成导出文件

在当前场景筛选主链路里，这条批式链路已经很清楚：[python/services/src/services/__init__.py](python/services/src/services/__init__.py) 和 [python/workflows/src/workflows/demo/pipeline.py](python/workflows/src/workflows/demo/pipeline.py)

### Dagster 为什么重要

Dagster 在这里承担的是 asset-oriented orchestration，而不是普通任务调度。beginner guide 已明确强调：

> 真正需要被管理的不是脚本，而是数据资产。

见 [docs/tutorials/beginner-guide.md:724-744](docs/tutorials/beginner-guide.md#L724-L744)

这与 DDIA2 对 batch/dataflow 的理解是非常一致的：

- 批处理不是孤立脚本
- 而是围绕派生数据和处理链路组织系统

### 对项目的认知落点

当前 ingestion、资产物化、离线导出，都是标准的 batch processing 问题。

所以读 Chapter 11 时，请带着这些问题：

- 这条批链路的输入输出是什么
- 哪些结果是 derived data
- 哪些节点适合物化
- 哪些结果应该进入 metadata catalog

---

### 8.2 Chapter 12：Stream Processing

当前项目主路径还更偏 batch，但未来闭环平台一定会越来越依赖 stream thinking。

### 为什么现在还不强

当前场景筛选的数据导入是显式触发的：

- `POST /samples/ingest-demo`
- `make ingest`

更像一次性批任务，而不是持续事件流。

### 未来会往哪些方向演进

- 新样本到达后自动触发物化
- metadata 变更驱动索引刷新
- export 完成事件驱动下游动作
- 训练反馈 / 评估反馈进入数据闭环
- CDC / event log 驱动平台状态同步

### 对项目的认知落点

当前 `apps/orchestrator` 文档已经为 future sensors / schedules 预留了位置：[docs/architecture/layering-and-orchestrator-boundaries.md:442-462](docs/architecture/layering-and-orchestrator-boundaries.md#L442-L462)

这说明项目虽然还没完整进入 stream 模式，但系统形态已经开始为 event-driven growth 留接口。

所以 Chapter 12 的作用，是帮助你提前建立事件流视角，而不是等消息队列引入以后再补课。

---

### 8.3 Chapter 13：A Philosophy of Streaming Systems

如果只选一个章节来概括本项目，Chapter 13 可能是最接近本质的一章。

因为这个项目本质上不是“一个数据库”或“一个 API 服务”，而是：

> 一个 ingestion -> lakehouse -> platform 的 dataflow 系统。

README 也明确把项目主重点放在这条链路打通上：[readme.md:381-389](readme.md#L381-L389)

### 用 Chapter 13 看本项目，会看到什么

#### 1) Derived data 是主角

- distribution 是 derived data
- search index 是 derived data
- export file 是 derived data
- dashboard payload 也是 derived view

#### 2) 各个组件不是孤岛

- ingestion 生产结构化样本
- lakehouse 承载物化表
- metadata 记录资源语义和血缘
- search 提供检索入口
- API/BFF/Web 暴露可消费视图

#### 3) 系统真正的价值在 dataflow integration

这也是项目文档一直强调的：

- 不是文件堆
- 不是脚本堆
- 而是一个在文件之上建立 DB-like access experience 的平台

见 [docs/tutorials/beginner-guide.md:28-30](docs/tutorials/beginner-guide.md#L28-L30)

### 对开发者的核心启发

Chapter 13 会帮你把“仓库里这么多层到底在做什么”这件事看清楚：

- `core` 定义稳定语义
- `adapters` 实现具体能力
- `profiles` 选择运行形态
- `workflows` 组织数据流
- `orchestrator` 接入调度运行时
- `api` / `bff` / `web` 把数据流结果变成产品能力

这其实就是一个完整的数据派生与消费系统。

---

## 9. Part 6：责任边界不是附录，而是闭环平台的底线

### Chapter 14：Doing the Right Thing

这一章对于通用数据平台已经重要，对自动驾驶 / 机器人数据系统则更重要。

### 为什么这个项目尤其要重视

因为这里处理的不会只是普通业务数据，未来很可能包括：

- 图像
- 轨迹
- 场景元数据
- 可能涉及人员、车辆、位置、道路环境的信息

一旦进入真实生产或企业协作场景，就会立即遇到：

- 隐私
- 数据保留策略
- 标注责任边界
- 模型偏差追责
- 数据访问审计
- 多租户隔离与合规

### 当前项目已经承认了这条演进线

`ProfileCapabilities` 里已经单独放了：

- `advanced_governance`
- `multi_tenant`
- `sso`

见 [python/core/src/core/domain/models.py:41-46](python/core/src/core/domain/models.py#L41-L46)

这说明治理不是“以后另起一套系统”，而是未来 runtime capability 的一部分。

### 对开发者的要求

不要把 Chapter 14 当作技术阅读的结尾装饰。
对自动驾驶 / 机器人数据平台来说，它决定的是：

- 平台能不能进入真实组织环境
- 数据闭环会不会越做越危险
- 系统是否具备责任可追踪性

---

## 10. DDIA2 × 本项目架构组件对照表

| 项目架构组件 | 当前实现 | 对应 DDIA2 章节 | 为什么对应 |
|---|---|---|---|
| 数据闭环主链路 | ingestion -> lakehouse -> platform | Chapter 1 / Chapter 13 | 这是整体 dataflow 视角，不是单一数据库视角 |
| 本地 MVP 演进路线 | personal -> enterprise -> SaaS | Chapter 1 / Chapter 2 | 每个阶段的 trade-off 与目标函数不同 |
| SQLite metadata | `metadata: sqlite` | Chapter 3 / Chapter 8 | 元数据更接近 relational model，且需要事务边界 |
| Parquet table | 结构化样本物化 | Chapter 4 | Parquet 是列式 analytical storage |
| DuckDB query | `query: duckdb` | Chapter 4 / Chapter 11 | 本地嵌入式分析查询引擎，适合批式分析 |
| Lance search | `search: lance` | Chapter 4 | 对应 search / vector-like retrieval |
| 统一资产模型 | Sample / Dataset / Version / Export / Lineage | Chapter 3 / Chapter 5 | 决定系统的数据表示与演化边界 |
| 多格式导出 | Parquet / CSV / JSONL | Chapter 5 | 本质是数据编码与跨系统交换边界 |
| FastAPI Platform API | catalog / operations / exports / samples | Chapter 5 | API 是服务间契约与演化边界 |
| Python SDK | 平台访问出口 | Chapter 5 | SDK 封装的是协议稳定性 |
| React workbench | 搜索、数据集、任务、导出视图 | Chapter 3 | 前端消费的是资源模型与查询模型 |
| Node.js BFF | dashboard 聚合与导出触发 | Chapter 5 | BFF 是接口适配与组合层 |
| Dagster orchestration | orchestrator + workflow binding | Chapter 11 / Chapter 13 | 典型的 dataflow orchestration |
| ingestion workflows | 导入图像与 JSON metadata | Chapter 11 / Chapter 12 | 当前偏 batch，未来可向事件驱动演进 |
| local-dev profile | RuntimeContainer + capabilities | Chapter 1 / Chapter 2 | profile 本质是显式化当前 trade-off |
| enterprise adapters 预留 | profile 能力扩展 | Chapter 6 / 7 / 9 | 企业化后会进入复制、分片、分布式故障模型 |
| multi-tenant SaaS edition | 多租户托管形态 | Chapter 7 / 10 / 14 | 涉及分片、一致性、治理与责任边界 |

---

## 11. 开发者应该按什么顺序学习

### 第一阶段：先学全景和约束

先看：

- Chapter 1
- Chapter 2

你要回答的是：

- 为什么项目分 personal / enterprise / SaaS 三阶段
- 为什么 local-first MVP 可以故意不用重型基础设施
- 为什么 profile / capability 抽象比“直接上大系统”更重要

对应本仓库重点文件：

- [readme.md:368-389](readme.md#L368-L389)
- [infra/profiles/local-dev.yaml:1-32](infra/profiles/local-dev.yaml#L1-L32)
- [docs/tutorials/beginner-guide.md:146-162](docs/tutorials/beginner-guide.md#L146-L162)

### 第二阶段：再学数据抽象

先看：

- Chapter 3
- Chapter 5

你要回答的是：

- 为什么统一资产模型比表结构更重要
- 为什么 API、BFF、SDK、导出格式都是演化边界
- 为什么 metadata / query / search / export 要分开

对应本仓库重点文件：

- [python/core/src/core/domain/models.py:6-57](python/core/src/core/domain/models.py#L6-L57)
- [docs/tutorials/beginner-guide.md:95-126](docs/tutorials/beginner-guide.md#L95-L126)
- [apps/bff/src/services/dashboard.ts:14-38](apps/bff/src/services/dashboard.ts#L14-L38)

### 第三阶段：再学存储与检索

先看：

- Chapter 4

你要回答的是：

- 为什么当前组合是 SQLite + Parquet + DuckDB + Lance
- 为什么不能让 JSON 永远承担主查询路径
- 为什么 search path 要单列出来

对应本仓库重点文件：

- [infra/profiles/local-dev.yaml:3-20](infra/profiles/local-dev.yaml#L3-L20)
- [python/workflows/src/workflows/assets/pipeline.py:12-18](python/workflows/src/workflows/assets/pipeline.py#L12-L18)
- [python/adapters/src/adapters/vector/lance/adapter.py:23-56](python/adapters/src/adapters/vector/lance/adapter.py#L23-L56)

### 第四阶段：再学扩展与正确性

先看：

- Chapter 6
- Chapter 7
- Chapter 8
- Chapter 9
- Chapter 10

你要回答的是：

- 企业版和 SaaS 版会在哪些地方碰到复制、分片、协调和一致性
- 当前 workflow 的事务边界应该如何识别
- 未来哪些控制面动作必须更强一致

对应本仓库重点文件：

- [python/workflows/src/workflows/assets/pipeline.py:20-66](python/workflows/src/workflows/assets/pipeline.py#L20-L66)
- [docs/architecture/layering-and-orchestrator-boundaries.md:228-358](docs/architecture/layering-and-orchestrator-boundaries.md#L228-L358)

### 第五阶段：最后再学数据处理哲学

先看：

- Chapter 11
- Chapter 12
- Chapter 13

你要回答的是：

- 当前哪些流程是 batch pipeline
- 未来哪些流程适合流化 / 事件驱动
- 为什么整个系统本质上是 derived data pipeline

对应本仓库重点文件：

- [python/workflows/src/workflows/assets/pipeline.py:9-80](python/workflows/src/workflows/assets/pipeline.py#L9-L80)
- [docs/architecture/layering-and-orchestrator-boundaries.md:431-520](docs/architecture/layering-and-orchestrator-boundaries.md#L431-L520)
- [docs/tutorials/beginner-guide.md:442-458](docs/tutorials/beginner-guide.md#L442-L458)

### 第六阶段：最后补责任边界

先看：

- Chapter 14

你要回答的是：

- 自动驾驶 / 机器人数据闭环的治理边界是什么
- 多租户、审计、隐私、责任追踪为什么不能晚到完全产品化以后再想

---

## 12. 用一句话记住每章对本项目的落点

| Chapter | 你要抓住的核心问题 | 对本项目最相关的落点 |
|---|---|---|
| 1. Trade-Offs in Data Systems Architecture | 先分清系统场景与架构边界 | 哪些是 transaction，哪些是 analytics，哪些是 pipeline |
| 2. Defining Nonfunctional Requirements | 明确到底优化什么 | local-first 先追求可跑、可理解、可演进 |
| 3. Data Models and Query Languages | 数据怎样表示最合适 | 样本、元数据、索引、导出视图不必由一种模型全包 |
| 4. Storage and Retrieval | 数据如何高效存与查 | SQLite metadata + Parquet + DuckDB + Lance |
| 5. Encoding and Evolution | 系统怎样演化不崩 | 统一资产模型、API、SDK、导出格式都是演化边界 |
| 6. Replication | 多副本同步怎么做 | local MVP 可弱化，企业版会变核心 |
| 7. Sharding | 数据太大如何横向拆分 | 多租户 SaaS 与大规模样本库必然会遇到 |
| 8. Transactions | 多步操作怎样保持正确 | 数据集创建、导出、元数据更新要识别事务边界 |
| 9. The Trouble with Distributed Systems | 分布式为什么难 | 企业化后必须显式考虑部分失败、超时、时钟 |
| 10. Consistency and Consensus | 如何达成一致 | 调度、任务状态、元数据主控会涉及一致性 |
| 11. Batch Processing | 离线全量处理如何组织 | ingestion、资产物化、导出都很像 batch pipeline |
| 12. Stream Processing | 实时事件流如何处理 | 未来在线闭环、增量刷新、事件驱动索引更依赖流处理 |
| 13. A Philosophy of Streaming Systems | 怎么把多种系统拼成整体 | 项目本质上是 ingestion -> lakehouse -> platform dataflow |
| 14. Doing the Right Thing | 技术之外的边界是什么 | 自动驾驶数据平台必须考虑隐私、治理、责任 |

---

## 13. 最后结论

如果你是这个项目的开发者，请先建立这样一个总心智：

> 这个项目不是“在本地拼几个工具”，而是在用 local-first 的方式，演练一个未来可演进到 enterprise / SaaS 的数据密集型闭环平台。

因此最推荐的理解顺序不是：

1. 先学某个框架
2. 再学某个接口
3. 最后再想系统问题

而是：

1. 先用 DDIA2 建立系统级认知
2. 再回来看本仓库的分层、模型、workflow 和 profile
3. 最后再决定具体实现和下一阶段演进

如果你把这份认知地图记住了，那么你再看这个仓库时，就不会只看到：

- 一个 FastAPI
- 一个 BFF
- 一个 Dagster
- 一个 DuckDB demo

你会看到的是：

- transaction path 与 analytics path 的分离
- derived data pipeline 的形成
- local-first 与 future scale-out 的 trade-off
- 数据模型、存储模型、访问模型之间的明确分工
- 从个人版到企业版再到 SaaS 版的系统演进路线

这才是本项目最值得学的部分。
