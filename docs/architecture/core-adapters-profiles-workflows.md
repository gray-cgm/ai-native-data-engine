# core / adapters / profiles / workflows 分层说明

## 为什么要补这篇文档

在当前仓库里，`python/core`、`python/adapters`、`python/profiles`、`python/workflows` 很容易被一起看成“都是 Python 代码目录”，但它们承担的是不同层级的职责。

如果不把这几层分开理解，后续在扩展 query、export、scheduler、labeling、mining 等能力时，代码很容易出现：

- 领域模型和技术实现混在一起
- workflow 直接操作 SQLite / DuckDB / Lance 细节
- app/service 生命周期逻辑被塞进 `python/core`
- 同一个概念在不同模块里出现多套定义

这篇文档的目标是补充说明：

- `python/core` 负责什么
- `python/adapters` 负责什么
- `python/profiles` 负责什么
- `python/workflows` 负责什么
- 为什么“领域模型”值得单独抽出来

同时，这篇文档也要回答另一个容易混淆的问题：

- `core / adapters / profiles / workflows` 这种代码分层
- 与“文件格式层 / 存储层 / 湖表格式层  / 计算层 / 查询层 / 应用层”这种系统分层

不是同一维度。

## 一句话理解四层关系

可以先记这句：

- `core`：定义世界观
- `adapters`：实现能力
- `profiles`：选择实现
- `workflows`：编排流程

换一种更工程化的说法：

- `python/core` 定义平台里的核心对象和能力契约
- `python/adapters` 提供这些能力的具体技术实现
- `python/profiles` 决定当前环境装配哪一套实现
- `python/workflows` 把这些能力串成 ingestion / query / export / orchestration 流程

如果映射到统一的六层系统模型，可以这样理解：

- `python/adapters/storage/*` 对应存储层
- `python/adapters/table/*` 对应湖表格式层或表管理层
- `python/adapters/vector/*`、`python/adapters/table/parquet/*` 对应文件格式层
- `python/adapters/compute/*` 与 `python/workflows/*` 主要落在计算层
- `python/adapters/query/*` 对应查询层
- `apps/web`、`apps/bff`、`apps/api`、SDK 与未来 BI / 标注 / 挖掘产品入口落在应用层

而 `python/core` 与元数据与事务控制层更像横切全层的稳定语义与控制能力，不应被简单归成某一个业务层。

## 1. `python/core`：领域模型 + 接口契约

`python/core` 不是“所有 Python 核心代码的杂物间”，它应该只放两类最稳定的东西：

1. 领域模型（domain models）
2. 接口契约（contracts / protocols）

### 1.1 领域模型是什么

领域模型，就是系统真正关心的业务对象。

从当前代码看，已经有这类模型：

- `SampleRecord`
- `DatasetSummary`
- `ComputeRun`
- `AuthenticatedUser`
- `LineageEvent`
- `ProfileCapabilities`
- `RuntimeProfile`

对应代码见：
- [models.py](../../python/core/src/core/domain/models.py)

这些模型表达的不是某个框架或数据库的细节，而是平台层面的业务事实。例如：

- 一个 sample 至少有哪些字段
- 一次 compute run 的状态如何表达
- 一个用户对象至少应该有哪些身份信息
- 一个 runtime profile 由哪些 provider 配置组成

它们之所以要放在 `python/core`，是因为这些概念不应该依赖：

- FastAPI
- Dagster
- SQLite
- DuckDB
- Lance
- 本地文件系统

即使以后底层实现换掉，平台里的这些核心概念通常仍然成立。

### 1.2 领域模型具体代码有什么作用

领域模型代码最核心的作用，是把业务语义固定下来。

它的价值主要体现在四点：

#### 1) 统一系统语言

例如“dataset”“dataset version”“task”“export job”“job run”这些概念，应该在 API、workflow、SDK、BFF 中都指向同一套含义，而不是每一层各起一套名字。

#### 2) 隔离业务语义和底层技术

workflow 关心的是“创建 dataset version”“记录 lineage”“创建 export job”，而不应该直接绑定在 SQLite row、DuckDB SQL 或 Lance index API 上。

#### 3) 让多个服务共享同一套平台事实

未来不只是 `apps/api` 会使用这些概念，`apps/bff`、`apps/orchestrator`、未来的 `apps/scheduler`、SDK、labeling/mining app 都会共享同一套平台语义。

#### 4) 让上层流程代码更稳定

如果 workflow 和 app handler 都依赖统一领域模型，那么底层实现替换时，不需要把整条业务流程一起推翻。

## 2. `python/core` 中另一类东西：接口契约

除了领域模型，`python/core` 还定义“平台需要哪些能力”。

当前代码见：
- [contracts.py](../../python/core/src/core/interfaces/contracts.py)

其中定义了多类 Protocol：

- `StorageAdapter`
- `QueryAdapter`
- `ComputeAdapter`
- `MetadataAdapter`
- `TableAdapter`
- `SearchAdapter`
- `AuthAdapter`

这些 Protocol 的意思不是“实现已经写完”，而是：

- 如果系统需要 metadata 能力，最少应该暴露哪些方法
- 如果系统需要 query 能力，最少应该能做哪些事
- 如果系统需要 search 能力，最少应该支持哪些操作

也就是说，`python/core` 先定义：

**平台需要什么能力**

而不是提前写死：

**平台必须怎样用某个具体技术实现这些能力**

这就是为什么 adapter contract 应放在 `core`，而不是直接写在具体 SQLite / DuckDB / Lance 实现里。

## 3. `python/adapters`：具体实现层

如果说 `core` 回答的是“系统需要什么能力”，那 `python/adapters` 回答的就是：

**这些能力具体怎么实现。**

例如：

- metadata 用 SQLite 实现
- query 用 DuckDB 实现
- search 用 Lance 实现
- storage 用 local filesystem 实现
- compute 用 local python 或 Dagster 实现

因此，adapter 的职责是：

- 把 `core` 定义的接口真正落到具体技术上
- 屏蔽底层库的调用细节
- 让上层不必直接耦合具体实现

在六层模型下，它承担的是“把系统分层落成具体 provider”的职责，例如：

- 存储层：local fs / S3 / OSS / HDFS
- 湖表格式层：Iceberg / Paimon / Hudi
- 文件格式层：Parquet / Lance
- 计算层：local Python / Dagster / Spark / Flink / Fluss
- 查询层：DuckDB / Trino / StarRocks

理想状态下：

- workflow 不直接拼 SQLite SQL
- API 不直接操作 DuckDB connection
- app/service 不直接调用 Lance 索引细节

这些都应该尽量收敛到 adapter 层。

## 4. `python/profiles`：运行时装配层

当系统同时支持多种实现时，还需要一层来回答：

**当前环境到底选哪套实现？**

这就是 `python/profiles` 的职责。

它负责：

- 读取 profile 配置
- 选择具体 adapter 实现
- 组装成统一的 runtime container

当前关键结构见：
- [runtime.py](../../python/core/src/core/profiles/runtime.py)

`RuntimeContainer` 把一组能力打包在一起：

- `storage`
- `query`
- `compute`
- `metadata`
- `search`
- `auth`
- `table`

以及：

- `profile`
- `capabilities`

它本质上是在做“代码世界里的分层装配”而不是“重新定义系统分层”。

例如在 `local-dev` 下，更准确的说法是：

- 存储层 provider = local fs
- 文件格式层 provider = Parquet / Lance
- 计算层 provider = local Python / Dagster
- 查询层 provider = DuckDB
- 元数据与事务控制层 provider = SQLite
- 应用层入口 = Web / BFF / Platform API / SDK

这意味着上层代码依赖的是“已经装配好的能力集合”，而不是某个具体产品。

也就是说，workflow 拿到的是：

- 一个统一的 container
- 里面已经放好了当前环境该用的 metadata/query/search/... adapter

而不是自己去判断：

- local-dev 用 SQLite 还是 Postgres
- query 应该调 DuckDB 还是别的引擎
- search 应该调 Lance 还是别的索引

## 5. `python/workflows`：流程编排层

`python/workflows` 的职责不是定义世界观，也不是实现底层技术，而是：

**把已经存在的能力组合成业务流程。**

例如：

- ingestion workflow
- asset materialization workflow
- query/export orchestration
- 后续的 scheduler orchestration

它更关注：

- 先做什么
- 后做什么
- 哪些能力如何组合
- 某个业务链路如何贯通

而不是：

- SampleRecord 的字段定义是什么
- DuckDB 具体如何 materialize table
- SQLite 连接怎么创建

这些问题分别属于 `core` 和 `adapters`。

所以 workflow 最理想的写法通常是：

- 接收 `RuntimeContainer`
- 调用 container 中的 adapters
- 操作统一领域模型/结构
- 记录 metadata / lineage / task / job run

而不是直接塞满底层实现细节。

从统一分层语言看，`python/workflows` 最接近计算层中的“流程编排子层”。它不应该冒充查询层，也不应该直接变成应用层页面逻辑。

## 6. 为什么 scheduler server 不应该放在 `python/core`

这是最容易混淆的一点。

很多人会觉得“调度器很核心”，所以是不是该放在 `python/core`。

答案通常是否定的。

原因是：

- `python/core` 负责定义系统事实和能力契约
- scheduler server 属于运行中的应用服务

像下面这些东西：

- HTTP server
- callback endpoint
- 后台轮询 loop
- resource manager
- 任务触发与状态推进
- service lifecycle

都属于应用服务行为，而不是领域模型本身。

所以更合理的放置方式是：

- `python/core`：定义 Task、JobRun、状态表达、所需接口能力
- `python/workflows`：当前阶段承载调度编排逻辑
- `python/services/scheduler`：未来沉淀 scheduler 应用服务层
- `apps/scheduler`：未来独立服务入口

## 7. 一个常用类比

可以把这四层理解成建筑体系：

### `python/core`
像建筑图纸和接口标准：

- 房间有哪些
- 水电接口标准是什么
- 哪些能力必须存在

### `python/adapters`
像具体施工方案：

- 用红砖还是钢结构
- 用哪种水管
- 用哪种施工工艺

### `python/profiles`
像项目配置单：

- 这个项目选哪套方案
- 当前环境启用哪些能力

### `python/workflows`
像施工流程：

- 先打地基
- 再搭框架
- 再布线
- 最后验收

## 8. 当前仓库里最值得先看的三个文件

如果你想顺着真实代码理解，推荐先看：

1. [models.py](../../python/core/src/core/domain/models.py)
   - 看平台有哪些核心对象
2. [contracts.py](../../python/core/src/core/interfaces/contracts.py)
   - 看平台声明需要哪些能力
3. [runtime.py](../../python/core/src/core/profiles/runtime.py)
   - 看这些能力怎样被统一装进 `RuntimeContainer`

可以先形成这样一个心智模型：

- `models.py`：定义“对象是什么”
- `contracts.py`：定义“能力长什么样”
- `runtime.py`：定义“能力如何被装配后交给上层使用”

## 9. Python core 和 Node.js BFF 怎么共享一套知识

这是一个跨语言系统里最关键的问题之一。

结论不是让 `apps/bff` 直接复用 `python/core` 的 Python 类，而是让两边共享同一套：

- 领域语义
- 资源语义
- 字段结构
- 状态枚举
- API contract

也就是说，跨语言共享的核心不是代码文件，而是契约。

### 9.1 推荐的数据与契约流转路径

当前仓库里，最合理的知识流转路径是：

```text
python/core
-> 定义平台领域语义与接口契约
-> apps/api (FastAPI Platform API)
-> 暴露稳定的 HTTP / JSON contract
-> apps/bff (Node.js)
-> 组合为页面友好的 ViewModel
-> apps/web
```

其中：

- `python/core` 定义平台里的核心对象和能力边界
- `apps/api` 把这些平台语义暴露为稳定 API
- `apps/bff` 消费这些 API，并进行页面聚合
- `apps/web` 只消费 BFF 返回的 app-facing payload

### 9.2 为什么不是直接共享 Python 代码

因为 `apps/bff` 是 Node.js + TypeScript，无法直接 import Python 类。

因此真正应该共享的是：

- 对“Dataset / Task / ExportJob / DatasetVersion”这些对象的统一理解
- 对字段命名、状态枚举、资源边界的统一约定
- 对请求/响应结构的稳定 contract

这意味着：

- 平台事实模型由 Python 平台侧主导
- 页面聚合模型由 BFF 主导
- BFF 不重新发明平台事实层，只在其上做 app-facing 编排

### 9.3 两边各自负责什么

可以把边界理解成两套模型：

#### 平台事实模型（Python 侧主导）

例如：

- Dataset
- DatasetVersion
- Task
- ExportJob
- JobRun
- Search result 的基础语义

这些模型对应平台真实资源，应该由：

- `python/core`
- `apps/api`

共同定义和暴露。

#### 页面聚合模型（BFF 侧主导）

例如：

- dashboard payload
- 页面卡片统计结构
- 组合多个平台接口后的 ViewModel
- 前端专用的排序、分组、展示态字段

这些模型不属于平台事实本身，而属于 app-facing 结果，因此应该由：

- `apps/bff`

主导定义。

### 9.4 当前阶段最合适的共享方式

当前阶段最现实的做法是：

1. `python/core` 定义平台领域语义
2. `apps/api` 提供稳定 Platform API
3. `apps/bff` 通过 HTTP 调用 Platform API
4. `apps/bff` 内部用 TS types 表达这些返回结构

这已经足够让 Python backend 与 Node.js BFF 共享同一套平台知识，而不要求直接共享语言级代码。

### 9.5 后续可演进的方式

如果后续希望跨语言一致性更强，可以继续演进为：

- Python 侧领域模型 / API 作为 source of truth
- 通过 OpenAPI / JSON Schema 导出契约
- 在 TS 侧生成类型或 client
- `packages/schemas` / `packages/contracts` 逐步沉淀为 Node/Web 侧共享 contract layer

这样可以进一步减少：

- BFF 手写重复 DTO
- 字段命名漂移
- 状态枚举不一致
- 平台 API 与前端/BFF 类型定义分叉

## 10. 最后的总结

在这个仓库里，推荐始终保持下面的边界：

- `python/core`：定义业务对象和接口契约
- `python/adapters`：实现这些契约
- `python/profiles`：选择并装配实现
- `python/workflows`：编排业务流程
- `apps/api`：把 Python 侧平台语义暴露成稳定 contract
- `apps/bff`：消费平台 contract，并转成页面友好的聚合模型

这样做的价值是：

- 平台语义稳定
- 技术实现可替换
- 流程逻辑更清晰
- 多 app / 多 service 更容易共享同一套底座
- Python backend 与 Node.js BFF 可以共享同一套知识，而不强行共享同一份代码

这也是后续继续演进 query、export、scheduler、labeling、mining 等模块时，最重要的代码组织原则之一。
