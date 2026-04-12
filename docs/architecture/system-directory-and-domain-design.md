# 系统目录与领域模型设计

## 目的

本文基于当前 P0 / P1 roadmap，给出 `ai-data-loop-engine` 下一阶段的：

1. **系统目录设计**：未来 monorepo 应如何组织，才能承载闭环对象、任务运营、调度、治理与分析消费层
2. **领域模型设计**：未来平台核心对象应如何分层，才能从“本地数据工作台”演进到“AI 数据中台”

本文是设计文档，不要求当前仓库立即一次性重构到目标目录，而是提供一份可渐进落地的目标蓝图。

---

## 一、设计原则

### 1. 保持当前主干不推翻

以下主干边界继续保留：

- `apps/web`：工作台 UI
- `apps/bff`：app-facing 聚合层
- `apps/api`：Platform API / control plane entry
- `python/core`：领域模型与接口契约
- `python/adapters`：具体 provider 实现
- `python/profiles`：runtime container 装配
- `python/workflows`：流程编排

也就是说，后续不是“另起炉灶”，而是在当前骨架上补中台能力。

### 2. core 只定义平台事实，不承载服务生命周期

`python/core` 只负责：

- 平台领域对象
- state machine 所需枚举与约束
- contracts / protocols
- capability / manifest / policy 等稳定模型

不负责：

- server lifecycle
- scheduler loop
- queue worker
- route handler
- provider wiring

### 3. service 是 service，workflow 是 workflow

后续应明确区分：

- `python/services`：长期存在的应用服务层
- `python/workflows`：编排流程与批处理逻辑

其中：

- service 更关注能力组合、业务入口、状态推进
- workflow 更关注批式流程、资产物化、后台编排

### 4. 目录设计围绕平台能力域，不围绕单次实现细节

目录不应只围绕“现在有什么 provider”组织，而应围绕未来稳定的能力域组织：

- ingestion
- catalog / versioning
- task ops
- scheduler
- query / analysis
- quality
- governance
- feedback / evaluation

---

## 二、目标系统目录设计

## 2.1 顶层目录蓝图

```text
docs/
apps/
  web/
  bff/
  api/
  orchestrator/
  scheduler/
packages/
  config/
  contracts/
  profiles/
  schemas/
python/
  core/
  adapters/
  profiles/
  workflows/
  services/
sdk/
  python/
infra/
  profiles/
examples/
notebooks/
data/
```

相较于当前仓库，建议新增或强化的重点是：

- `apps/scheduler/`：从 placeholder 演进为独立服务入口
- `python/services/`：从 placeholder 演进为真实应用服务层
- `notebooks/`：承接 P1 自助分析 / notebook 消费场景

---

## 2.2 apps 层设计

### `apps/web`

职责：
- 工作台 UI
- 运营视图
- 数据集与版本浏览
- task board / review queue
- query console / quality report / governance page

建议目录：

```text
apps/web/src/
  pages/
    dashboard/
    datasets/
    versions/
    scenarios/
    tasks/
    review/
    query/
    quality/
    governance/
    exports/
  components/
  features/
  services/
  types/
```

### `apps/bff`

职责：
- 浏览器请求接入
- session / tenant / permission context
- 页面聚合与 app-facing ViewModel
- 不重写平台 domain fact

建议目录：

```text
apps/bff/src/
  app.ts
  config/
  middlewares/
  routes/
    dashboard.ts
    datasets.ts
    versions.ts
    scenarios.ts
    tasks.ts
    review.ts
    query.ts
    quality.ts
    governance.ts
    exports.ts
  services/
    platform.ts
    dashboard.ts
    datasets.ts
    scenarios.ts
    tasks.ts
    query.ts
    quality.ts
    governance.ts
  viewmodels/
  types/
```

### `apps/api`

职责：
- Platform API 外部入口
- 平台资源语义
- control plane APIs
- SDK / 自动化 / BFF 的稳定访问面

建议路由按能力域拆分：

```text
apps/api/
  src/
    routes/
      health.py
      ingestion.py
      sources.py
      datasets.py
      dataset_versions.py
      manifests.py
      scenarios.py
      tasks.py
      review.py
      scheduler.py
      query.py
      quality.py
      governance.py
      exports.py
      feedback.py
      evaluation.py
```

### `apps/orchestrator`

职责：
- Dagster asset definitions
- 资产物化
- 批处理编排
- 数据质量扫描、索引重建、批量导出等后台编排入口

建议目录：

```text
apps/orchestrator/
  definitions/
    ingestion/
    datasets/
    search/
    quality/
    exports/
    evaluation/
```

### `apps/scheduler`

职责：
- 独立 scheduler service
- job dispatch / callback / state transition
- worker coordination
- quota / retry / priority control

建议目录：

```text
apps/scheduler/
  src/
    app.py
    routes/
    workers/
    dispatch/
    callbacks/
```

---

## 2.3 packages 层设计

### `packages/contracts`

职责：
- Node/Web 侧共享平台 contract
- 平台资源 DTO
- app-facing contract 基础类型

建议分域：

```text
packages/contracts/src/
  catalog/
  scenarios/
  tasks/
  query/
  quality/
  governance/
  exports/
  feedback/
```

### `packages/schemas`

职责：
- JSON schema / request-response schema / UI form schema

建议分域：

```text
packages/schemas/src/
  ingestion/
  datasets/
  scenarios/
  tasks/
  query/
  quality/
  governance/
```

### `packages/profiles`

职责：
- runtime profile 名称、capability model、feature availability

---

## 2.4 python/core 层设计

这是本次设计的核心。

建议从当前单文件 `models.py` 演进为按领域拆分的结构：

```text
python/core/src/core/
  domain/
    __init__.py
    identities.py
    assets.py
    catalog.py
    versioning.py
    scenarios.py
    tasks.py
    scheduler.py
    quality.py
    governance.py
    feedback.py
    mlops.py
    profiles.py
  interfaces/
    __init__.py
    contracts.py
    scheduler.py
    layout.py
    manifests.py
  profiles/
    runtime.py
```

其中各文件职责如下：

### `domain/identities.py`
存放统一 ID、引用关系、actor 等基础对象，例如：
- `ResourceRef`
- `ActorRef`
- `WorkspaceRef`
- `ProjectRef`

### `domain/assets.py`
存放原始数据与样本资产对象，例如：
- `RawRecord`
- `Sample`
- `SampleEmbedding`
- `ArtifactRecord`

### `domain/catalog.py`
存放 catalog 层对象，例如：
- `Workspace`
- `Dataset`
- `DatasetMembership`
- `ExportJob`

### `domain/versioning.py`
存放版本与 manifest 对象，例如：
- `DatasetVersion`
- `DatasetSnapshotManifest`
- `TableSnapshotBinding`
- `SearchIndexBinding`
- `ExportArtifactManifest`
- `VersionDiff`

### `domain/scenarios.py`
存放 AI 闭环场景对象，例如：
- `Scenario`
- `ScenarioSlice`
- `Episode`
- `DriveSegment`
- `BadCaseSet`

### `domain/tasks.py`
存放任务运营对象，例如：
- `Task`
- `MiningTask`
- `LabelTask`
- `ReviewTask`
- `TaskAssignment`
- `TaskResult`
- `PromotionDecision`

### `domain/scheduler.py`
存放调度与长任务对象，例如：
- `JobRun`
- `JobSpec`
- `JobEvent`
- `RetryPolicy`
- `QueuePolicy`

### `domain/quality.py`
存放数据质量对象，例如：
- `QualityRule`
- `QualityCheckRun`
- `QualityIssue`
- `PublishGate`

### `domain/governance.py`
存放治理对象，例如：
- `AuditLog`
- `ApprovalRecord`
- `AccessPolicy`
- `SensitiveTag`
- `RetentionPolicy`

### `domain/feedback.py`
存放反馈闭环对象，例如：
- `FeedbackEvent`
- `FeedbackSource`
- `IssueCase`
- `HumanReviewDecision`

### `domain/mlops.py`
存放模型绑定对象，例如：
- `ModelVersion`
- `TrainingSetBinding`
- `ExperimentRun`
- `EvaluationRun`
- `EvaluationSuite`

### `domain/profiles.py`
保留并扩展当前：
- `ProfileCapabilities`
- `RuntimeProfile`

---

## 2.5 python/interfaces 层设计

当前 `contracts.py` 需要继续保留，但应按能力扩展。

建议目标：

```text
python/core/src/core/interfaces/
  contracts.py
  scheduler.py
  layout.py
  manifests.py
```

### `contracts.py`
保留当前 adapter contracts，并逐步补充：
- `SourceAdapter`
- `ManifestStore`
- `QualityAdapter`
- `GovernanceAdapter`

### `scheduler.py`
定义：
- `SchedulerAdapter`
- `QueueAdapter`
- `WorkerLeaseAdapter`

### `layout.py`
定义统一路径布局接口：
- `LayoutResolver`
- `ArtifactPathPolicy`

### `manifests.py`
定义 manifest 读写与 diff contract：
- `VersionManifestStore`
- `ManifestDiffEngine`

---

## 2.6 python/adapters 层设计

建议从“按技术实现拆目录”继续保留，但增强对新能力域的适配。

```text
python/adapters/src/adapters/
  auth/
  compute/
  ingestion/
  layout/
  manifests/
  metadata/
  query/
  quality/
  governance/
  scheduler/
  storage/
  table/
  vector/
```

新增重点：
- `ingestion/`：source connector adapters
- `layout/`：layout resolver implementations
- `manifests/`：manifest store implementations
- `quality/`：quality engine implementations
- `governance/`：audit / approval policy implementations
- `scheduler/`：queue / worker / orchestration implementations

---

## 2.7 python/services 层设计

`python/services` 应从 placeholder 演进为明确的应用服务层。

```text
python/services/src/services/
  ingestion/
  catalog/
  versioning/
  scenarios/
  tasks/
  review/
  scheduler/
  query/
  quality/
  governance/
  exports/
  feedback/
  evaluation/
  layout/
```

职责说明：

- `ingestion/`：source registration、import submission、ingest manifest 生成
- `catalog/`：dataset/workspace catalog service
- `versioning/`：dataset publish / compare / rollback / manifest service
- `scenarios/`：scenario grouping、badcase grouping
- `tasks/`：task lifecycle / assignment / result service
- `review/`：review decision / escalation / relabel orchestration
- `scheduler/`：job dispatch / retry / state transition
- `query/`：ad hoc query、analysis access、saved query
- `quality/`：quality check orchestration / gate evaluation
- `governance/`：audit / approval / export policy enforcement
- `exports/`：export orchestration
- `feedback/`：feedback ingestion / aggregation
- `evaluation/`：evaluation ingestion / report assembly
- `layout/`：artifact path resolution

---

## 2.8 python/workflows 层设计

workflow 仍保留，但按编排域拆清楚：

```text
python/workflows/src/workflows/
  ingestion/
  assets/
  search/
  scheduler/
  quality/
  exports/
  evaluation/
  demo/
```

原则：
- service 负责能力组合与状态推进
- workflow 负责长流程 / 后台编排 / 资产物化

---

## 三、领域模型设计

## 3.1 领域分层总览

未来平台核心对象建议分成 8 组：

1. **资产层**：原始记录、样本、嵌入、产物
2. **目录层**：workspace、dataset、dataset membership
3. **版本层**：dataset version、manifest、binding、diff
4. **场景层**：scenario、episode、segment、badcase set
5. **任务层**：mining / label / review / promotion task
6. **调度层**：job spec、job run、job event、retry policy
7. **治理质量层**：quality rule、audit log、approval、policy
8. **模型反馈层**：model version、training binding、evaluation、feedback event

---

## 3.2 P0 领域模型

### 3.2.1 资产层

```text
Raw Data
-> RawRecord
-> Sample
-> SampleEmbedding
-> ArtifactRecord
```

#### `RawRecord`
表示原始输入的归一化记录。

核心字段建议：
- `raw_id`
- `source_id`
- `source_uri`
- `ingest_run_id`
- `modality`
- `content_type`
- `captured_at`
- `metadata`

#### `Sample`
平台内部最小统一样本单元。

核心字段建议：
- `sample_id`
- `raw_record_ids`
- `primary_uri`
- `modalities`
- `scene_tags`
- `annotation_state`
- `quality_state`
- `workspace_id`

#### `ArtifactRecord`
表示模型、导出、任务、质量扫描等派生产物。

核心字段建议：
- `artifact_id`
- `artifact_type`
- `uri`
- `producer_run_id`
- `dataset_version_id`
- `checksum`

---

### 3.2.2 目录与版本层

```text
Workspace
-> Dataset
-> DatasetVersion
-> DatasetSnapshotManifest
-> ExportArtifactManifest
```

#### `Workspace`
当前保留，但未来应补：
- `workspace_id`
- `name`
- `description`
- `owner`
- `default_profile`

#### `Dataset`
逻辑数据集合。

建议字段：
- `dataset_id`
- `workspace_id`
- `name`
- `dataset_type`
- `status`
- `current_version_id`

#### `DatasetVersion`
版本化快照对象，不只是 sample_count 记录。

建议字段：
- `dataset_version_id`
- `dataset_id`
- `version_label`
- `status`
- `sample_count`
- `manifest_id`
- `created_by`
- `created_at`

#### `DatasetSnapshotManifest`
定义版本真正包含什么。

建议字段：
- `manifest_id`
- `dataset_version_id`
- `sample_refs`
- `table_snapshot`
- `index_snapshot`
- `quality_summary`
- `lineage_refs`

#### `ExportArtifactManifest`
描述导出物与版本关系。

建议字段：
- `export_id`
- `dataset_version_id`
- `format`
- `artifact_uri`
- `schema_version`
- `row_count`
- `checksum`

---

### 3.2.3 场景层

```text
Scenario
-> ScenarioSlice
-> Episode / DriveSegment
-> BadCaseSet
```

#### `Scenario`
AI 闭环平台的核心对象之一。
表示“可被识别、筛选、统计、回流、训练使用”的场景单元。

建议字段：
- `scenario_id`
- `scenario_type`
- `workspace_id`
- `dataset_version_id`
- `sample_ids`
- `tags`
- `severity`
- `source`
- `status`

#### `ScenarioSlice`
表示某类场景切片或运营切面。

例如：
- 夜间行人
- 雨天交叉路口
- 施工区域变道

#### `Episode` / `DriveSegment`
表示连续时空片段，是后续自动驾驶/机器人任务的重要闭环基础对象。

#### `BadCaseSet`
表示从反馈、评测、规则或人工审核中沉淀出的 hard cases 集合。

---

### 3.2.4 任务层

```text
Task
-> MiningTask
-> LabelTask
-> ReviewTask
-> PromotionDecision
```

#### `Task`
统一抽象父对象。

建议字段：
- `task_id`
- `task_type`
- `status`
- `priority`
- `workspace_id`
- `dataset_version_id`
- `assignee`
- `created_at`
- `due_at`

#### `MiningTask`
表示从规则、检索、模型、反馈中生成的挖掘任务。

#### `LabelTask`
表示标注任务。
建议补：
- `instruction_ref`
- `annotation_schema_ref`
- `target_sample_ids`

#### `ReviewTask`
表示审核任务。
建议补：
- `review_target_task_id`
- `decision`
- `review_notes`

#### `PromotionDecision`
表示 dataset version 是否可以晋升为可导出、可训练、可共享状态。

---

### 3.2.5 调度层

```text
JobSpec
-> JobRun
-> JobEvent
-> RetryPolicy
```

#### `JobSpec`
定义任务如何运行。

#### `JobRun`
当前已有 `ComputeRun`，建议演进为更明确的长任务对象。

建议字段：
- `run_id`
- `job_type`
- `status`
- `queue`
- `submitted_at`
- `started_at`
- `finished_at`
- `attempt`
- `payload`

#### `JobEvent`
记录状态推进与事件流。

#### `RetryPolicy`
记录 retry/backoff 策略。

---

## 3.3 P1 领域模型

### 3.3.1 质量层

#### `QualityRule`
描述质量规则。

建议字段：
- `rule_id`
- `rule_type`
- `scope`
- `predicate`
- `severity`

#### `QualityCheckRun`
描述一次质量扫描。

#### `QualityIssue`
描述某次扫描发现的问题。

#### `PublishGate`
定义版本晋升前的质量门。

---

### 3.3.2 治理层

#### `AuditLog`
审计事件记录。

#### `ApprovalRecord`
审批结果记录。

#### `AccessPolicy`
访问策略。

#### `SensitiveTag`
敏感标记，例如：
- face
- plate
- location
- pii

#### `RetentionPolicy`
留存与清理策略。

---

### 3.3.3 反馈与模型层

#### `FeedbackEvent`
统一反馈事件对象。
来源可以是：
- online failure
- offline eval
- human review
- export consumer issue

#### `ModelVersion`
模型版本对象。

#### `TrainingSetBinding`
训练数据集绑定对象。

#### `EvaluationRun`
评测执行对象。

#### `EvaluationSuite`
评测集合对象。

---

## 四、关键关系图

```text
RawRecord
-> Sample
-> Dataset
-> DatasetVersion
-> DatasetSnapshotManifest

Sample
-> Scenario
-> MiningTask
-> LabelTask
-> ReviewTask

DatasetVersion
-> ExportArtifactManifest
-> TrainingSetBinding
-> EvaluationRun

EvaluationRun / HumanReview / Online Failure
-> FeedbackEvent
-> BadCaseSet
-> ScenarioSlice
-> 下一轮 MiningTask
```

这条关系链，才是 AI 数据中台真正应承载的闭环主线。

---

## 五、建议的落地顺序

### Phase 1：先落目录边界，不强求全部实现
1. 在文档中确认目标目录结构
2. 在 `python/core/domain` 中拆分模型文件
3. 在 `python/services` 中建立真实模块骨架
4. 在 `apps/api` 中按能力域拆 routes

### Phase 2：先落 P0 领域模型
5. 先落 `assets / catalog / versioning / scenarios / tasks / scheduler`
6. 让 `ComputeRun` 演进为 `JobRun`
7. 让 `DatasetVersion` 绑定 `DatasetSnapshotManifest`
8. 让 demo task 演进为统一 `Task` 模型

### Phase 3：再补 P1 领域模型
9. 新增 `quality / governance / feedback / mlops`
10. 再把 query / notebook / audit / approval 等服务逐步接入

---

## 六、最终结论

基于 P0 / P1 roadmap，当前系统最合理的下一阶段目标不是继续堆更多 demo route，而是：

1. **把 monorepo 目录从“能跑 MVP”升级为“能承载中台能力域”**
2. **把 domain model 从“通用数据平台对象”升级为“AI 闭环平台对象”**

一句话概括：

- 目录设计上，要补 `services / scheduler / notebooks / 按能力域拆分的 routes 与 contracts`
- 领域模型上，要补 `scenario / task ops / manifest / quality / governance / feedback / mlops`

这样后续无论做任务运营、数据治理、分析消费，还是模型评测反馈闭环，都可以落在同一套稳定底座上。
