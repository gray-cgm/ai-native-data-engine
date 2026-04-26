# Unified Implementation Plan

> 目标：一份可连续执行的统一规划。
>
> - `implementation-backlog.md`（平台基础与工程主链）
> - `experience-access-layer-implementation-backlog.md`（Web/BFF 体验访问层）
> - `implement_blacklog.md`（human/simulation/model 三环闭环）

---

## 1. 统一原则（合并后的执行共识）

- [ ] **原则 1 - 不推翻骨架，只补能力**
  **输入：** `apps/web -> apps/bff -> apps/api` 与 `core/adapters/profiles/workflows` 现有分层
  **输出：** 保持边界稳定的实施策略
  **验收标准：** 新能力通过领域对象、服务层、页面层增量落地，不出现跨层硬耦合

- [ ] **原则 2 - 先打通端到端，再做纵深优化**
  **输入：** 现有 MVP 路由、DashboardPayload、任务/导出/搜索主流程
  **输出：** 以闭环可用优先的排期顺序
  **验收标准：** 每个阶段都有可演示、可验收的业务闭环

- [ ] **原则 3 - 读模型与命令模型分治**
  **输入：** Dashboard 聚合读模型、Export/Bootstrap 等命令入口
  **输出：** Read Model 与 Command Feedback 分离规范
  **验收标准：** 页面可读数据与触发动作具备稳定且可测试的契约

---

## 2. 分阶段统一规划

## Phase A（P0，2 周）- 最小闭环可运行

### Epic A1 - 平台主链稳定（来自 implementation-backlog）

- [ ] **P0 Task A1.1 - Runtime profile 与 container 装配固化**
  **输入：** `infra/profiles`、runtime wiring
  **输出：** `local-dev` 运行时装配基线
  **验收标准：** API/workflow 能稳定从 profile 构建 container 并执行业务流程

- [ ] **P0 Task A1.2 - DataLake MVP provider 主链验收**
  **输入：** storage/query/metadata/table/search adapters
  **输出：** ingestion -> materialization -> query/search -> export 贯通
  **验收标准：** demo 数据链路能真实运行并回写 metadata

### Epic A2 - 体验访问层闭环（来自 experience backlog）

- [ ] **P0 Task A2.1 - Workbench 路由与导航真值统一**
  **输入：** `routes.tsx`、`nav-config.ts`、PRD 页面流
  **输出：** 页面、路由、导航一致性基线
  **验收标准：** 五大模块与核心路由在文档和代码中一致

- [ ] **P0 Task A2.2 - Dashboard 聚合读模型稳定**
  **输入：** `/api/dashboard`、`DashboardPayload`
  **输出：** 前端统一切片消费方案
  **验收标准：** Overview/Catalog/Explorer/Operations/Pipelines 均走统一聚合入口

- [ ] **P0 Task A2.3 - Catalog/Explorer/Ops/Pipelines 最小页面四态齐全**
  **输入：** 页面组件与统一表格组件
  **输出：** loading/empty/error/ready 状态体系
  **验收标准：** 核心页面均可稳定处理无数据与失败场景

### Epic A3 - 三环最小语义落地（来自 implement backlog）

- [ ] **P0 Task A3.1 - 增加 SimulationRun/ModelEval/ErrorBucket 基础对象**
  **输入：** Requirement、Task、Run、DatasetVersion 现有语义
  **输出：** 三环核心对象及状态定义
  **验收标准：** 可表达需求、仿真、模型评测、失败样本的追溯关系

- [ ] **P0 Task A3.2 - Requirement -> Simulation -> OpsTask 最小回路**
  **输入：** requirement_id、simulation result、ops task model
  **输出：** 自动派单规则与回写机制
  **验收标准：** 仿真失败样本可自动创建运营任务并可追踪来源

---

## Phase B（P1，4-8 周）- 团队版核心能力

### Epic B1 - BFF page-specific ViewModel 演进

- [ ] **P1 Task B1.1 - 增加 page mapper 层**
  **输入：** 共享 DashboardPayload
  **输出：** Overview/Catalog/Explorer/Ops/Pipelines 显式 mapper
  **验收标准：** 前端二次派生逻辑明显收敛，接口语义更清晰

- [ ] **P1 Task B1.2 - 拆分页面读接口**
  **输入：** 现有 `/api/dashboard`
  **输出：** page-specific read endpoints
  **验收标准：** 新老接口可并行过渡且不破坏现有页面

### Epic B2 - 团队上下文与协作能力

- [ ] **P1 Task B2.1 - BFF 引入 workspace/project/tenant context**
  **输入：** workspace 语义与请求生命周期
  **输出：** request context 注入能力
  **验收标准：** 页面能显式感知上下文，且不污染 Platform API 资源语义

- [ ] **P1 Task B2.2 - tasks/exports/runs 刷新与诊断能力**
  **输入：** Operations/Pipelines 页面
  **输出：** 刷新机制 + 上游失败诊断提示
  **验收标准：** 无需整页刷新即可观察状态变化并定位失败模块

### Epic B3 - Simulation/Model 深化

- [ ] **P1 Task B3.1 - ScenarioTemplate + EvalSuite**
  **输入：** 场景模板需求、评测指标体系
  **输出：** 批量仿真模板与统一评测套件
  **验收标准：** 多次仿真可按统一指标横向比较

- [ ] **P1 Task B3.2 - HardCaseList + RetrainProposal**
  **输入：** ModelEval、ErrorBucket、DatasetVersion
  **输出：** 主动学习样本集与再训练提案流程
  **验收标准：** 可追踪从误差发现到再训练发布的链路

---

## Phase C（P2）- 治理与企业化预留

### Epic C1 - 发布门禁与审计治理

- [ ] **P2 Task C1.1 - PolicyGate 落地**
  **输入：** 安全/质量/成本阈值
  **输出：** 发布门禁规则与配置入口
  **验收标准：** 不满足阈值的模型/数据版本无法进入发布流程

- [ ] **P2 Task C1.2 - 审计与回滚机制**
  **输入：** run/task/eval/release 记录
  **输出：** 审计日志规范与回滚 SOP
  **验收标准：** 发布决策可追溯、可解释、可回滚

### Epic C2 - 企业版扩展点

- [ ] **P2 Task C2.1 - team/enterprise profile wiring**
  **输入：** provider map、adapter 占位实现
  **输出：** 团队版/企业版可切换拓扑
  **验收标准：** provider 替换不影响上层业务主干

- [ ] **P2 Task C2.2 - auth/permission 占位到可用**
  **输入：** 角色模型、动作权限边界
  **输出：** 最小 RBAC 行为控制
  **验收标准：** 可区分只读与命令执行权限

---

## 3. 统一依赖顺序（必须遵守）

- [ ] A1 -> A2：先稳定底层运行链，再扩展体验层页面
- [ ] A2 -> A3：先有稳定读模型与页面壳，再接入三环对象与流程
- [ ] A3 -> B3：先做最小三环语义，再做模板化仿真与再训练深化
- [ ] B1/B2 -> C1：先完成团队上下文与接口分层，再引入门禁治理
- [ ] C1 -> C2：治理规则先行，企业化 provider 和权限能力后置

---

## 2.X 完成/进行中阶段（追加）

- [x] **四层对象边界对齐（Requirement / DataTask / OperationsTask / PipelineRun）** — 已在 `docs/prd/requirement-management-system.md`、`docs/prd/ai-data-loop-infra-prd.md` 统一口径。
- [x] **PipelineRun 统一事实模型 + `x_trace_id` 全链路追踪** — 见 `docs/adr/adr-pipelinerun-unified-fact-model.md`。
  - [x] `OperationsTask` 持久化表 + `PipelineRun` 新增 `x_trace_id / trace_parent_id / requirement_id / operations_task_id / trigger_source / run_purpose`
  - [x] API：`GET /api/v1/pipeline-runs` 全链路过滤、`GET /api/v1/pipeline-runs/{id}` 面包屑、`GET /api/v1/trace/{x_trace_id}` 聚合、`/api/v1/operations-tasks` CRUD
  - [x] 随机 demo 播种：`apps/api/src/scripts/seed_trace_demo.py`（make seed-trace-demo）
- [x] **BFF passthrough + Web RunDetail 抽屉**
  - BFF：`apps/bff/src/routes/pipelines.ts` 暴露 `/pipelines/runs`、`/pipelines/runs/:id`、`/pipelines/trace/:traceId`、`/pipelines/stage-stats`，透传 API 的全链路过滤参数。
  - Web：`modules/pipelines/components/run-detail.drawer.tsx` 以 Timeline 呈现 Requirement → DataTask → OperationsTask → Run 面包屑与 trace keys。
- [x] **Pipelines 模块六视图升级**（Overview / Runs / RunDetail / Lineage / Quality / Cost，6 视图全部上线）
  - 新页面 `apps/web/src/modules/pipelines/pages/pipelines.page.tsx` 使用 antd Tabs，Runs 视图带 `x_trace_id / requirement_id / operations_task_id / stage / status / trigger_source / run_purpose` 多维过滤；点击行弹出 RunDetail 抽屉。
  - Lineage：支持 trace 选择器 + Mermaid DAG（Requirement -> DataTask -> OperationsTask -> PipelineRun）+ run 级钻取。
  - Quality：支持 gate 分布、失败原因 TopN、按 run_purpose / stage 质量拆解。
  - Cost：支持总成本与 CPU/GPU/Storage 聚合，按 Requirement/Pipeline/Stage/Purpose 成本归因。
  - API 路径已统一到 `/api/v1/pipeline-stats/{stages,quality,cost}`，BFF 对外保持 `/api/pipelines/{stage-stats,quality-stats,cost-stats}`。
- [x] **Alembic 迁移脚本**（替代 `create_all`，支撑生产升级）
  - `apps/api/alembic.ini` + `alembic/env.py` + baseline `103d2e06c8e1_baseline_schema.py`；`init_db()` 首次启动自动 `stamp head`，可通过 `API_SKIP_AUTO_MIGRATE=1` 关闭。
  - Makefile：`make db-upgrade / db-downgrade REV=… / db-stamp-head / db-revision MSG=… / db-current / db-history`。

### Pipelines 下一步 Action（新增）

- [ ] **Action P-1 - 时间趋势能力**
  **输入：** `/pipeline-stats/quality` 与 `/pipeline-stats/cost` 当前聚合结果
  **输出：** 按天/周趋势序列 + 时间窗口筛选（7d/30d/custom）
  **验收标准：** Quality/Cost 页面可切换时间窗口并稳定展示趋势变化

- [ ] **Action P-2 - Quality Gate 配置化与门禁联动**
  **输入：** gate_result、run_purpose、pipeline/stage 维度
  **输出：** 可配置阈值（pass_rate/block_rate）+ PolicyGate 拦截策略
  **验收标准：** 低于阈值的发布候选在流程中被阻断并给出可解释原因

- [ ] **Action P-3 - Cost drill-down 到 run 明细**
  **输入：** `cost_usd/cpu_seconds/gpu_seconds/storage_gb` run 级指标
  **输出：** 成本构成明细面板 + 高成本 run 排行
  **验收标准：** 能从 Requirement/Pipeline 聚合一键下钻到 run 级成本证据

- [ ] **Action P-4 - 回归测试与契约固化**
  **输入：** 现有 seed demo 数据与 `/pipeline-stats/*` 接口
  **输出：** API/BFF/Web 回归测试与契约样例
  **验收标准：** 重播 seed 后，Quality/Cost/Lineage 关键断言可稳定通过

- [x] **Action P-5 - Kafka Streaming 对接 + Streaming Console 可观测（已落地，2026-04-26）**
  **输入：** `apps/orchestrator/src/streaming/`（新增）、`apps/api/src/scripts/streaming_demo.py`（改造）、`docker-compose.yml`、`Makefile`
  **输出：**
    - `apache/kafka:3.7.0`（KRaft 单节点）+ `provectuslabs/kafka-ui`（端口 `KAFKA_UI_PORT=8085`）通过 `make kafka-up` / `make compose-deps` 一键拉起
    - `KafkaStreamingTrigger`（`apps/orchestrator/src/streaming/kafka_trigger.py`）：SQLite 幂等账本（`event_id` × `x_trace_id`）+ DLQ + 周期性 lag 快照
    - Producer：`make stream-demo-kafka` 用 `STREAMING_DEMO_TARGET=kafka` 把 clip-stream 事件发到 `streaming.events.raw`，`x_trace_id` 同时作为 partition key 与 `x-trace-id` header
    - 平台 API `GET /streaming/health` + BFF `GET /api/pipelines/streaming-health`（合并 kafka-ui `/actuator/health` + 消费者快照 + StreamingSummary）
    - kafka-ui 进入 Tools 注册中心（API/BFF/Web 三端 registry 全部更新，`/tools/kafka-ui` 工作台路由可用）
    - Pipelines Overview 增加 "Open Kafka UI console" 按钮（与 "Open Dagster console" 对称），新增 Lag/DLQ 顶部 stat、按 partition 显示 lag 进度条、idle/down 状态有引导提示
  **验收标准：**
    - `make kafka-up && make kafka-topics-init && make stream-demo-kafka && make stream-kafka-consumer` 在 30s 内能在 Pipelines Overview 看到非零 accepted、partition lag 归零、kafka-ui 可访问
    - 手工往 `streaming.events.raw` 投递格式错误的消息后，DLQ topic 出现错误信封，Overview 顶部 DLQ 计数 +1
    - 重复投递相同 `event_id` × `x_trace_id` 的消息不会增加 accepted 计数（duplicate counter +1）

### Kafka Streaming 后续 Action（新增 follow-up）

- [ ] **Action P-6 - 把 Kafka 消费者包成 Dagster sensor / op**
  **输入：** 现有 `KafkaStreamingTrigger`、Dagster `Definitions`
  **输出：** Dagster 视图能看到 Kafka-driven run 与既有 batch run 共用同一 lineage
  **验收标准：** 在 Dagster Runs 列表能看到 streaming run，且 PipelineRun 表里 `trigger_source=external` + `run_purpose=initial_build` 可被 trace 聚合到

- [ ] **Action P-7 - DLQ replay 工具**
  **输入：** `streaming.events.dlq` 中的错误信封
  **输出：** CLI / BFF 命令，按 `x_trace_id` 把 DLQ 消息回放到主 topic，并伴生 `run_purpose=replay` 的 PipelineRun
  **验收标准：** 用户在 Lineage 视图选定 trace → 一键 replay → 新 run 与原 run 形成 `trace_parent_id` 关系

- [ ] **Action P-8 - kafka-ui 网关化与权限**
  **输入：** 当前 direct-iframe 集成、企业 profile 的 SSO 需求
  **输出：** `tools-gateway-proxy` 中加 kafka-ui 反代规则；按 workspace 限制可见 cluster
  **验收标准：** 多 workspace 切换时 kafka-ui 仅展示当前 workspace 可访问的 topic，未授权动作（如 delete topic）被前置阻断

- [ ] **Action P-9 - 多分区/多副本 profile 切换**
  **输入：** `infra/profiles/local-dev.yaml` 当前为单节点，企业 profile 期望多 broker + SASL
  **输出：** Profile 中新增 `streaming.kafka` 配置块；`KafkaStreamingTrigger` 从 RuntimeContainer 读取
  **验收标准：** 切换 profile 后无需改代码即可连到外部 broker，且 README/quickstart 文档同步

---

## 4. 统一里程碑验收

### Milestone M1（2 周）

- [ ] 本地 demo 可完成 bootstrap -> catalog -> explorer -> export -> ops 闭环
- [ ] Workbench 五模块稳定可用，核心页面四态完整
- [ ] Requirement -> Simulation -> OpsTask 最小回路可跑通

### Milestone M2（4-8 周）

- [ ] BFF page-specific read model 可用
- [ ] workspace/tenant context 与协作刷新能力可用
- [ ] ScenarioTemplate、EvalSuite、HardCaseList、RetrainProposal 可用

### Milestone M3（后续）

- [ ] PolicyGate + Audit + Rollback 可用
- [ ] 团队版/企业版 profile 与权限扩展点可用

---

## 5. 执行建议（Claude Code 连续实施顺序）

1. 完成 Phase A 的 A1、A2，并在每个任务后补充最小 smoke 测试。
2. 完成 A3，先落对象与接口，再接页面链路，避免先做 UI 再补语义。
3. 进入 Phase B 时优先做 B1（接口分层），再做 B2/B3（协作与三环深化）。
4. Phase C 只做“可运行骨架 + 明确契约”，避免提前实现重型企业能力。

---

## 6. 关联文档

- 总体路线：`docs/adr/ai-data-platform-roadmap.md`
- 基础 backlog：`docs/adr/implementation-backlog.md`
- 体验层 backlog：`docs/adr/experience-access-layer-implementation-backlog.md`

本文件作为统一执行入口，后续新增任务优先追加到这里，再按专题回写各子 backlog，避免三份计划继续分叉。