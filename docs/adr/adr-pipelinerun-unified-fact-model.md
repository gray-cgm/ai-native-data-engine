# ADR: PipelineRun 统一事实模型 + x_trace_id 全链路追踪

- 状态：Accepted
- 日期：2026-04-24
- 关联：`docs/prd/requirement-management-system.md`、`docs/prd/ai-data-loop-infra-prd.md`、`docs/architecture/domain-model.md`

## 1. 背景 / Context

四层需求闭环对象边界定义为 `Requirement → DataTask → OperationsTask → PipelineRun`，但此前存在两类问题：

1. **PipelineRun 被视作 OperationsTask 的子对象**。流式、回补、修复等场景下，一条运行可能直接来自 DataTask 或 Scheduler，甚至是外部系统回放——嵌套在 OperationsTask 下会阻塞正常建模。
2. **跨系统追踪键缺失**。需求方、数据任务、外部采集方之间没有统一的 trace 键，链路审计需要在多个表里做模糊 join。

## 2. 决策 / Decision

### 2.1 PipelineRun 作为独立事实表

- PipelineRun 从"OperationsTask 的子资源"升级为 **独立的运行事实对象**。
- 对 `requirement_id` / `data_task_id` / `operations_task_id` 持外键引用，但 **不要求全部存在**（缺失表示该运行源自上层之外，如 Scheduler 或 External）。
- 新增字段：
  - `trigger_source`（枚举）：`data_task | operations_task | scheduler | manual | external`
  - `run_purpose`（枚举）：`initial_build | backfill | repair | reindex | replay | validation`
  - `trace_parent_id`：运行链路上父 span / 父 run 的标识

### 2.2 统一追踪键 `x_trace_id`

- 采用 `x_trace_id` 作为 **跨需求全链路唯一标识**（命名与 HTTP 头 `X-Trace-Id` 一致，便于通过 header / 日志字段 / 任务参数在 API、BFF、Worker、Dagster、Kafka、外部采集方之间传播）。
- `Requirement` 侧可选生成；`DataTask / OperationsTask / PipelineRun` 全部冗余存储同一 `x_trace_id`，支持"按链路筛选"查询。
- **废弃命名**：`loop_trace_id` 不再使用（比 `x_trace_id` 长且不利于 HTTP header 约定）。

### 2.3 枚举与状态收敛

- 新增枚举：`TriggerSource`、`RunPurpose`、`OperationsTaskStatus`、`OperationsModule`，全部定义在 `apps/api/src/models/base.py`。
- `OperationsTask` 新增为 SQLAlchemy 持久化模型（替换此前的纯 in-memory 方案），对应 ops_modules 六大子域。

## 3. 影响 / Consequences

### 正向

- UI Pipelines 模块可按 `x_trace_id` 一键聚合需求 → DT → Ops → Run 全链路，支撑 RunDetail 抽屉面包屑。
- 审计/回放场景（backfill / replay）用 `run_purpose` 清晰标注，历史 run 不再被误解释为"重复初始化"。
- 外部采集方对接只需透传 `X-Trace-Id` header + `requirement_id` 两个字段，契约极简。

### 成本

- SQLite schema 增列：生产环境需要 Alembic 迁移脚本；本地 demo 直接 `rm data/metadata/requirement.db` 重建。
- 既有路由 `/api/v1/pipeline-runs` 增加多个可选 query（`x_trace_id / requirement_id / operations_task_id / trigger_source / run_purpose`），响应体增量字段——客户端向后兼容。

## 4. 实施范围 / Scope

本 ADR 锚定的最小实现（MVP）：

1. `apps/api/src/models/requirement.py` 增 `OperationsTask` 表、`PipelineRun` 增列。
2. `apps/api/src/api/routes/pipelines.py` 增：
   - `GET /api/v1/pipeline-runs` 新增 5 个过滤参数
   - `GET /api/v1/pipeline-runs/{id}`：返回 `RunBreadcrumb`（Req/DT/Ops/Run 四层摘要）
   - `GET /api/v1/operations-tasks` 与 CRUD
   - `GET /api/v1/trace/{x_trace_id}`：一键聚合链路
3. `apps/api/src/scripts/seed_trace_demo.py`：随机生成完整 4 层链路，所有对象共享同一 `x_trace_id`，支持 `--requirements / --seed / --reset`。
4. `Makefile` 目标：`seed-trace-demo` / `seed-trace-demo-reset`。

**后续（Follow-up，非本 ADR）**：PolicyGate 门禁、质量阈值配置化、成本趋势分析与告警、trace 导出与审计快照。

## 6. 本次实现更新（2026-04-24）

基于本 ADR 的模型约束，以下能力已落地：

1. BFF passthrough 已上线：`/pipelines/runs`、`/pipelines/runs/:id`、`/pipelines/trace/:traceId`、`/pipelines/stage-stats`、`/pipelines/quality-stats`、`/pipelines/cost-stats`、`/pipelines/traces`。
2. Web Pipelines 六视图已上线：Overview / Runs / RunDetail / Lineage / Quality / Cost。
3. API 聚合路径已定稿为 `/api/v1/pipeline-stats/{stages,quality,cost}`，用于规避 `/api/v1/pipeline-runs/{run_id}` 的路由冲突风险。
4. Demo 数据种子已增强：`gate_result`、`gate_reason`、`cost_usd`、`cpu_seconds`、`gpu_seconds`、`storage_gb`，支持质量与成本聚合验证。

## 7. 下一步 Action

1. 在 API 层为 `/pipeline-stats/*` 增加时间范围参数（`from/to`）与默认窗口策略。
2. 在 BFF 层增加 page-specific ViewModel，减少前端对聚合字段的二次派生。
3. 在 Web 层增加 Quality/Cost 趋势图（时间序列）与异常点高亮。
4. 引入质量阈值配置（按 pipeline/stage/profile）并打通到发布门禁（PolicyGate）。
5. 增加 e2e 回归用例覆盖：trace 选择、质量分布、成本归因、run 级联跳转。
6. **Kafka Streaming 接入（已落地，2026-04-26）** —— 把 Streaming Pipeline 提升到与 Batch（Dagster）同等的可观测层级。详见下一节。

## 8. Kafka Streaming 集成（2026-04-26 落地）

### 8.1 背景

Pipelines Overview 之前的"Streaming"列只展示由 `make stream-demo` 写出的本地 JSONL 摘要 ——
没有真实 broker、没有消费 lag、没有 DLQ，也无法在产品层面"打开 Streaming Console"。本次将
Streaming Pipeline 与 Kafka 对接，使它和 Batch（Dagster Console）形成对称的可观测体验。

### 8.2 决策要点

| 维度 | 决策 |
| --- | --- |
| Broker | `apache/kafka:3.7.0` 单节点 KRaft 模式（不引入 Zookeeper），双 listener：`PLAINTEXT_HOST://localhost:9092`（host）+ `PLAINTEXT://kafka:9093`（in-compose）。 |
| Console | `provectuslabs/kafka-ui`，端口 `KAFKA_UI_PORT=8085`，作为平台 Tools 注册中心的第四个 tool（与 Dagster / Superset / Jupyter 同级，类别 `streaming`）。 |
| Topics | `streaming.events.raw`（主流量）、`streaming.events.dlq`（死信），可通过 `KAFKA_TOPIC_*` 环境变量覆盖。 |
| 幂等键 | 复合键 `(event_id, x_trace_id)`。`x_trace_id` 缺失时退化为 `(event_id, NULL)`，保证旧 producer 仍可去重。 |
| 失败路径 | 解析失败 / 写 Bronze 失败 → 直接发到 DLQ topic（包含 `error_class`、`error_message`、`original_topic`、`original_offset`、`payload`）。 |
| Lag 暴露 | 消费者每个 poll 周期把 `partition_lag` + counters 写入 `data/streaming/kafka_lag.json`，由 Platform API `/streaming/health` 读取并通过 BFF `/pipelines/streaming-health` 暴露到前端。 |
| 提交策略 | Manual commit：仅在「ledger 写入 + Bronze 落盘」都成功后才 `consumer.commit()`，最大化 at-least-once 语义。 |

### 8.3 代码改动地图

| 模块 | 文件 | 作用 |
| --- | --- | --- |
| Infra | `docker-compose.yml`、`Makefile`、`.env.example` | 一键拉起 broker + console（`make up-deps`），所有相关端口纳入 preflight 检查。 |
| Producer | `apps/api/src/scripts/streaming_demo.py` | 通过 `STREAMING_DEMO_TARGET={file,kafka}` 切换 sink；Kafka 模式下使用 `x_trace_id` 作为 partition key 并在 header 上透传 `x-trace-id` / `x-requirement-id`。 |
| Consumer | `apps/orchestrator/src/streaming/kafka_trigger.py` | 长驻进程（`make stream-kafka-consumer`），SQLite 幂等账本 + 自动 DLQ + 周期 lag 快照。 |
| Platform API | `apps/api/src/api/routes/streaming.py` | 新增 `GET /streaming/health`，合并 broker config + consumer 快照 + StreamingSummary。 |
| BFF | `apps/bff/src/engines/streamingEngine.ts`、`apps/bff/src/routes/pipelines.ts` | 新增 `/api/pipelines/streaming-health`：探测 kafka-ui `/actuator/health` + 转发 Platform `/streaming/health`，给前端一个 page-specific ViewModel。 |
| Tool registry | API `routes/tools.py`、BFF `services/tools.ts`、Web `shared/microfrontends/registry.ts` | 注册 `kafka-ui` 为第四类 platform tool（category=`streaming`），iframe 直连或网关代理两种集成模式都已就绪。 |
| Web Pipelines | `modules/pipelines/components/overview-view.tsx` | Streaming 卡片加 "Open Kafka UI console" 按钮（与 "Open Dagster console" 对称），新增 lag/DLQ 顶部 stat、按 partition 显示 lag 条、idle/down 状态有引导提示。 |

### 8.4 追踪契约扩展

ADR §5 的 trace propagation contract 增补 Kafka 行：

| 传输通道 | 字段名 | 示例 |
| --- | --- | --- |
| Kafka message key | （以 `x_trace_id` 为分区键） | 保证同 trace 事件落同一 partition、保留顺序 |
| Kafka header | `x-trace-id` | 与 HTTP `X-Trace-Id` 同义，由 producer 写入 |
| Kafka header | `x-requirement-id` | 与 `Requirement.id` 一致，便于消费侧路由 |
| DLQ envelope | `payload.x_trace_id` | DLQ 中保留原 payload，便于跨 topic trace 审计 |

### 8.5 Follow-up（非本 ADR 但已记录）

- 真正的 Dagster sensor / op 包装 `KafkaStreamingTrigger`，让 Dagster Runs 与 Kafka 消费形成统一血缘。
- DLQ 的"重放（replay）"工具：选定 trace 一键重放到主 topic，伴生 `run_purpose=replay` 的 PipelineRun。
- 多分区/多副本 broker 切换：本地 KRaft 单节点足够，部署到企业版时由 profile 切换为多节点 + SASL。
- kafka-ui 的 SSO + workspace-scoped ACL（生产前置项）。

## 5. 追踪键传播契约 / Trace Propagation Contract

| 传输通道 | 字段名 | 示例 |
| --- | --- | --- |
| HTTP Header | `X-Trace-Id` | `X-Trace-Id: trace_286a0dab429e` |
| 日志字段 | `x_trace_id` | `log.info("collect", extra={"x_trace_id": tid})` |
| 任务参数 (Dagster/Celery) | `x_trace_id` | `op_config={"x_trace_id": tid, ...}` |
| Kafka header | `x-trace-id` | 采集事件流透传到下游 |
| 外部采集方契约 | `x_trace_id` + `requirement_id` | 交付资产元数据必须附带 |

`trace_parent_id` 用于同一 `x_trace_id` 下的父子 run 关系（例如回放 run 的 parent 是上次失败的 run）。
