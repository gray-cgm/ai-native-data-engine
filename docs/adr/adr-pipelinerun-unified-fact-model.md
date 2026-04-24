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

## 5. 追踪键传播契约 / Trace Propagation Contract

| 传输通道 | 字段名 | 示例 |
| --- | --- | --- |
| HTTP Header | `X-Trace-Id` | `X-Trace-Id: trace_286a0dab429e` |
| 日志字段 | `x_trace_id` | `log.info("collect", extra={"x_trace_id": tid})` |
| 任务参数 (Dagster/Celery) | `x_trace_id` | `op_config={"x_trace_id": tid, ...}` |
| Kafka header | `x-trace-id` | 采集事件流透传到下游 |
| 外部采集方契约 | `x_trace_id` + `requirement_id` | 交付资产元数据必须附带 |

`trace_parent_id` 用于同一 `x_trace_id` 下的父子 run 关系（例如回放 run 的 parent 是上次失败的 run）。
