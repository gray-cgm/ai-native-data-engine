# 模块 PRD · Requirement（需求管理）

> 父文档：[整体产品 PRD](./ai-data-loop-infra-prd.md)
> 路由：`/requirements` · `/requirements/:id` · `/requirements/:id/report`

## 1. 模块定位

Requirement 是**业务需求与数据交付承诺的入口**——所有数据相关的工作都从这里发起，最终通过 PipelineRun + Snapshot 在 Catalog 落地为 official Dataset。

> 简单记忆：**业务起点 = Requirement，业务终点 = official Dataset，中间用 x_trace_id 串起来**。

## 2. 用户故事

| 角色 | 场景 | 主操作 |
|---|---|---|
| Dre / 产品 | 提出「夜间 VRU 召回率从 88% 提到 95%」诉求 | 新建 Requirement，关联飞书需求文档 |
| 大数据团队 | 评审需求，决定是否进入排程 | 在 DataTask 上 Sign-off |
| PM | 跟踪一个需求的整体进度 | Requirements 列表筛选 / 详情页看四层闭环对象 |
| 算法 | 验收数据交付 | Requirements/:id/report 看产出的 official dataset + 关键指标 |

## 3. 主要功能

### 3.1 Requirement 列表

- 字段：title · priority · source（dre/product/algorithm/test）· status · dre_owner · target_scene · scene_tags · vehicle_tags · estimated_data_volume · due_date
- 筛选：status / priority / source / 关键字
- 状态机：`DRAFT → PENDING_REVIEW → APPROVED → IN_PROGRESS → COMPLETED / REJECTED`

### 3.2 Requirement 详情页（4 层闭环）

```
Requirement
  ├─ DataTasks (4 类：collection / annotation / quality_check / pipeline)
  │    └─ 每条带 sign_off_status (PENDING / APPROVED / REJECTED) + sign_off_by + at + comment
  ├─ OperationsTasks（Mining / Labeling / Tagging / Checking / Release）
  ├─ PipelineRuns（按 step：collect / clip-extract / feature-compute / release）
  └─ Snapshot Manifest（可点跳 official dataset）
```

### 3.3 Requirement Report 报表（`/requirements/:id/report`）—— Role-Based

> 设计与 [Overview Dashboard](./module-overview.md) 一致：3 段配色 SectionHeader（Manager / DE / MLE），单 requirement 维度的"小型 Overview"。每段卡都可下钻到对应模块。

#### 一句话定位
回答"**这个需求拉了哪些资源、生产了哪些数据集、训练效果怎么样、闭环回流到哪一轮**"。

#### 三段视角

**Section A · Manager（geekblue）—— 决策面**
- **Requirement 状态卡**：title / priority / status / sign-off 状态 / due date
- **Full-chain Funnel**：6 类 DataTask 的 actual / target 进度条（一行一类，颜色按完成度变红→橙→绿）
- **Cost Summary**：Pipeline 总成本（cost_usd / cpu_s / gpu_s / 持续时间）

**Section B · Data Engineer（volcano）—— 健康面**
- **Pipeline Health**：本需求 N 条 PipelineRun 的 success / failed / running 计数 + Failed Top 3（点击跳 `/pipelines?tab=runs&requirement_id=...`）
- **Linked Operations Tasks**（按 module 分组）：mining / labeling / tagging / checking / release 各 N 条，每行可点跳对应 ops 子域
- **Snapshot Receipts**：本需求挂的 `DatasetSnapshotManifest` 列表（含 sealed_at / artifact uri）

**Section C · Machine Learning Engineer（cyan）—— 资产 + 反馈面**
- **Linked Datasets（1:N 显式）**：本需求产出的所有 dataset（customized + official 都列），每个 dataset 一行：trainable / sample_count / 关联的 train_run_count / mean_loss / hard_ratio
- **Training Impact Rollup**：跨该需求所有 official datasets 的聚合（总消费量 / hard sample 数 / 训练 run 数）
- **Closed-Loop**：该需求触发的下一轮 mining task（如有）—— `parent_trace_id` 反指本轮 trace，列出 hard_sample 来源

#### 1:N 关系的强制可视化

> 一个 Requirement 可关联 **N 个 Dataset**（典型：1 customized + 1 official；含多版本 release 时 N 更大）。报告**永远展开**列出所有 N 个，不收起。
>
> Section C 的 "Linked Datasets" 卡顶部显示 `N customized · M official`，再展开列表，避免新人误认为 1:1。

#### 数据源（BFF 调用清单）

| 卡 | 端点 |
|---|---|
| Requirement 状态 | `GET /api/v1/requirements/{id}` |
| Full-chain Funnel | `GET /api/v1/data-tasks?requirement_id={id}` |
| Cost Summary | `GET /api/v1/pipeline-runs?requirement_id={id}` 求和 |
| Pipeline Health | 同上 group by status |
| Operations Tasks | `GET /api/v1/operations-tasks?requirement_id={id}` |
| Snapshot Receipts | `GET /api/v1/snapshots?requirement_id={id}` |
| Linked Datasets | `GET /api/v1/datasets?requirement_id={id}` |
| Training Impact | 对每个 dataset_id 调 `GET /api/v1/exports/contributions/rollup?dataset_id=X` |
| Closed-Loop | `GET /api/v1/operations-tasks?requirement_id={id}` filter `payload.parent_trace_id != null` |

不再依赖 legacy metadata adapter 的 `/tasks` `/runs` `/exports`（旧链路只覆盖 `metadata.db`，与新链路 `requirement.db` 不通）。

## 4. 与其他模块的关系

| 上游 | 描述 |
|---|---|
| 飞书 / Jira | `feishu_doc_id` 字段做软关联 |

| 下游 | 描述 |
|---|---|
| DataTasks | 由 Requirement 拆出的业务里程碑（默认 4 条） |
| OperationsTasks / PipelineRuns | 通过 `requirement_id` 反向关联 |
| Catalog Dataset | `Dataset.requirement_id` 把 dataset 挂回需求 |

## 5. 关键设计决策

- **DataTask 的 4 类是固定枚举**：`collection / annotation / pipeline / quality_check`。Requirement 拆解时自动生成 4 条占位 DataTask，每条独立 sign-off。
- **Sign-off 内嵌在 DataTask**，不开独立审批表——简单、可审计；如需多轮审批历史可后续扩展。
- **`x_trace_id` 在 Requirement 创建时不生成，在 OperationsTask 第一次执行时由 Mining 触发并向上回填**——保证一条 trace 横跨四层对象。

## 6. 待办与扩展

- [ ] CaseTemplate / RequirementCaseLink 资源化（验收用例的版本化）
- [ ] LLM 自动从飞书文档抽取 scene_tags / estimated_data_volume
- [ ] Requirement 看板视图（按 priority 看 backlog）
- [ ] 跨 Requirement 的样本去重检测
