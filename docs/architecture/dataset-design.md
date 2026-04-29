# 数据集与 Snowflake 事件模型设计

> Dataset / DatasetSample / LineageEvent / EventResult / Asset 五件套的完整设计：模型字段、状态机、切割策略、提级工作流、参考实现路径。
>
> 与术语含义相关的解释见 [术语澄清](./glossary-dataset-scenario-cornercase-tag-label.md)；横向业务流程见 [业务流程总览](./business-flows.md)；底层引擎见 [系统分层总览](./system-layers.md)。

## 一、核心设计原则

| 原则 | 说明 |
|---|---|
| **Dataset 只有 `customized` 与 `official` 两类** | customized 是用户操作堆出来的"工作集"；official 是经过审批的"可训练集"。**没有第三种 dataset** |
| **样本即事实** | DatasetSample 是训练消费的唯一事实表；粒度 `(dataset_id, clip_id, ts)` 唯一约束保证幂等 |
| **Asset 统一登记原始 + 派生数据** | `asset_kind: raw \| derived`；血缘走 `producer_pipeline_run_id` / `producer_event_id` |
| **Snowflake 中心 LineageEvent + 维度** | 每次操作 = 一条 event；4 维度（Tagging / Labeling / Checking / Mining）通过 query filter 暴露，无独立物理表 |
| **PipelineRun.stage 是自由文本 step 名** | 不做阶段枚举约束；血缘走 Asset 而不是 stage 字段 |
| **CSVImportRowTable 不实现** | customized 数据集的可追溯靠 `EventResult.extra` + `DatasetSample.extra_meta` + `Asset.payload` 承载 |

---

## 二、Dataset 模型（顶层主表）—— 只有 customized 与 official

SQLAlchemy 模型 `apps/api/src/models/dataset.py::Dataset`，物理表 `datasets_v2`。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` (`dataset_id`) | UUID PK | Y | 系统生成 |
| `name` | String(128) | Y | `ds_migration_cutin_v1` 风格 |
| `dataset_type` | Enum(`official` / `customized`) | Y | 仅这两种；`source_type=csv ⇒ customized` |
| `dataset_version` | Integer | Y | 跟随 lance version 单调递增 |
| `source_type` | Enum(`tags` / `csv` / `other`) | Y | API 由创建入口决定 |
| `requirement_id` | FK→requirements (可空) | N | 关联需求（demand_id 等价） |
| `allow_train` | Boolean | Y | API 强约束：customized ⇒ false |
| `status` | Enum(`active` / `frozen` / `deprecated`) | Y | API 维护 |
| `tag_expr` | String(512) | 条件 | official 必填，e.g. `migration_v1 AND cutin` |
| `slice_strategy` | Enum(`one_to_four` / `flexible` / `random_sample` / `no_ts`) | Y | API 推断 |
| `ts_policy` | Enum(`parse_from_tag` / `compute_1to4` / `read_from_csv` / `flexible_window` / `none`) | Y | API 推断 |
| `default_range_l` / `default_range_r` | Integer | Y | 默认 ±range，sample 可覆盖 |
| `created_by` | String(64) | Y | API 写入 |
| `resolved_meta` | JSON | N | 系统固化推断信息 |

### 2.1 `customized` vs `official` 的语义边界 + 提级工作流

```
┌──────────────────────────┐  Operations / Release    ┌──────────────────────────┐
│ customized Dataset       │  ───── promote ─────►   │ official Dataset         │
│ allow_train=false        │   (release OpsItem.id)   │ allow_train (可 true)   │
│ source: flexible_cut /   │                          │ source: tags             │
│   mining / migration     │                          │ tag_expr 引自 customized │
└──────────────────────────┘                          └──────────────────────────┘
        │                                                       │
        ▼                                                       ▼
   DatasetSample (复制)  ←—— 同 (clip_id, ts) 唯一约束 ——→  DatasetSample
        │                                                       │
        └──── LineageEvent(event_type=release) ─────────────────┘
                            x_trace_id 链路串通
```

| 维度 | customized | official |
|---|---|---|
| 谁能写入 | 任意用户、Explorer 灵活切割、mining 工作流 | 经过 sign-off 后由 release 工作流升格写入 |
| `allow_train` | 永远 false | 可为 true |
| 与 requirement 关系 | 可选关联 | 通常对一一对应 |
| 内容来源 | 用户切割 / mining 候选 / migration 临时集合 | 由一个或多个 customized 数据集"提级"组装 |
| Promote 路径 | 通过 `release` 类型 LineageEvent 发起 | 写入新 `dataset_type=official` 行（version+1） |

> 没有"第三种"数据集；ingest/curate/publish 三段是流水线 step 概念，不是 dataset 概念。

### 2.2 DatasetSample（训练/消费唯一事实表）

`apps/api/src/models/dataset.py::DatasetSample`，物理表 `dataset_samples_v2`：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | UUID PK | Y | — |
| `dataset_id` | FK→datasets_v2 | Y | 主表 |
| `clip_id` | String(64) indexed | Y | 来自 tag_index 或切割动作 |
| `ts` | BigInt | Y | 样本中心时间戳（纳秒），**一定不为空** |
| `range_l` / `range_r` | Integer | Y | 取 dataset 默认或样本覆盖 |
| `ts_origin` | Enum(`from_tag` / `computed_1to4` / `from_csv` / `flexible` / `random_window`) | Y | 来源 |
| `origin_ref` | String(128) | N | tag_name / csv_row_id / event_id |
| `extra_meta` | JSON | N | `{"part":2, "raw":"..."}` |
| `training_type` | Enum(`train` / `test` / `holdout`) | Y | 入库即随机分配 |

唯一性：`(dataset_id, clip_id, ts)` 组合唯一索引，重复切割幂等。

### 2.3 切割策略（slice_strategy）

| 策略 | metadata 形态 | 触发场景 |
|---|---|---|
| `one_to_four` | 一个 clip 切 4 段：`[ts1, ts2, ts3, ts4]` 各占 1/4 时长 | official 数据集创建时 `def calculate_ts_1_4(clip)` |
| `flexible` | 单一 ts + 用户指定 `range_l/r`，可在 Explorer 拖动选定 | 灵活切割（本次重点） |
| `random_sample` | ts + range_surfix `[-1, 3]`，随机窗口 | mining 触发 |
| `no_ts` | 仅 clip_id，整片消费 | 兼容老数据 |

---

## 三、Asset 模型（取代 ingest/curate/publish 三段）

SQLAlchemy 模型 `apps/api/src/models/asset.py::Asset`，物理表 `assets`。

> **核心思想**：把原始采集数据与流水线加工产物登记到同一张表，用 `asset_kind` 区分 raw / derived；用 FK 把 Asset 串到 PipelineRun / LineageEvent / Requirement。这样 PipelineRun 不再背 stage 枚举，只负责声明"我用了哪些 input Asset，产出了哪些 output Asset"。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | UUID PK | Y | — |
| `name` | String(256) | Y | 人类可读名（`raw_lidar_2026_03_25_001` / `clip_lance_run_20240325` 等） |
| `asset_kind` | Enum(`raw` / `derived`) | Y | raw = 原始采集；derived = pipeline 加工产物 |
| `uri` | String(512) | Y | 物理路径（`s3://...` / `data/assets/raw/...` / `data/lance/c-<uuid>/`） |
| `format` | String(32) | N | `parquet` / `lance` / `mp4` / `jsonl` / … |
| `clip_id` | String(64) indexed | N | 关联 clip（多数 derived asset 都挂 clip） |
| `producer_pipeline_run_id` | FK→pipeline_runs (可空) | N | 哪个 run 产出（raw asset 一般为空） |
| `producer_event_id` | FK→lineage_events (可空) | N | 由 manual_ui 或 mining event 直接产出时挂这里 |
| `requirement_id` | FK→requirements (可空) | N | 跨层过滤用 |
| `x_trace_id` | String(64) indexed | N | 全链路追踪键 |
| `byte_size` | BigInt | N | 文件字节数（统计用） |
| `row_count` | BigInt | N | 表/索引行数 |
| `payload` | JSON | N | 模块扩展字段（schema、checksum、tag 直方图等） |

### 3.1 与 PipelineRun 的关系

PipelineRun 的 `stage` 字段保留但**降级为自由文本 step 名**（如 `clip-extract`, `feature-compute`），不再做 enum 校验、不再绑定到 ingest/curate/publish 三段。

血缘信息走 Asset：

```
PipelineRun
  ├── (input)  Asset[asset_kind=raw, uri=s3://collect/...]
  └── (output) Asset[asset_kind=derived, uri=data/lance/c-xxx, producer_pipeline_run_id=self]
```

下一步可选优化：建独立的 `pipeline_run_inputs` 关联表把 PipelineRun ↔ Asset 多对多显式化；当前用 `producer_pipeline_run_id` 单向 FK 已能覆盖 80% 场景。

### 3.2 与 LineageEvent 的关系

manual_ui / mining 等不通过 PipelineRun 也能产出 Asset 的场景（如用户手动切片），通过 `producer_event_id` 挂回中心事件。Snowflake 视图查询某次 mining 产出的所有候选 clip 时，可以直接 join `event_results` ∪ `assets`。

### 3.3 物理目录约定

```
data/
├─ raw/                  # raw asset 原始采集落地（保留旧名，与 Asset.asset_kind=raw 对齐）
├─ lance/c-<uuid>/       # derived asset：clip 主存
├─ assets/               # 通用 derived asset 落地（特征 / 索引 / 质检报告）
├─ exports/              # publish artifact + e2e receipt
└─ metadata/             # SQLite / DuckDB 业务库
```

老 `data/ingest/`、`data/curate/`、`data/publish/` 目录在 `clean-dev-data.sh` 中保留为兼容清单；新写入只走 `data/raw/`、`data/assets/`、`data/exports/`。

---

## 四、灵活视频切割（Flexible Cut）— 全栈实现

### 4.1 用户故事

> 在 Explorer 的 Clip 详情页，用户可以拖动视频时间进度条，点击「Mark in / Mark out」选定一段窗口，关键帧标记自动吸附；保存后生成一条 `DatasetSample`（属于一个用户指定的 customized dataset），并产出一条 `LineageEvent(event_type=flexible_cut)`。

### 4.2 API 层

`apps/api/src/api/routes/datasets.py`：

```
POST   /api/v1/datasets                      # 创建 Dataset（official / customized）
GET    /api/v1/datasets                      # 列表（status / dataset_type / requirement_id）
GET    /api/v1/datasets/{id}                 # 主表 + sample 总数
POST   /api/v1/datasets/{id}/samples         # 通用样本写入（flexible / one_to_four / random）
GET    /api/v1/datasets/{id}/samples         # 列样本（分页）
POST   /api/v1/datasets/{id}/cut             # 灵活切割快捷入口（Explorer 用）
                                             #   body: { clip_id, ts_start, ts_end, ts_center?, range_l?, range_r? }
                                             #   返回写入的 DatasetSample + LineageEvent
```

### 4.3 BFF 层

`apps/bff/src/routes/datasets.ts` + `apps/bff/src/engines/datasetsEngine.ts` 透传，注入 `X-Trace-Id`。

### 4.4 Web 层

`apps/web/src/modules/explorer/pages/clip-detail.page.tsx::VideoPlayer` 内置：

> **时间戳来源**：sensor 视频的 in / out 不用秒数二次转换；
> 直接复用 Lance `meta.lance` 的 `start_time` / `end_time`（纳秒）作为时间轴 single source
> of truth：
>
> - 视频元素的播放 `currentTime` (秒) 与 ns 时间轴通过 `(currentTime / videoDuration) *
>   (end_time - start_time) + start_time` 双向映射
> - VideoTimeline 直接展示 ns 时间标签，Mark in / Mark out 写入的 `ts_start` / `ts_end`
>   就是 clip 的真实时间戳，进 SaveCutModal 不需要二次推算
> - 关键帧 tick 用 `frameIndex / total_frames * (end_time - start_time) + start_time` 投影


1. **时间进度条** (`<VideoTimeline />`)：
   - x 轴 = `[start_time, end_time]` ns 区间（取自 ClipSummary）
   - 关键帧标记：取 `fetchAlignedCameraFrames(...).items[].video_frame_index` 渲染纵向 tick
   - 拖动两个手柄设定 `[ts_start_ns, ts_end_ns]`，吸附到最近关键帧
2. **Mark in / Mark out / Save Cut / Clear 按钮** —— 写入的 ts 直接是 ns 时间戳
3. **`<SaveCutModal />`**：选 / 新建 customized dataset，调用 `POST /api/datasets/:id/cut`

新组件文件：
- `apps/web/src/modules/explorer/components/video-timeline.tsx`
- `apps/web/src/modules/explorer/components/save-cut-modal.tsx`
- `apps/web/src/modules/datasets/datasets-api.ts`

---

## 五、Snowflake：LineageEvent 中心 + 维度

### 5.1 中心表：LineageEvent

`apps/api/src/models/lineage_event.py::LineageEvent`，物理表 `lineage_events`：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` (`event_id` PK) | UUID | Y | — |
| `event_id` | String(64) | N | 业务可读 ID（`evt_<yyyymmdd>_<seq>`） |
| `event_type` | Enum(`tagging` / `labeling` / `checking` / `mining` / `migration` / `flexible_cut` / `release` / `generation` / `trigger`) | Y | 维度路由的关键 |
| `job_id` | String(64) | N | 来源 job |
| `requirement_id` | FK→requirements (可空) | N | demand_id |
| `operations_task_id` | FK→operations_tasks (可空) | N | 6 模块任务 |
| `pipeline_run_id` | FK→pipeline_runs (可空) | N | 关联机器执行 |
| `source_type` | String(64) | N | `migration_from_cpfs` / `manual_ui` / `kafka_stream` 等 |
| `snapshot_id` | BigInt | N | Iceberg snapshot 等版本号 |
| `pipeline_commit` / `pipeline_repo` / `branch_name` | String | N | git 版本三件套 |
| `table_name` | String(128) | N | 写入的结果表名 |
| `x_trace_id` | String(64) indexed | N | 跨系统追踪键 |
| `payload` | JSON | N | 事件级扩展字段 |

### 5.2 EventResult（结果维度）

`apps/api/src/models/lineage_event.py::EventResult`，物理表 `event_results`：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `event_pk` | FK→lineage_events.id | Y | — |
| `clip_id` | String(64) indexed | Y | 结果对象 |
| `payload_type` | Enum(`tag` / `label` / `check` / `mining_candidate`) | Y | 结果类型 |
| `tags` / `da_tags` / `trigger_event_tags` | String(256) | 条件 | tag 是 result 不是 entity |
| `ts` | BigInt | N | 部分结果有 ts，部分没有 |
| `extra` | JSON | N | 模块扩展 |
| `note` | Text | N | 备注 |

### 5.3 4 个维度路由

`apps/api/src/api/routes/events.py`：

```
GET /api/v1/events/dimensions/tagging
GET /api/v1/events/dimensions/labeling
GET /api/v1/events/dimensions/checking
GET /api/v1/events/dimensions/mining
```

实现：通过 `(event_type, payload_type)` 联合 filter 直接查询，无需独立物理表；当任一维度需扩展字段时再切独立维度表。

---

## 六、PipelineRun 字段简化

| 改动 | 内容 |
|---|---|
| 删除 `PipelineStage` enum | 不再有 ingest/curate/publish 概念 |
| `stage` 列保留 | 类型改 String(32)，作为**自由文本 step 名**（如 `clip-extract`、`feature-compute`、`release`）。仅展示用，不做语义约束 |
| 血缘 | 改走 Asset：每个 PipelineRun 通过 `Asset.producer_pipeline_run_id` 反查它产出哪些 derived asset |

> 若未来需要"按阶段聚合"的看板，再用 ad-hoc tag（如 `payload.kind`）或独立 `PipelineKind` 维度表，不再回到三段强枚举。

---

## 七、Catalog 与 Operations Release 工作流

### 7.1 Catalog：双视图

| 视图 | 数据源 | 用途 |
|---|---|---|
| **Datasets**（默认） | `GET /api/datasets`（来自 `datasets_v2`） | 真实数据集列表，customized + official 两个 sub-tab |
| **By Scenario**（辅助） | `fetchClipDatasets()`（按 clip.scenario 聚合） | 仍用作 clip 浏览入口 |

- 默认 tab 选 Datasets，参数 `?view=scenario` 切到 By Scenario。
- 详情页路由：
  - `/catalog/v2/:datasetId` —— 真实 dataset 详情（v2）：展示 metadata + samples 分页（含每条 sample 的 clip_id / ts / range / training_type），sample 行可跳 `/explorer/clips/:clipId?ts=...`。
  - `/catalog/:datasetId` —— scenario 聚合视图（保留 v1 兼容）。

### 7.2 Operations · Release：提级工作流

OpsItem(release) 的 `dataset_id` **必填**且必须指向一个 customized dataset。状态机：

```
drafted ──▶ gated ──▶ approved ──▶ published   (Promote 动作触发)
                          │
                          ▼
                       archived  (撤回 / 失效)
```

#### 7.2.1 后端：`POST /api/v1/datasets/{customized_id}/promote`

请求体（全部可选，未传走默认）：

```json
{
  "name": "ds_official_cutin_v2",
  "tag_expr": "promoted_from:ds_customized_xxx",
  "allow_train": true,
  "ops_item_id": "<release OpsItem id>",
  "x_trace_id": "<existing trace>",
  "requirement_id": "..."
}
```

行为：
1. 校验源 dataset `dataset_type=customized` 且 `status=active`。
2. 新建一行 `Dataset(dataset_type=official, source_type=tags, dataset_version=源.version+1, ...)`，`resolved_meta.promoted_from = customized_id`。
3. 用 `INSERT INTO dataset_samples_v2 (dataset_id, clip_id, ts, ...) SELECT NEW_ID, clip_id, ts, ... FROM dataset_samples_v2 WHERE dataset_id=customized_id`，唯一约束保证幂等。
4. 写一条 `LineageEvent(event_type=release, source_type=ops_release_promote)` + 一条 `EventResult(payload_type=tag, tags="release", clip_id=源 sample 的 clip_id 列表的代表行)`。
5. 若传 `ops_item_id`：把 OpsItem 的 `status` 推到 `published`，`payload.promoted_dataset_id = new_id`。

返回：

```json
{
  "official_dataset": { ...DatasetV2 },
  "sample_count": 123,
  "event": { ...LineageEvent },
  "ops_item": { ...OpsItem (if linked) }
}
```

#### 7.2.2 前端：Release 列表页 Promote 按钮

- 行操作区：当 `status="approved"` 且 `dataset_id != null` 时显示「Promote」按钮。
- 点击弹出 `PromoteToOfficialModal`：
  - 显示源 customized dataset 名称、sample 数（拉 `GET /api/datasets/{id}`）
  - 收集：official dataset 名称（默认 `<src.name>_official`）、`tag_expr`、`allow_train` 默认 true
  - 提交后调 `POST /api/datasets/:id/promote`，成功 → toast + 刷列表 + 跳到新 official dataset 详情页

---

## 八、设计权衡

| 决策 | 取舍 |
|---|---|
| **Dataset 只有 official + customized** | 抹掉"中间产物算第三种 dataset"的歧义；中间产物归 Asset |
| **Asset 单表覆盖 raw + derived** | 一张表 + `asset_kind` 列扛下所有"非 dataset 的数据资产"；后续若出现强子类型再切维度表 |
| **PipelineRun.stage 是自由文本** | 不绑死工业 stage 模型，只留人类可读 step 名做展示；血缘走 Asset |
| **CSVImportRowTable 不建表** | customized 数据集可追溯靠 EventResult.extra + DatasetSample.extra_meta + Asset.payload 承载 |
| **`gold_pipeline_run_id` 字段名保留** | 保护 alembic 历史，注释解释为"终态 release PipelineRun"，比 column rename 风险小 |

---

## 九、参考文件索引

| 路径 | 作用 |
|---|---|
| `apps/api/src/models/dataset.py` | Dataset / DatasetSample（仅 customized + official） |
| `apps/api/src/models/asset.py` | Asset 模型（raw + derived 两类资产） |
| `apps/api/src/models/lineage_event.py` | LineageEvent / EventResult |
| `apps/api/src/services/dataset_slice_service.py` | 切割策略 + sample 写入 + promote_to_official |
| `apps/api/src/services/event_service.py` | 事件 + 维度结果写入 |
| `apps/api/src/api/routes/datasets.py` | Dataset REST（含 /cut / /promote） |
| `apps/api/src/api/routes/events.py` | LineageEvent REST + 4 维度视图 |
| `apps/api/src/api/routes/assets.py` | Asset REST（列表 / 创建 / 详情） |
| `apps/api/alembic/versions/d2f4a5b6c7d8_dataset_v2_and_events.py` | datasets_v2 + lineage_events 迁移 |
| `apps/api/alembic/versions/e3a5b6c7d8e9_assets_table.py` | assets 表迁移 |
| `apps/bff/src/routes/datasets.ts` / `events.ts` / `assets.ts` | BFF 透传 |
| `apps/web/src/modules/datasets/` | 数据集前端模块（list / detail / picker / new modal） |
| `apps/web/src/modules/explorer/components/video-timeline.tsx` | 时间进度条 + 关键帧 tick |
| `apps/web/src/modules/explorer/components/save-cut-modal.tsx` | 保存切片弹窗 |
| `apps/api/src/models/base.py` | 公共枚举（PipelineStatus / TriggerSource / RunPurpose / OperationsModule …） |
