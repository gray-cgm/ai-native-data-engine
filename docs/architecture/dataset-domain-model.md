# Dataset 与对应领域模型详细设计

> 本文档梳理 AI Data Loop Engine 中"数据集（Dataset）"概念的双层语义、相关领域模型字段、跨库引用约定、以及端到端 receipt（DatasetSnapshotManifest）的生命周期。
>
> 适合阅读对象：平台工程师、新接入模块的开发者、需要把 Requirement → DataTask → OperationsTask → PipelineRun → Dataset 链路串通的 BFF/前端同事。

---

## 一、双 Dataset 概念并存（关键认知）

项目中 "dataset" 在不同上下文里指代两类对象，理解它们的边界是阅读后续模型的前提：

| 概念 | 物理位置 | 标识 | 用途 |
|---|---|---|---|
| **Catalog Dataset**（登记型） | metadata adapter SQLite，`datasets` / `dataset_versions` 表 | `dataset_id`（字符串） | 真正可发版、可导出、可挂 receipt 的数据集 |
| **Clip-grouped Virtual Dataset**（聚合视图） | 前端动态聚合，无独立存储 | `scenario:<slug>` | Catalog UI 的浏览/钻取入口，clip 按 scenario 分桶 |

> 现阶段没有真正的 dataset registry，前端 Catalog 视图通过 `scenario` 临时聚合；当 registered dataset store 落地后，`dataset_id` 会演进为带 namespace 前缀的稳定字符串（参见 `python/core/src/core/domain/models.py:117-131` 的 `DatasetSummary` 注释）。

---

## 二、Catalog Dataset（登记表 / 异构 DB）

定义于 metadata adapter：`python/adapters/src/adapters/metadata/sqlite/adapter.py:28-39`

```sql
datasets(
    dataset_id   TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    profile      TEXT NOT NULL
);

dataset_versions(
    version_id   TEXT PRIMARY KEY,
    dataset_id   TEXT NOT NULL,
    sample_count INTEGER NOT NULL,
    table_name   TEXT NOT NULL DEFAULT 'dataset_samples'
);

export_jobs(
    export_id   TEXT PRIMARY KEY,
    dataset_id  TEXT NOT NULL,
    format      TEXT NOT NULL,
    status      TEXT NOT NULL,
    output_path TEXT NOT NULL
);
```

### 设计取舍

- **跨库无 FK**：`apps/api`（业务库）与 metadata adapter（catalog 库）是 **异构 SQLite**，跨库一律存字符串 ID、不建外键（见 `apps/api/src/models/dataset_snapshot.py:7-9` 注释）。
- **profile 维度**：`profile` 字段隔离 personal / team / multi-tenant 等不同部署形态。

### API

`apps/api/src/api/routes/catalog.py:14-31`

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/workspaces` | 列工作空间 |
| GET | `/datasets` | 列已登记 dataset |
| GET | `/datasets/{dataset_id}` | 获取单个 dataset + 全部 version |
| GET | `/datasets/{dataset_id}/versions` | 列 version |
| POST | `/exports/dataset/{dataset_id}?format=lance\|parquet\|csv` | 导出最新 version 到 `data/exports/<dataset_id>-<version_id>.<format>` |

导出流程实现在 `apps/api/src/api/routes/export.py:29-73`：调用 `container.table.export(...)` 落盘 → `metadata.create_export_job(...)` 登记 → 若 trace 已挂 snapshot，回写 receipt（详见 §4）。

---

## 三、四层闭环领域模型

```
Requirement (1) ──< DataTask (N) ──< OperationsTask (N) ──< PipelineRun (N)
                                                                  │
                                              release / export 阶段 ▼
                                                  DatasetSnapshotManifest
                                                  (1 trace = 1 row)
```

`x_trace_id` 是跨库串通的唯一钥匙（HTTP Header / 日志字段 / Dagster 任务参数 / Kafka header 全部一致）。下面按层逐一展开。

### 3.1 Requirement

`apps/api/src/models/requirement.py:57-110`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID PK | — |
| `title` | String(256) | 需求标题 |
| `description` | Text | 详细描述 |
| `priority` | Enum(Priority) | high / medium / low |
| `source` | Enum(RequirementSource) | dre / product / algorithm / test |
| `status` | Enum(RequirementStatus) | DRAFT → … |
| `feishu_doc_id` | String(128) | 飞书文档关联 ID（允许后挂） |
| `dre_owner` | String(128) | Dre 负责人 |
| `target_scene` | String(256) | 目标场景描述 |
| `scene_tags` / `vehicle_tags` | JSON list | 标签集合 |
| `estimated_data_volume` | Integer | 预估数据量 |
| `due_date` | Date | 期望交付日期 |

关系：`Requirement.data_tasks → DataTask[]`（1:N，cascade delete）。

### 3.2 DataTask

`apps/api/src/models/requirement.py:113-192`

| 字段 | 类型 | 说明 |
|---|---|---|
| `requirement_id` | FK→requirements | 所属需求 |
| `title` / `description` | — | — |
| `task_type` | Enum(TaskType) | collection / annotation / pipeline / quality_check |
| `status` | Enum(TaskStatus) | DRAFT → … |
| `sign_off_status` | Enum(SignOffStatus) | PENDING / APPROVED / REJECTED |
| `sign_off_by` / `sign_off_at` / `sign_off_comment` | — | 大数据团队评审记录（内嵌避免单独审计表） |
| `assigned_to` | String(128) | 执行负责人 |
| `target_count` / `actual_count` | Integer | 目标 / 实际数据量 |
| `due_date` | Date | 截止日期 |
| `x_trace_id` | String(64) indexed | 跨系统追踪键 |

关系：DataTask 关联 `reconstructions / collection_jobs / annotation_tasks / pipeline_runs / operations_tasks`（全部 1:N，cascade delete）。

### 3.3 OperationsTask

`apps/api/src/models/requirement.py:198-245`

由 DataTask 拆分出的可排程的执行协调单元，对应六大子模块：

| 字段 | 类型 | 说明 |
|---|---|---|
| `requirement_id` | FK | 冗余便于过滤 |
| `data_task_id` | FK | 所属 DataTask |
| `module` | Enum(OperationsModule) | LABELING / TAGGING / CHECKING / MINING / PRIVACY / RELEASE |
| `title` / `status` / `assigned_to` | — | — |
| `payload` | JSON | 模块特定配置 |
| `started_at` / `completed_at` | DateTime | — |
| `x_trace_id` | String(64) indexed | 跨系统追踪键 |

### 3.4 PipelineRun

`apps/api/src/models/requirement.py:397-477`

对应 One-Pipeline 数据加工流转：原始采集包(Bronze) → 多模态切片(Silver) → 特征提取(Silver) → 发版数据集(Gold)。

| 字段 | 类型 | 说明 |
|---|---|---|
| `data_task_id` | FK | 所属 DataTask |
| `x_trace_id` | String(64) indexed | 主追踪键 |
| `trace_parent_id` | String(64) | 父 span/run 标识 |
| `requirement_id` | FK 冗余 | 跨层筛选 |
| `operations_task_id` | FK 可空 | 流式/采集场景可不挂 OpsTask |
| `trigger_source` | Enum(TriggerSource) | data_task / operations_task / scheduler / manual / external |
| `run_purpose` | Enum(RunPurpose) | initial_build / backfill / repair / reindex / replay / validation |
| `pipeline_name` | String(128) | — |
| `stage` | Enum(PipelineStage) | raw_ingest / clip_extraction / feature_extraction / structured_dataset |
| `input_uri` / `output_uri` | String(512) | 输入/输出路径 |
| `status` | Enum(PipelineStatus) | PENDING → … |
| `config` / `metrics` | JSON | 配置 + 执行指标（cost_usd / cpu_seconds / gpu_seconds / storage_gb / duration_s / gate_result / gate_reason） |
| `started_at` / `completed_at` | DateTime | — |

---

## 四、DatasetSnapshotManifest（端到端 Receipt）

### 4.1 表结构

模型定义：`apps/api/src/models/dataset_snapshot.py:21-68`

迁移文件：`apps/api/alembic/versions/c1e2d3a4b5f6_ops_item_and_snapshot.py:54-79`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID PK | 行主键 |
| `x_trace_id` | String(64) **unique** | trace 唯一键，前端查询 PK |
| `requirement_id` | FK→requirements | 业务起点 |
| `data_task_id` | String(36) | 主 DataTask（一般是 PIPELINE 类型那条） |
| `operations_task_id` | String(36) | release 类型 OperationsTask |
| `gold_pipeline_run_id` | String(36) | 终态 Gold PipelineRun |
| `pipeline_run_count` | Integer | 本 trace 涉及的 run 总数 |
| `dataset_id` | String(64) | **跨库字符串**，指向 catalog 库 |
| `dataset_version_id` | String(64) | 同上 |
| `export_job_id` | String(128) | 导出任务 ID |
| `export_artifact_uri` | String(512) | 物理产物路径 |
| `export_format` | String(16) | lance / parquet / csv |
| `clip_ids` | JSON list | 本次发版包含的 clip id 集合 |
| `scenario` / `title` / `summary` | — | 展示用元数据 |
| `manifest_json` | JSON | 完整 receipt（同步落盘 `data/exports/e2e-snapshot-<trace>.json`） |
| `sealed_at` | DateTime | export 完成时间 |

### 4.2 三段式幂等生命周期

实现在 `apps/api/src/services/snapshot_service.py`：

1. **`open_or_create(...)`** (L66-105)：release 阶段调用，锁定 `requirement / gold_pipeline_run / clip_ids / scenario / title / summary`；通过 `x_trace_id` unique 约束保证幂等。**仅当传入非 None 时覆盖**，避免后续步骤把已写好的字段意外清空。
2. **`attach_dataset_version(dataset_id, dataset_version_id)`** (L108-121)：catalog 库新建 dataset_version 之后挂回字符串 ID。
3. **`attach_export_artifact(export_job_id, uri, format)`** (L124-147)：export 完成后回写 → 打 `sealed_at` 时间戳 → 写 `manifest_json` → 同步落盘 `data/exports/e2e-snapshot-<trace>.json`（离线 receipt）。

辅助：`find_trace_by_dataset_version(dataset_version_id)` (L150-160) — export 路由只有 `dataset_version_id`，需借此反查 `x_trace_id`。

### 4.3 写入触发点

`apps/api/src/api/routes/export.py:29-73` 是关键编排点：

```text
POST /exports/dataset/{dataset_id}
  ├─ container.table.export(...)               物理落盘
  ├─ container.metadata.create_export_job(...) catalog 登记
  └─ 若 trace 已存在（X-Trace-Id 头 或 反查到）
       └─ snapshot_service.attach_export_artifact(...)
            （失败仅 warn 不阻塞主响应）
```

### 4.4 读 API

`apps/api/src/api/routes/snapshots.py`

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/v1/snapshots?limit=20&scenario=...` | 最近 N 条（首页 / Pipelines Overview 用） |
| GET | `/api/v1/snapshots/{trace_id}` | 单条 receipt |

---

## 五、OpsItem（OperationsTask 内执行子项）

模型定义：`apps/api/src/models/ops_item.py:36-99`

迁移：`apps/api/alembic/versions/c1e2d3a4b5f6_ops_item_and_snapshot.py:30-52`

### 5.1 设计动机

- **OperationsTask 是"协调单元"**（一个 mining/labeling/release 的任务包），**OpsItem 是其内部"执行项"**（具体的 N 个候选 clip / N 条标注小项 / N 条质检结果），1:N。
- **单表 + module 列**承载 6 个子模块，避免 6 张高度相似的表。
- **status / kind 用字符串保留开放词表**（参见 `apps/api/src/api/routes/ops_modules.py`），允许各模块定义自己的状态机。
- **冗余键** `operations_task_id / requirement_id / data_task_id / x_trace_id` 同时存在，便于 mining→labeling 跨任务复用 trace 时直接列表过滤。

### 5.2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `operations_task_id` | FK 可空 | 归属 OpsTask（允许 null：UI 直接创建的轻量子项） |
| `requirement_id` / `data_task_id` / `x_trace_id` | 索引冗余 | 跨任务过滤友好 |
| `module` | Enum(OperationsModule) | 6 个子模块之一 |
| `title` | String(256) | — |
| `status` | String(32) indexed | 子模块自定义状态字符串 |
| `kind` | String(32) | 子模块二级维度（如 labeling.kind=human） |
| `owner` | String(128) | 负责人 |
| `clip_ids` | JSON list | 关联 clip id 列表（mining 候选集合 → labeling 输入） |
| `dataset_id` | String(64) | 关联 catalog 库 dataset_id（字符串） |
| `scenario` | String(64) | 场景标识 |
| `payload` | JSON | 子模块扩展字段 |
| `deleted_at` | DateTime | 软删 |

### 5.3 典型样例

- **mining** OpsTask → N 条 OpsItem，每条对应一个候选 clip。
- **release** OpsTask → 通常一条 OpsItem，即 "本次发版的 dataset version 草稿"。

---

## 六、Clip 域模型（数据物理基本单位）

定义于 `python/core/src/core/domain/models.py`。

### 6.1 物理结构

```
data/lance/c-<uuid>/
  ├─ meta.lance              # ClipMeta 行
  ├─ topic.lance             # 关键帧 + 多 topic struct 列
  └─ <TopicName>.lance/      # 0..N 个 sibling 独立 topic 表
```

### 6.2 Pydantic 模型

| 模型 | 字段要点 |
|---|---|
| **ClipSummary** (L42-63) | `clip_id / keyframe_count / start_time / end_time / duration_seconds / vehicle_name / city / district / scenario / tags / da_tags / topics / cameras / standalone_topics / has_wm` |
| **ClipMeta** (L66-86) | 物化的 `meta.lance` 行；`extra='allow'` 支持 schema 演进；含 `vehicle_info / calibration_info / mp4_path / mp4_resize_path` 等扩展字段 |
| **ClipRecord** (L89-93) | `summary + meta` 聚合 |
| **ScenarioSummary** (L98-114) | 按 `meta.scenario` 聚合：`clip_count / keyframe_count / duration_seconds / tag_histogram / vehicle_histogram / city_histogram` |
| **DatasetSummary** (L117-131) | scenario 维度 virtual dataset，`dataset_id` 为 `scenario:<slug>` 格式 |

### 6.3 前端聚合

`apps/web/src/modules/catalog/clip-datasets.ts`

- `ClipDataset` (L13-25)：前端聚合视图类型
- `deriveDatasetId(scenario)` (L34-37)：`scenario:<value>` ↔ scenario 双向映射，无 scenario 走 `scenario:unassigned`
- `buildClipDatasets(clips)` (L56-90)：按 scenario 分桶 → 算 `clip_count / keyframe_total / duration_total / vehicle_names / cities / tags / sample_clip_ids` → 排序

---

## 七、物理存储布局

```
data/
├─ lance/
│   └─ c-<uuid>/                                Clip 主存（Lance）
├─ metadata/
│   ├─ clip_catalog.sqlite                      Clip 索引（查询层）
│   ├─ metadata.db                              apps/api 业务库
│   └─ requirement.db                           需求 / 任务库
└─ exports/
    ├─ <dataset_id>-<version_id>.{lance,parquet,csv}   导出产物
    ├─ e2e-snapshot-<trace>.json                离线 receipt（snapshot_service 落盘）
    └─ demo-dataset-v1.lance/                   示例 lance 数据集
```

`data/exports/e2e-snapshot-<trace>.json` 是 **DB 行 + 磁盘文件双写**：离线场景只看 JSON 就能还原全链路。

---

## 八、设计权衡与不变量

| # | 决策 | 取舍 |
|---|---|---|
| 1 | **跨库无 FK** | 业务 DB（apps/api）与 catalog DB 解耦，靠 `x_trace_id` + 字符串 ID 串联。代价：写入失败需双写补偿（`export.py:69-71` `try/except + warn`）。 |
| 2 | **Snapshot 幂等** | `open_or_create` 用 `x_trace_id` unique 约束 + `attach_*` 只覆盖非 None 字段，重放安全。 |
| 3 | **OpsItem 表合并** | 6 模块单表 + 开放 status 字符串，牺牲强类型换迁移成本。 |
| 4 | **冗余键策略** | OpsItem 同时存 `operations_task_id / requirement_id / data_task_id / x_trace_id`，列表过滤无需 join。 |
| 5 | **Clip 即一切** | 当前没有真正的 dataset registry，前端的 ClipDataset 是临时聚合视图；DatasetSnapshotManifest 把 clip_ids 直接列出，是 dataset 真正落地前的过渡设计。 |
| 6 | **manifest 双写** | DB 行（在线查询） + JSON 文件（离线 receipt），冗余成本换可观测性。 |

---

## 九、参考文件索引

| 路径 | 作用 |
|---|---|
| `apps/api/src/models/requirement.py` | Requirement / DataTask / OperationsTask / PipelineRun 全部 SQLAlchemy 模型 |
| `apps/api/src/models/dataset_snapshot.py` | DatasetSnapshotManifest |
| `apps/api/src/models/ops_item.py` | OpsItem |
| `apps/api/src/models/base.py` | 公共枚举（PipelineStage / PipelineStatus / TriggerSource / RunPurpose / OperationsModule …） |
| `apps/api/src/services/snapshot_service.py` | Snapshot 三段式生命周期 |
| `apps/api/src/api/routes/snapshots.py` | Snapshot 读 API |
| `apps/api/src/api/routes/export.py` | 导出 + receipt 回写编排 |
| `apps/api/src/api/routes/catalog.py` | Catalog dataset / version 列表 |
| `apps/api/alembic/versions/c1e2d3a4b5f6_ops_item_and_snapshot.py` | OpsItem / Snapshot 表迁移 |
| `python/adapters/src/adapters/metadata/sqlite/adapter.py` | metadata adapter（datasets / dataset_versions / export_jobs） |
| `python/core/src/core/domain/models.py` | ClipSummary / ClipMeta / ScenarioSummary / DatasetSummary |
| `apps/web/src/modules/catalog/clip-datasets.ts` | 前端 ClipDataset 聚合 |
| `docs/adr/adr-pipelinerun-unified-fact-model.md` | PipelineRun 统一事实模型 ADR |
