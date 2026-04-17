# Local-First Streaming 演进设计

## 为什么现在就补 streaming 文档

当前仓库的主链路是 local-first 批式 demo，这没有问题。

但如果未来目标包含：

- 超大数据量采集接入
- 高频事件流
- 实时清洗与加工
- 批流一体的数据资产治理

那么 streaming 不能等到企业版才开始设计。

更合理的方式是：

- 在本地阶段先验证 streaming 的语义边界
- 在团队版和企业版阶段再替换底层日志、计算和服务基础设施

这篇文档给出一条与当前仓库兼容的演进路径。

## 当前 local-first streaming demo 的定位

当前新增的本地 streaming demo，不是生产级流平台，而是一个边界验证器。

它做的事情是：

```text
local event source
-> JSONL event log
-> local micro-batch processing
-> bronze normalized log
-> current-state snapshot
-> DuckDB query
-> Lance search index
-> metadata / lineage / export
```

这条链路解决的是“系统语义先成立”，而不是“吞吐量先最大化”。

## 设计原则

### 1. 不把 streaming 视为批处理的放大版

未来 streaming 架构必须引入独立的数据接入和平面执行能力。

也就是说，未来目标不应是：

```text
more files
-> bigger batch job
```

而应是：

```text
event ingestion
-> durable log
-> streaming compute
-> serving + lakehouse materialization
```

### 2. 不让 Dagster 承担流式控制平面

Dagster 可以继续承担：

- asset-oriented batch orchestration
- offline materialization
- 定时近线流程

但不应承担：

- 高频流式消费调度
- 大规模事件状态管理
- 平台级实时任务控制平面

### 3. Streaming 结果仍然要进入统一平台语义

未来即使底层换成 Kafka / Flink / Iceberg / StarRocks，上层平台仍然应围绕统一对象建模：

- source
- stream
- streaming job
- dataset
- dataset version
- export artifact
- lineage event

## 分阶段演进路线

## Phase 0: Local-First Demo

目标：在当前单机环境里把 streaming 的平台语义走通。

建议做法：

- 本地 JSONL event log 作为 durable log 替身
- Python micro-batch runner 作为 stream processor 替身
- DuckDB + Lance 作为查询与检索替身
- SQLite metadata 继续承担最小控制面

当前仓库新增的 local-first streaming demo 就属于这个阶段。

## Phase 1: Team Dev Streaming

目标：让团队环境具备稳定的流式接入和基础回放能力。

建议新增：

- Kafka 或 Pulsar 作为 durable event log
- Postgres 作为 metadata / scheduler / checkpoint control store
- 独立 scheduler / task control plane
- 对象存储作为原始数据和中间结果存储

此阶段 Dagster 仍可保留，但主要负责离线资产与近线物化。

## Phase 2: Enterprise Streaming Platform

目标：支撑高吞吐、多租户、可观测、可治理的 streaming 数据底座。

建议演进：

- Flink 作为主流式计算引擎
- Iceberg 或 Paimon 承担流批一体湖表层
- StarRocks / Trino / Pinot / ClickHouse 按访问模式承担查询与 serving
- 独立 scheduler / job control plane 承担任务状态机、回调、重试、配额、审计

## 未来目标拓扑

```text
Edge / Device / App / CDC
-> Ingestion Gateway
-> Durable Event Log
-> Stream Processing Plane
-> Hot Serving / Online Index
-> Lakehouse Storage
-> Metadata / Catalog / Lineage / Policy
-> Platform API / BFF / SDK / Workbench
```

### Ingestion Gateway

负责：

- 接入协议
- 鉴权
- 限流
- 幂等键
- schema 校验
- 批量上传与断点续传

### Durable Event Log

负责：

- 顺序追加
- 分区
- 回放
- 保留策略
- 消费解耦

### Stream Processing Plane

负责：

- 去重
- 清洗
- 聚合
- 事件时间与 watermark
- 状态管理
- checkpoint

### Hot Serving / Online Index

负责：

- 实时 dashboard
- 在线检索
- 告警
- 低延迟读路径

### Lakehouse Storage

负责：

- 冷热分层
- 长期留存
- 回算
- dataset version 物化
- 训练与分析消费

### Metadata / Control Plane

负责：

- source registry
- stream registry
- schema versioning
- streaming job state machine
- lineage
- audit
- quality gates
- export contracts

## 与当前仓库目录的推荐映射

### `apps/orchestrator`

继续保留为 Dagster code location，只负责离线 / 近线资产编排。

### `apps/scheduler`

未来应升级为真正的 task control plane，负责：

- job submission
- run lifecycle
- retries
- callbacks
- quota / priority
- execution adapter routing

### `python/workflows`

继续保存框架中立的流程逻辑：

- batch workflows
- streaming materialization workflows
- dataset build workflows
- export workflows

### `python/services`

未来应从占位目录演进为应用服务层，负责：

- ingestion services
- query services
- scheduler services
- export services
- streaming control services

### `infra/profiles`

应从当前 provider 选择配置，逐步扩展出：

- event log provider
- stream processor provider
- serving engine provider
- scheduler provider

## 推荐新增的平台对象

为避免未来 streaming 直接绑死在底层技术上，建议在 domain / metadata 层逐步补齐这些对象：

- `Source`
- `Stream`
- `SchemaVersion`
- `StreamingJob`
- `Checkpoint`
- `MaterializationSpec`
- `ServingSpec`

## 推荐的 metadata / control-plane 最小关系

如果未来要把 streaming 从本地 demo 升级到真正的平台能力，建议 metadata 层至少补齐下面这些关系，而不是继续只靠 `dataset_versions` 和 `job_runs` 的最小表结构承载全部语义。

### 1. Source

表示事件来源，例如：

- device uploader
- vehicle collector
- edge gateway
- app event bus
- CDC connector

推荐字段：

- `source_id`
- `source_type`
- `owner`
- `auth_mode`
- `status`
- `retention_policy`

### 2. Stream

表示逻辑事件流，而不是某个具体文件或 topic 名字。

推荐字段：

- `stream_id`
- `source_id`
- `schema_version_id`
- `partition_key`
- `ordering_mode`
- `watermark_policy`
- `retention_policy`
- `replay_policy`

### 3. SchemaVersion

表示流式 payload 的版本化定义。

推荐字段：

- `schema_version_id`
- `stream_id`
- `format`
- `compatibility_mode`
- `event_time_field`
- `dedupe_key`

### 4. StreamingJob

表示一个稳定存在的流式作业定义，而不是一次性 run。

推荐字段：

- `streaming_job_id`
- `stream_id`
- `processor_provider`
- `materialization_spec`
- `serving_spec`
- `checkpoint_strategy`
- `status`

### 5. StreamingRun / Checkpoint

表示 streaming job 的一次运行状态与恢复点。

推荐字段：

- `streaming_run_id`
- `streaming_job_id`
- `offset_range`
- `checkpoint_id`
- `started_at`
- `updated_at`
- `status`
- `error_message`

### 6. DatasetVersion / ExportArtifact / LineageEvent

这些对象不应该因为引入 streaming 就被推翻，反而应继续作为 streaming 结果进入平台消费面的统一出口。

也就是说，流式系统最终仍然要回答：

- 当前结果沉淀成了哪个 `dataset_version`
- 导出了哪个 `export_artifact`
- 它与上游 `source / stream / streaming_job / checkpoint` 的 lineage 是什么

## 本地 demo 与未来 metadata 的对应关系

当前 local-first streaming demo 其实已经隐含了这套关系，只是还没有把它正式建模成独立表：

- `local-file-simulator` 对应 `Source`
- `local-events.jsonl` 对应 `Stream`
- 每次 micro-batch 对应 `StreamingRun`
- `stream-batch-001` 等版本对应 `DatasetVersion`
- `local-streaming-demo-latest.jsonl` 对应 `ExportArtifact`

这也是为什么这条 demo 虽然很轻，但它对未来演进仍然有价值：它已经把对象关系放到了正确的方向上。

## 当前 demo 的意义

这条 local-first streaming demo 最重要的价值，不是吞吐量，而是让仓库提前拥有下面这条演进路径：

```text
single-machine event simulation
-> team-scale durable log
-> enterprise streaming compute
-> batch-stream unified data platform
```

这样未来升级时，真正变化的是 provider 和 execution plane，而不是平台 API、数据资产模型和整体目录边界。