# 模块 PRD · Pipelines（运行 / 血缘 / 质量 / 成本）

> 父文档：[整体产品 PRD](./ai-data-loop-infra-prd.md)
> 路由：`/pipelines` （5 个内部 Tab）

## 1. 模块定位

Pipelines 是**机器执行的可观测层**——所有 batch + streaming 的 PipelineRun 都在这里集中观察：执行状态、血缘、质量门、成本归因。它是项目运营层（O&M）的总入口。

> 简单记忆：**人在 Operations，机器在 Pipelines；两者都通过 x_trace_id 串通**。

## 2. 5 个 Tab

| Tab | 内容 | 数据源 |
|---|---|---|
| **Overview** | Dagster batch + Kafka streaming 综合态势 | `/api/v1/pipeline-stats/*` + `/api/pipelines/streaming-health` |
| **Runs** | PipelineRun 全链路过滤（trace / requirement / ops_task / step / status / trigger / purpose） | `/api/v1/pipeline-runs` |
| **Lineage** | 按 x_trace_id 聚合的 Mermaid DAG 血缘视图 | `/api/v1/trace/{x_trace_id}` |
| **Quality** | Gate 结果分布（pass / waiver / block）+ 失败原因 Top-N + 按 stage / purpose 钻取 | `/api/v1/pipeline-stats/quality` |
| **Cost** | 运行成本归因（Requirement / Pipeline / Stage / Purpose），CPU/GPU/Storage 汇总 | `/api/v1/pipeline-stats/cost` |

## 3. 用户故事

| 角色 | 场景 | 主操作 |
|---|---|---|
| 运维 | 早会扫一眼今日整体水位 | Overview Tab |
| PM | 跟踪一条 trace 完整链路 | Runs 过滤 trace_id → 点行打开 RunDetail 抽屉 |
| 数据架构 | 排查某个 release run 失败原因 | Quality Tab → 失败 Top-N → 点行进 RunDetail |
| FinOps | 按需求 / 阶段 / 模型回溯成本 | Cost Tab → 切换分组维度 |
| Release 工程师 | 看 release stage 的 gate 通过率趋势 | Quality + Cost 双 Tab 联动 |

## 4. 主要功能

### 4.1 PipelineRun 核心字段

| 字段 | 说明 |
|---|---|
| `data_task_id` | 必填，PipelineRun 归属的业务 DataTask |
| `x_trace_id` | 跨系统追踪键 |
| `trace_parent_id` | 父 span（链式追踪） |
| `requirement_id` | 冗余便于过滤 |
| `operations_task_id` | 可选：OpsTask 触发的 run |
| `trigger_source` | data_task / operations_task / scheduler / manual / external |
| `run_purpose` | initial_build / backfill / repair / reindex / replay / validation |
| `pipeline_name` | 显示用 |
| `stage` | step 名（自由文本：collect / clip-extract / feature-compute / release / streaming-replay） |
| `input_uri` / `output_uri` | 物理路径 |
| `status` | pending / running / success / failed |
| `config` (JSON) | step 级配置 |
| `metrics` (JSON) | cost_usd / cpu_s / gpu_s / storage_gb / duration_s / gate_result / gate_reason / rows_in / rows_out |

### 4.2 Run 列表过滤

- 链路：`requirement_id / data_task_id / operations_task_id / x_trace_id`
- 维度：`stage / status / trigger_source / run_purpose`
- 关键字：跨 pipeline_name / config / metrics 模糊
- 分页 + 时间倒序

### 4.3 RunDetail 抽屉

- 顶部 Breadcrumb：Requirement / DataTask / OpsTask / 自身 PipelineRun
- 关键字段卡 + metrics 仪表
- 关联 Asset 列表（input + output derived asset）
- 同 trace 的 sibling runs 列出（按 trace_parent_id 树）

### 4.4 Lineage 视图

- 取 trace 全链路对象 → 渲染 Mermaid DAG
- 节点：Requirement / DataTask / OpsTask / PipelineRun / Dataset / Asset
- 边：触发关系 + 输入输出关系
- 点节点跳详情

### 4.5 Quality 视图

- gate_result 饼图（pass / waiver / block）
- 失败原因 Top-N 列表
- 按 stage 横切（collect 失败 vs release 失败）
- 时间趋势图（待补：每日 gate 通过率）

### 4.6 Cost 视图

- 按 Requirement / Pipeline / Stage / Purpose 分组的 stacked bar
- CPU / GPU / Storage 三维度
- 时间序列趋势（待补）

## 5. 与其他模块的关系

| 上游 | 描述 |
|---|---|
| Operations · Mining / Release | 触发 PipelineRun，挂 `operations_task_id` |
| Dagster Asset | 落地 Run 状态与 metrics |
| Kafka streaming | 通过 streaming-replay step 关联 |

| 下游 | 描述 |
|---|---|
| Catalog Dataset | release step 的 PipelineRun 通过 snapshot manifest 关联 official dataset |
| FinOps / 老板看板 | Cost 视图聚合数据 |

## 6. 关键设计决策

- **PipelineRun 统一事实模型**（[ADR](../adr/adr-pipelinerun-unified-fact-model.md)）：所有执行（batch + streaming）落同一张表，靠 `trigger_source` + `run_purpose` 区分语义。
- **stage 字段是自由文本**——`PipelineStage` 不做枚举约束，step 名跟着工作流自然演进。
- **血缘走 Asset 表**——PipelineRun.input/output_uri 仅作展示，真正的数据流转通过 `Asset.producer_pipeline_run_id` 反查。

## 7. 待办与扩展

- [ ] Quality / Cost 时间趋势图与异常点高亮
- [ ] PolicyGate 发布门禁（quality 阈值配置化 → 阻断 release）
- [ ] page-specific ViewModel（BFF 减少前端二次派生）
- [ ] kafka-ui 网关化与 workspace ACL
- [ ] DLQ replay 工具
- [ ] Dagster sensor 包装（Kafka offset → asset materialize）
