# 2026-04-28 · Snowflake 事件中心 + 灵活切割 + Asset 化数据资产

## 背景
- 公司新一代 Dataset 设计文档（PDF）落地：DatasetTable / DatasetSampleTable / LineageEvent / EventResult。
- 决策放弃 Bronze/Silver/Gold 三段（工业模式过重）；曾短暂改 `ingest / curate / publish`，**当日迭代二次修订后彻底删除三段概念**：
  - **Dataset 只保留 `customized` 与 `official`** 两类（customized = 工作集；official = 可训练发版集）。
  - **Asset** 概念用来登记原始采集与流水线派生数据（`asset_kind: raw | derived`）。
  - PipelineRun 的 `stage` 字段降级为自由文本 step 名（`collect` / `clip-extract` / `feature-compute` / `release` / 等）。
- Explorer 需要支持灵活切割（拖动时间窗口 + 关键帧 tick）。

## 本次改动

### 设计文档
- `docs/architecture/dataset-snowflake-redesign.md` — 完整设计，含 Dataset 主表 / Sample 事实表 / Snowflake event 中心 / 灵活切割接口 / 阶段重命名映射。
- `docs/architecture/dataset-domain-model.md` 标记为 v1 历史快照，仍保留。
- `apps/web/src/modules/docs/manifest.ts` 在「领域模型」分组中加入 v2 入口。

### Platform API（新增）
- 模型：`apps/api/src/models/dataset.py`（Dataset / DatasetSample）、`apps/api/src/models/lineage_event.py`（LineageEvent / EventResult）。
- 服务：`apps/api/src/services/event_service.py`（emit_event + 4 维度查询）、`apps/api/src/services/dataset_slice_service.py`（flexible_cut / cut_one_to_four / random_sample）。
- 路由：`apps/api/src/api/routes/datasets.py`、`apps/api/src/api/routes/events.py`，`main.py` 完成注册。
- 迁移：`apps/api/alembic/versions/d2f4a5b6c7d8_dataset_v2_and_events.py`，新建 4 张表。

### 阶段重命名（Bronze/Silver/Gold → ingest/curate/publish）
- `apps/api/src/models/base.py::PipelineStage` 改为 `INGEST / CURATE / PUBLISH`，新增 `_STAGE_ALIASES` + `normalize_stage`，吃下 `raw_ingest / clip_extraction / feature_extraction / structured_dataset / bronze / silver / gold` 等历史值。
- 同步更新：
  - `apps/api/src/scripts/e2e_demo.py`（_STAGE_MAP / _STAGE_TO_TASK_TYPE，`gold_run_id` → `publish_run_id` 字段）
  - `apps/api/src/scripts/seed_trace_demo.py`（ingest/curate URI）
  - `apps/api/src/scripts/scenarios/*.yaml`（stage_sequence: ingest/curate/publish）
  - `apps/api/src/scripts/clean-dev-data.sh`（清理 ingest/curate/publish 目录，旧 bronze/silver/gold 也保留兼容）
  - `apps/api/src/api/routes/pipelines.py`、`apps/api/src/models/requirement.py` 文档串
  - `apps/api/src/services/snapshot_service.py`、`apps/api/src/models/dataset_snapshot.py` 注释（`gold_pipeline_run_id` 字段名沿用，语义改为 publish）
  - `apps/orchestrator/src/assets/data_pipeline.py`（输出目录改 ingest/curate/publish；asset 函数名保留语义不变）
  - `apps/orchestrator/src/streaming/kafka_trigger.py`（`BRONZE_LOG_PATH` → `INGEST_LOG_PATH`，env `STREAMING_INGEST_LOG` 优先生效）
  - `python/workflows/src/workflows/streaming/local_demo.py`（DEFAULT_INGEST_LOG_PATH / DEFAULT_PUBLISH_ROOT，summary key `ingest_log_path / curate_dataset_path / publish_table_root`）
  - `python/workflows/src/workflows/demo/pipeline.py`（duckdb data_path 改 curate）
  - `apps/web/src/shared/types/common.ts` / `apps/bff/src/types.ts`（StreamingSummary 字段同步）
  - `apps/web/src/modules/pipelines/components/runs-view.tsx`（STAGE_OPTIONS）

### BFF 路由
- 新增 `apps/bff/src/engines/datasetsEngine.ts` + `handlers/datasetsHandler.ts` + `routes/datasets.ts`，覆盖 list / create / detail / cut / samples。
- 新增 `apps/bff/src/engines/eventsEngine.ts` + `handlers/eventsHandler.ts` + `routes/events.ts`，含 4 维度路由 `/events/dimensions/{dim}`。

### Web Explorer：灵活切割
- 新模块 `apps/web/src/modules/datasets/datasets-api.ts` —— 与 BFF 对接的 dataset/sample/cut 类型与请求函数。
- 新组件 `apps/web/src/modules/explorer/components/video-timeline.tsx` —— 时间进度条 + 关键帧 tick + 双手柄选区，拖动吸附最近关键帧。
- 新组件 `apps/web/src/modules/explorer/components/save-cut-modal.tsx` —— 选 / 新建 customized dataset，调用 `/api/datasets/:id/cut`，自动把 [start, end] 秒数转成 ns。
- 改造 `apps/web/src/modules/explorer/pages/clip-detail.page.tsx::VideoPlayer` —— 监听 `onTimeUpdate / onLoadedMetadata`、Mark in / Mark out / Save Cut / Clear 按钮、SaveCutModal 联动。

## 验证
- Python 文件 AST 编译通过（4 个新模型/服务/路由 + 迁移）。
- BFF `tsc --noEmit` 通过。
- Web `tsc --noEmit` 通过。

## 待办
- [ ] dataset 主表 list 页（`apps/web/src/modules/datasets/`）的列表与详情骨架。
- [ ] Operations 页面增加 4 维度子 Tab，复用 `/events/dimensions/*`。
- [ ] alembic head 升级与 seed 数据回归。
- [ ] FPS 元数据从 `camera.lance` 暴露后替换硬编码 10Hz。
- [ ] 老 catalog 库 datasets 表的双写到 datasets_v2（演进期）。

## 已知约束 / 边界
- `DatasetSnapshotManifest.gold_pipeline_run_id` 字段名沿用 v1，仅注释改语义；后续如改名需要新 alembic revision。
- ~~`PipelineStage` 旧值（raw_ingest 等）不再写入，但读出时用 `normalize_stage` 兼容历史 seed。~~ → **二次修订彻底删除该枚举与 normalize_stage**，stage 字段 SQLite 列本就是 `VARCHAR(32)`（`native_enum=False`），历史值原样以字符串读出。
- CSVImportRowTable 按需求忽略；customized 数据集的可追溯靠 `EventResult.extra` + `DatasetSample.extra_meta` + `Asset.payload` 承载。

---

## 二次修订（同日 16:00 起）

> 反馈："ingest/curate/publish 数据集的概念非常让人困惑。Dataset 只保留 customized 和 official；用 Asset 概念记录 raw 数据或 pipeline 派生数据。"

### 设计文档
- `docs/architecture/dataset-snowflake-redesign.md` 整体重写：删除"流水线阶段简化"章节，新增第 3 节 **Asset 模型**；修改 PipelineRun 字段简化（`stage` 自由文本）；强调 Dataset 仅 customized + official 两类，列出 promote 路径。
- manifest hint 更新（"Dataset v2 / 灵活切割 / LineageEvent / Asset"）。

### Platform API
- 新增 `apps/api/src/models/asset.py::Asset` + `AssetKind`，`__init__.py` 导出。
- 新增 alembic revision `e3a5b6c7d8e9_assets_table.py`：建 `assets` 表（FK→pipeline_runs / lineage_events / requirements）。
- 新增路由 `apps/api/src/api/routes/assets.py`（list / create / detail），main.py 注册 `assets_router`。
- `apps/api/src/models/base.py` 删除 `PipelineStage` 枚举与 `normalize_stage / _STAGE_ALIASES`，留下注释说明历史。
- `apps/api/src/models/requirement.py::PipelineRun.stage` 改为 `String(32)` + 自由文本注释，移除导入。
- `apps/api/src/schemas/requirement.py`、`apps/api/src/api/routes/pipelines.py` 同步：stage 类型 `str`，相关 docstring 改写。
- `apps/api/src/scripts/e2e_demo.py` / `seed_trace_demo.py`：用字符串 step 名（collect / clip-extract / feature-compute / release）替代枚举；`gold_run_id → publish_run_id → release_run_id` 字段命名收敛。
- `apps/api/src/scripts/scenarios/*.yaml`：`stage_sequence` 改为 4 个简单 step 名。

### BFF
- 新增 `routes/assets.ts` + `engines/assetsEngine.ts` + `handlers/assetsHandler.ts`，自动通过文件扫描注册。
- StreamingSummary 字段重命名：`ingest_log_path → normalized_log_path`、`curate_dataset_path → sample_dataset_path`、`publish_table_root → release_table_root`。

### Orchestrator
- `apps/orchestrator/src/assets/data_pipeline.py`：删除 ingest/curate/publish 命名，改用"raw asset → derived asset → official dataset"语义；data 目录 `data/raw/`、`data/assets/`、`data/exports/` 替代 `data/ingest/、curate/、publish/`。

### Workflows
- `python/workflows/src/workflows/streaming/local_demo.py`：常量改名 `DEFAULT_NORMALIZED_LOG_PATH` / `DEFAULT_RELEASE_ROOT`，summary 字段同步。

### Web
- `apps/web/src/shared/types/common.ts` StreamingSummary 字段同步。
- `apps/web/src/modules/pipelines/components/runs-view.tsx::STAGE_OPTIONS` 改为 step 名集合，备注"自由文本，可输入任意值"。

### 验证
- 12 个 Python 文件 AST 编译通过。
- BFF `tsc --noEmit` 通过。
- Web `tsc --noEmit` 通过。

### 兼容性
- `clean-dev-data.sh` 仍清理 `data/ingest/、curate/、publish/` 目录便于演进期回退。
- e2e_demo `_STAGE_MAP` / `_STAGE_TO_TASK_TYPE` 同时接受新 step 名与旧 yaml 名（`ingest/curate/publish/raw_ingest/...`）。
- `Asset` 表是新增表，不影响既有数据；旧 PipelineRun 的 stage 列原样读出。

---

## 三次修订（同日 18:00 起）

> 反馈：
> 1. Catalog 与 Operations · Release 没有体现与 dataset 的关联，请完善工作流；
> 2. clip 各 sensor 的视频 in/out 数据，请复用 lance metadata 的 start/end。

### 设计文档
- `docs/architecture/dataset-snowflake-redesign.md`：
  - §2.1 增加 customized↔official 提级工作流图示
  - §4.4 标注"时间戳来源"——直接用 Lance `start_time/end_time`（ns）做 single source of truth
  - 新增 §7「Catalog 与 Operations Release 工作流」，详述双视图 + Promote 端点契约

### Platform API
- `services/dataset_slice_service.py::promote_to_official(...)`：复制全部 sample（依赖 `(dataset_id, clip_id, ts)` 唯一约束去重），新建 `dataset_type=official` 行（`resolved_meta.promoted_from`），写一条 `LineageEvent(event_type=release, source_type=ops_release_promote)` + 代表性 EventResult，最后把传入的 OpsItem 状态推到 `published`。
- `routes/datasets.py` 新增 `POST /api/v1/datasets/{id}/promote`。

### BFF
- `engines/datasetsEngine.ts::promoteDataset(...)`、`handlers/datasetsHandler.ts::promote(...)`、`routes/datasets.ts` 新增 `POST /datasets/:id/promote`，含 Joi 校验 + X-Trace-Id 透传。

### Web
- `modules/datasets/datasets-api.ts` 新增 `promoteDataset()` 与 `PromoteResponse` 类型。
- **Catalog 改造**：
  - `pages/dataset-list.page.tsx` 改为双视图 Segmented（默认 Datasets, 备选 By scenario）。Datasets 视图按 `dataset_type` 切 Customized / Official 两个 Tab，列表来自 `GET /api/datasets`，列名跳进 `/catalog/v2/:id`。
  - 新增 `pages/dataset-v2-detail.page.tsx`：metadata + sample 表（每行可跳到 `/explorer/clips/:clipId?ts=...&dataset=...`），如果是 promoted-official，顶部 Alert 显示来源 customized 链接。
  - `routes.tsx` 注册 `/catalog/v2/:datasetId` 优先于 `/catalog/:datasetId`（保留 v1 scenario 详情）。
- **Release 模块 Promote 入口**：
  - `components/promote-to-official-button.tsx`：行级按钮 + Modal，仅当 `status=approved` 且 `dataset_id` 非空时启用，禁用时通过 Tooltip 解释原因。Modal 拉源 dataset 后预填 `name`/`tag_expr`，提交调 `promoteDataset`，成功 → 提示复制 / 去重数 + refresh 列表。
  - `components/ops-module-list-page.tsx` 新增可选 `extraRowActions` 渲染 prop，注入到 actions 列。
  - `pages/release.page.tsx` 改为传入 `extraRowActions={(row, refresh) => <PromoteToOfficialButton ... />}`。

### 视频时间轴改用 Lance ns
- `components/video-timeline.tsx`：内部全部按 ns 计算，props 改为 `clipStartNs / clipEndNs / currentNs / window.{startNs,endNs} / onScrubNs`；UI 显示 ns 数字 + ms 偏移；关键帧 tick 通过 `frameIndex / total_frames * (end-start) + start` 投影。
- `components/save-cut-modal.tsx`：`windowNs={startNs, endNs}` 直入；不再做 sec→ns 转换；提示行展示 `windowNs` 与持续 ms。
- `pages/clip-detail.page.tsx::VideoPlayer`：增加 `secondsToNs` / `nsToSeconds` 双向映射；`onTimeUpdate` 把 `video.currentTime` 投影到 ns 写入 `currentNs` state；Mark in/out 按钮文案改为显示当前 ns；`handleScrubNs` 反向映射 ns 回到 seconds 设置 `video.currentTime`。

### 验证
- Web `tsc --noEmit` 通过；BFF `tsc --noEmit` 通过。
- Python AST 编译通过（dataset_slice_service / datasets 路由）。

### 兼容性
- 旧 `/catalog/:datasetId` （scenario:slug）继续可用；`/catalog/v2/:datasetId`（UUID）走 v3 视图。
- `OpsModuleListPage` 的 `extraRowActions` 是 optional prop，labeling/tagging/checking/mining 不传则保持现状。
- `summary.start_time / end_time` 缺失（极旧数据）时回退到 `duration_seconds * 1e9`，UI 不会崩，但 ns 值是合成的；写入的 sample 还是会得到合理的 ts 序号。
