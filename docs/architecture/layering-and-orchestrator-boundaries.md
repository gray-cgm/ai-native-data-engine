# 最终分层图与 orchestrator / workflows 边界

## 为什么单独补这篇文档

当前仓库已经有：

- `python/core`
- `python/adapters`
- `python/profiles`
- `python/workflows`
- `apps/orchestrator`\*\*\*\*

但随着 Dagster OSS 部署形态引入，最容易出现的新问题不是“有没有编排层”，而是：

- `python/workflows` 和 `apps/orchestrator` 会不会变成两套重复的编排系统
- workflow 逻辑是否会逐渐迁移到 Dagster definitions 里，导致业务逻辑分叉
- `python/services` 是否长期悬空，最终让 `workflows` 承担过多职责

因此，这篇文档单独给出一份更明确的：

1. **最终分层图**
2. **`python/workflows/` 的定位**
3. **`apps/orchestrator/` 的定位**
4. **`python/workflows/` 和 `apps/orchestrator/` 的推荐目录重构方案**

---

## 一句话结论

建议始终坚持下面这句边界原则：

- `python/workflows`：平台内部可复用的流程编排库
- `apps/orchestrator`：Dagster OSS 的 code location / orchestration control plane entry

换句话说：

> `python/workflows` 负责“流程能力本身”，  
> `apps/orchestrator` 负责“把这些流程接入 Dagster 运行时”。

如果一段逻辑 **离开 Dagster 仍然应该存在**，它通常不应该写死在 `apps/orchestrator`。

---

# 1. 最终分层图

## 1.1 逻辑分层图

```text
┌─────────────────────────────────────────────────────────────┐
│ Experience / Access Layer                                  │
│ apps/web  ->  apps/bff  ->  apps/api                       │
│                                                             │
│ 面向用户、SDK、自动化访问的入口层                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Orchestration Control Layer                                │
│ apps/orchestrator                                           │
│                                                             │
│ Dagster assets / jobs / schedules / sensors / resources     │
│ Dagster OSS deployment entry                                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Application Flow Layer                                     │
│ python/services                                             │
│ python/workflows                                            │
│                                                             │
│ services: 平台应用服务 / 业务能力入口                        │
│ workflows: 多步骤流程编排 / 批式流程组合                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Runtime Composition Layer                                  │
│ python/profiles                                             │
│ RuntimeContainer                                            │
│                                                             │
│ 负责根据 profile 装配具体运行时能力                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Capability Implementation Layer                            │
│ python/adapters                                             │
│                                                             │
│ SQLite / DuckDB / Lance / local fs / S3 / ...               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Stable Platform Semantics Layer                            │
│ python/core                                                 │
│                                                             │
│ domain models / contracts / capability protocols            │
└─────────────────────────────────────────────────────────────┘
```

---

## 1.2 调用关系图

```text
Web
-> BFF
-> Platform API
-> services / workflows
-> RuntimeContainer
-> adapters

Dagster Webserver / Daemon
-> apps/orchestrator (user code location)
-> services / workflows
-> RuntimeContainer
-> adapters
```

这个图的核心不是“谁能调用谁”，而是：

- API 和 Dagster 都可以成为流程入口
- 真正可复用的流程能力应该沉淀在 `services` / `workflows`
- `apps/orchestrator` 不应该成为另一套独立业务系统

---

# 2. `python/workflows/` 的定位

## 2.1 定义

`python/workflows/` 应被视为：

**平台内部可复用的流程编排库（library layer）**

它的职责是：

- 组合已经存在的能力
- 把多个步骤串成业务流程
- 为 API、CLI、测试、Dagster 提供统一的流程能力

它不是：

- 常驻服务
- Dagster deployment 项目
- HTTP 入口层
- runtime profile 装配层

---

## 2.2 它应该做什么

### 1) 组合多步骤流程

例如：

- ingestion workflow
- dataset materialization workflow
- search indexing workflow
- export workflow
- scenario bootstrap workflow

### 2) 消费 `RuntimeContainer`

workflow 最理想的入口是：

- 接收 `RuntimeContainer`
- 接收必要的输入参数
- 调用 adapter / service
- 返回稳定结构

### 3) 作为可复用流程能力库

应能被以下入口复用：

- FastAPI route
- CLI script
- 测试
- Dagster asset / op

---

## 2.3 它不应该做什么

### 1) 不承载 Dagster-specific runtime

不应放：

- `workspace.yaml`
- `dagster.yaml`
- gRPC server wiring
- daemon / webserver deployment config

### 2) 不承担服务生命周期

不应直接变成：

- scheduler process
- worker daemon
- API app

### 3) 不耦合某一个编排框架

今天是 Dagster，明天仍然可能存在：

- local python runner
- API direct execution
- test execution
- future external orchestrator integration

因此 `python/workflows` 应尽量保持框架中立。

---

## 2.4 当前仓库里的问题

当前这类代码：

- [python/workflows/src/workflows/assets/pipeline.py](../../python/workflows/src/workflows/assets/pipeline.py)

从内容上看更像“数据集物化流程”，而不是 Dagster 的 asset definition。  
但目录名 `assets/` 很容易和 Dagster asset 混淆。

因此建议未来逐步调整命名，让 `workflows` 保持“流程库”语义，而不是“Dagster project”语义。

---

# 3. `apps/orchestrator/` 的定位

## 3.1 定义

`apps/orchestrator/` 应被视为：

**Dagster OSS 的 code location / orchestration control plane entry**

它的职责是：

- 定义 Dagster assets/jobs/schedules/sensors
- 通过 Dagster resource 接入平台运行时
- 作为 Dagster OSS 的 user code location 暴露给 webserver / daemon

它不是：

- 核心业务逻辑的主沉淀位置
- 领域模型层
- runtime adapter 实现层

---

## 3.2 它应该做什么

### 1) 暴露 Dagster assets / jobs / schedules / sensors

例如：

- dataset materialization asset
- dataset distribution asset
- future partitioned assets
- schedule / sensor definitions

### 2) 作为 Dagster 与平台流程能力之间的绑定层

也就是说：

- `python/workflows` 提供流程函数
- `apps/orchestrator` 把这些流程包装成 Dagster 可调度对象

### 3) 承担 Dagster-specific deployment concerns

例如：

- code location entry
- gRPC serving
- asset graph
- partition definition
- daemon / webserver integration
- Dagster OSS deployment files

---

## 3.3 它不应该做什么

### 1) 不应重新沉淀核心业务语义

不要在 `apps/orchestrator` 中重新定义：

- Dataset
- DatasetVersion
- ExportJob
- Task
- LineageEvent

这些应该仍由 `python/core` 及其上层语义统一定义。

### 2) 不应直接吞掉 workflow / service 层

如果未来越来越多逻辑写成：

- asset 里直接 build container
- asset 里直接写底层导入/物化/导出细节

那么 `apps/orchestrator` 最终会长成“另一套应用层”，和 `python/workflows` 重叠。

---

# 4. `python/services/`、`python/workflows/`、`apps/orchestrator/` 的推荐关系

未来推荐明确形成三层：

## 4.1 `python/services`

**定位：平台应用服务层**

更贴近业务动作本身，例如：

- `DatasetService`
- `ExportService`
- `TaskService`
- `QueryService`

它负责：

- 业务入口语义
- 状态推进
- 规则组合
- 更稳定的用例级接口

---

## 4.2 `python/workflows`

**定位：多步骤流程编排层**

它负责：

- 组合多个 service
- 串联批式步骤
- 表达一条更长的业务链路

例如：

- bootstrap local dataset workflow
- reindex workflow
- export-and-register workflow

---

## 4.3 `apps/orchestrator`

**定位：Dagster binding layer**

它负责：

- 定义 asset graph
- 把 workflow/service 暴露为 Dagster 资产/任务
- 承接 Dagster runtime concern

---

# 5. 推荐目录重构方案

下面不是要求一次性重构完成，而是推荐的目标落位。

---

## 5.1 `python/workflows/` 推荐目录

当前：

```text
python/workflows/src/workflows/
  assets/
  demo/
  ingestion/
```

建议逐步演进为：

```text
python/workflows/src/workflows/
  ingestion/
    local_dataset.py
  materialization/
    datasets.py
    search_index.py
    exports.py
  bootstrap/
    local_demo.py
  query/
    distribution.py
  orchestration/
    reindex.py
    refresh.py
```

### 推荐原则

#### 1) 用流程语义命名，而不是用 Dagster 术语命名

例如：

- `materialization/datasets.py`
- `bootstrap/local_demo.py`

优于：

- `assets/pipeline.py`

#### 2) 保持入口函数稳定

例如：

- `bootstrap_local_demo(...)`
- `materialize_dataset_version(...)`
- `build_search_index(...)`
- `export_dataset_version(...)`

让 API、Dagster、测试都能复用同一组函数。

#### 3) 避免 workflow 直接写底层 provider 细节

如 [python/workflows/src/workflows/demo/pipeline.py](../../python/workflows/src/workflows/demo/pipeline.py) 这种直接 new `DuckDBQueryAdapter` / `LanceVectorAdapter` 的方式，建议后续收敛到：

- `RuntimeContainer`
- 或 service 层

否则会绕过 profile/runtime abstraction。

---

## 5.2 `apps/orchestrator/` 推荐目录

当前：

```text
apps/orchestrator/
  pyproject.toml
  src/
    definitions.py
```

建议目标结构：

```text
apps/orchestrator/
  pyproject.toml
  src/
    definitions.py
    assets/
      datasets.py
      search.py
      exports.py
    jobs/
      local_demo.py
    schedules/
      refresh_daily.py
    sensors/
      dataset_arrival.py
    resources/
      runtime.py
      profiles.py
```

---

## 5.3 各目录职责

### `src/definitions.py`

只负责聚合导出：

- assets
- jobs
- schedules
- sensors
- resources

不要把所有逻辑都塞在这里。

### `src/assets/`

放 Dagster asset definitions，例如：

- `dataset_asset_manifest`
- `dataset_distribution_asset`
- `search_index_asset`
- `export_asset`

这些 asset 内部应尽量调用：

- service
- workflow

而不是直接写业务细节。

### `src/resources/`

放 Dagster resource，例如：

- runtime container resource
- profile path resource

这样可以避免当前 `definitions.py` 里每个 asset 自己：

- `build_container(Path(...))`

### `src/jobs/`

放 asset job / selection job。

### `src/schedules/`

放定时调度定义。

### `src/sensors/`

放未来事件触发型自动化，例如：

- 新数据到达后触发 materialization
- 某类任务完成后触发 downstream workflow

---

# 6. 推荐落地顺序

## Phase 1：先收紧边界，不急着大迁移

1. 保持 `apps/orchestrator` 只作为 Dagster code location
2. 新逻辑优先放 `python/workflows` 或未来 `python/services`
3. 避免把更多业务逻辑直接写进 `definitions.py`

## Phase 2：把 `definitions.py` 拆小

1. 增加 `assets/`
2. 增加 `resources/`
3. `definitions.py` 只保留 Definitions 聚合

## Phase 3：逐步引入 `python/services`

1. 把稳定的用例级能力下沉为 service
2. workflow 改为组合 service
3. Dagster asset 调 workflow/service，而不是直接写底层流程细节

---

# 7. 最终判断标准

判断一段代码该放在哪，可以用这个问题：

## 如果明天不用 Dagster，这段代码还应该存在吗？

### 如果答案是“应该存在”

更可能属于：

- `python/services`
- `python/workflows`

### 如果答案是“只有 Dagster 运行时才需要”

更可能属于：

- `apps/orchestrator`

这条标准非常适合在后续代码评审中持续使用。

---

# 8. 最后结论

当前设计方向是合理的：

- `python/workflows` 作为流程编排层是对的
- `apps/orchestrator` 作为 Dagster 独立 app 是对的
- Dagster 不塞进 `python/core` 是对的

但需要始终避免这件事：

> 不要让 `python/workflows` 和 `apps/orchestrator` 最终长成两套重复编排系统。

更稳妥的长期边界应该是：

- `core`：平台事实与契约
- `adapters`：能力实现
- `profiles`：运行时装配
- `services`：应用服务
- `workflows`：流程编排库
- `orchestrator`：Dagster 运行时绑定层

只要坚持这个边界，当前 monorepo 架构是完全可以持续演进的。
