# 系统目录与领域模型设计

> 父：[架构总览](./overview.md) · [系统分层总览](./system-layers.md) · [分层与编排边界](./layering-and-orchestrator-boundaries.md)
>
> 本文给出 monorepo 目录结构与平台核心领域模型的目标态。两件事一篇讲清：**目录怎么放**，**对象怎么组织**。

---

## 一、设计原则

1. **`core` 只放事实，不放生命周期**。`python/core` 承载领域对象、状态机、契约；不承载 server / 调度循环 / route handler。
2. **service 与 workflow 分立**。框架中立的流程库放 `python/workflows`；进程内事务型服务放 `apps/<app>/src/services/`。判定测试见 [分层与编排边界](./layering-and-orchestrator-boundaries.md)。
3. **目录围绕能力域，不围绕实现细节**。能力域：ingestion / catalog / versioning / scenarios / tasks / scheduler / query / quality / governance / feedback / evaluation。

---

## 二、目录结构

```text
docs/                       # 文档（按读者画像组织）
apps/
  web/                      # React 工作台
  bff/                      # Node.js BFF：聚合 + ViewModel
  api/                      # FastAPI Platform API
  orchestrator/             # Dagster code location
  scheduler/                # 独立调度服务（独立进程）
packages/
  contracts/                # TS 共享 contract（按能力域分子目录）
  schemas/                  # JSON schema / form schema
  profiles/                 # runtime profile + capability model
python/
  core/                     # 领域对象 + 契约（无依赖）
  adapters/                 # provider 实现
  profiles/                 # RuntimeContainer 装配
  workflows/                # 框架中立的流程库
sdk/python/                 # Python 外部 SDK
infra/profiles/             # YAML profile
data/                       # 本地 demo 数据
```

### apps 层

| 模块 | 职责 | 关键约束 |
|---|---|---|
| `apps/web` | 工作台 UI | 不直接调 Platform API，走 BFF |
| `apps/bff` | 浏览器请求接入、session/tenant、ViewModel 聚合 | 不重复定义 domain fact |
| `apps/api` | Platform API、控制面入口、SDK 访问面 | route handler 薄壳，业务调 service / workflow |
| `apps/api/src/services/` | 进程内事务型服务（`dataset_slice_service` / `event_service` / `snapshot_service`） | 与 SQLAlchemy session 绑定 |
| `apps/orchestrator` | Dagster asset / job / schedule / sensor / resource | asset body 只调 workflow，不写业务流程 |
| `apps/scheduler` | 独立调度服务：dispatch / retry / callback / quota | 与 `python/workflows/scheduler` 配对 |

### python 层

| 模块 | 职责 |
|---|---|
| `python/core/domain/` | 按领域分文件：identities / assets / catalog / versioning / scenarios / tasks / scheduler / quality / governance / feedback / mlops / profiles |
| `python/core/interfaces/` | adapter 契约：contracts / scheduler / layout / manifests |
| `python/adapters/` | 按技术分目录：auth / compute / ingestion / layout / manifests / metadata / query / quality / governance / scheduler / storage / table / vector |
| `python/profiles/` | YAML profile 加载、`RuntimeContainer` 装配 |
| `python/workflows/` | 见下表 |

### `python/workflows` 子目录

按能力域组织，每个子域只接收 `RuntimeContainer` + 普通参数：

```text
python/workflows/src/workflows/
  ingestion/        # source registration、import submission、ingest manifest
  catalog/          # dataset / workspace catalog
  versioning/       # publish / compare / rollback / manifest
  scenarios/        # scenario grouping、badcase grouping
  scheduler/        # job dispatch / retry / state transition
  query/            # ad hoc query、analysis access、saved query
  quality/          # quality check orchestration / gate evaluation
  governance/       # audit / approval / export policy enforcement
  exports/          # export orchestration
  feedback/         # feedback ingestion / aggregation
  evaluation/       # evaluation ingestion / report assembly
  layout/           # artifact path resolution
  materialization/  # 资产物化
  demo/             # scenario_triage / local streaming 等 entry
  streaming/        # streaming runner
```

---

## 三、领域模型

平台核心对象按 8 组分层：资产 / 目录 / 版本 / 场景 / 任务 / 调度 / 质量治理 / 反馈模型。

### 3.1 资产层

```text
RawRecord → Clip → ClipEmbedding → ArtifactRecord
```

| 对象 | 关键字段 |
|---|---|
| `RawRecord` | `raw_id` / `source_id` / `source_uri` / `ingest_run_id` / `modality` / `content_type` / `captured_at` / `metadata` |
| `Clip` | `clip_id` / `raw_record_ids` / `start_time` / `end_time` / `vehicle_name` / `scenario` / `tags` / `da_tags` / `keyframe_count` / `mp4_path` / `workspace_id` |
| `ArtifactRecord` | `artifact_id` / `artifact_type` / `uri` / `producer_run_id` / `dataset_version_id` / `checksum` |

`Clip` 是平台最小统一业务单元，以 `data/lance/c-<uuid>/` 为文物。点查 / 批查 / scenario 聚合走 `adapters.catalog.ClipCatalogIndex`（SQLite），不逐 clip 打开 Lance。

### 3.2 目录与版本层

```text
Workspace → Dataset → DatasetVersion → DatasetSnapshotManifest → ExportArtifactManifest
```

| 对象 | 关键字段 |
|---|---|
| `Workspace` | `workspace_id` / `name` / `owner` / `default_profile` |
| `Dataset` | `dataset_id` / `workspace_id` / `name` / `dataset_type`（customized / official）/ `current_version_id` |
| `DatasetVersion` | `dataset_version_id` / `dataset_id` / `version_label` / `status` / `sample_count` / `manifest_id` |
| `DatasetSnapshotManifest` | `manifest_id` / `dataset_version_id` / `sample_refs` / `table_snapshot` / `index_snapshot` / `quality_summary` / `lineage_refs` |
| `ExportArtifactManifest` | `export_id` / `dataset_version_id` / `format` / `artifact_uri` / `row_count` / `checksum` |

详见 [Dataset + Snowflake 设计](./dataset-design.md)。

### 3.3 场景层

```text
Scenario → ScenarioSlice → Episode / DriveSegment → BadCaseSet
```

| 对象 | 用途 |
|---|---|
| `Scenario` | 可被识别 / 筛选 / 统计 / 训练使用的场景单元（`scenario_id` / `scenario_type` / `dataset_version_id` / `tags` / `severity`） |
| `ScenarioSlice` | 场景切片或运营切面（夜间行人 / 雨天交叉路口 …） |
| `Episode` / `DriveSegment` | 连续时空片段，自动驾驶 / 机器人闭环基础对象 |
| `BadCaseSet` | 从反馈 / 评测 / 审核中沉淀的 hard cases |

### 3.4 任务层

```text
Task → MiningTask / LabelTask / ReviewTask → PromotionDecision
```

| 对象 | 关键字段 |
|---|---|
| `Task` | `task_id` / `task_type` / `status` / `priority` / `assignee` / `due_at` |
| `MiningTask` | 从规则 / 检索 / 模型 / 反馈中生成 |
| `LabelTask` | `instruction_ref` / `annotation_schema_ref` / `target_sample_ids` |
| `ReviewTask` | `review_target_task_id` / `decision` / `review_notes` |
| `PromotionDecision` | dataset version 是否可晋升为可导出 / 可训练 / 可共享 |

### 3.5 调度层

```text
JobSpec → JobRun → JobEvent + RetryPolicy
```

| 对象 | 关键字段 |
|---|---|
| `JobSpec` | 任务模板 |
| `JobRun` | `run_id` / `job_type` / `status` / `queue` / `submitted_at` / `started_at` / `finished_at` / `attempt` / `payload` |
| `JobEvent` | 状态推进事件流 |
| `RetryPolicy` | retry / backoff |

### 3.6 质量治理层

| 对象 | 用途 |
|---|---|
| `QualityRule` / `QualityCheckRun` / `QualityIssue` | 规则 + 扫描 + 问题三元组 |
| `PublishGate` | 版本晋升的质量门 |
| `AuditLog` / `ApprovalRecord` / `AccessPolicy` / `RetentionPolicy` | 审计 / 审批 / 访问 / 留存 |
| `SensitiveTag` | face / plate / location / pii |

### 3.7 反馈模型层

| 对象 | 来源 |
|---|---|
| `FeedbackEvent` | online failure / offline eval / human review / export consumer |
| `ModelVersion` / `TrainingSetBinding` / `ExperimentRun` / `EvaluationRun` / `EvaluationSuite` | 模型与评测绑定 |

---

## 四、核心关系链

```text
RawRecord → Clip → Dataset → DatasetVersion → DatasetSnapshotManifest

Clip → Scenario → MiningTask → LabelTask → ReviewTask

DatasetVersion → ExportArtifactManifest → TrainingSetBinding → EvaluationRun

EvaluationRun / HumanReview / OnlineFailure → FeedbackEvent → BadCaseSet → ScenarioSlice → 下一轮 MiningTask
```

这条闭环是 AI 数据中台的承载主线。

---

## 五、参考

- [架构总览](./overview.md)
- [分层与编排边界](./layering-and-orchestrator-boundaries.md)
- [Dataset + Snowflake 设计](./dataset-design.md)
- [系统分层总览](./system-layers.md)
- [Core / Adapters / Profiles / Workflows 分层](./core-adapters-profiles-workflows.md)
