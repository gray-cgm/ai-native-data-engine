# 2026-04-28 — End-to-End Self-Driving Demo + Snapshot Manifest

> 贯穿 requirements → data tasks → mining → pipeline (batch + streaming) →
> labeling/tagging/checking → explorer → release → catalog → export 的一键演示，
> 配套把 ops_modules 从内存搬上 SQLAlchemy、新增链路 receipt 表。

## Why

当前仓库虽然有完整 4 层模型（Req/DT/Ops/Run）+ Pipelines 5 Tab UI + Kafka demo，
但 **链路是断的**：

- `seed_trace_demo.py` 只播种元数据，不接 `data/lance/` 实数据，也不触发 catalog/export。
- 6 个 ops 子模块（labeling/tagging/checking/mining/privacy/release）用进程内
  `_InMemoryStore` 存储 → 重启全丢，演示价值差。
- pipeline 完成 → dataset_version → export 三段没有 manifest 串联，
  没有"一眼看完整链"的产物。
- 没有一条命令能演示完整闭环。

## What changed

### 新增表（apps/api 库）

| 表 | 作用 |
|---|---|
| `ops_items` | 替代 ops_modules 的 in-memory 存储；FK→`operations_tasks`，每条对应一个 mining 候选 / labeling 子项 / release 草稿 |
| `dataset_snapshot_manifests` | 端到端"链路 receipt"：trace_id ↔ requirement ↔ gold_run ↔ dataset_version ↔ export_artifact |

迁移：`apps/api/alembic/versions/c1e2d3a4b5f6_ops_item_and_snapshot.py`。
首次启动（无 alembic_version）走 create_all + stamp head，对 zero-config 开发流程友好。

### 新增模块

| 路径 | 职责 |
|---|---|
| `apps/api/src/api/middleware/x_trace.py` | 把 `X-Trace-Id` 头落进 `request.state`，缺省自动生成；响应头回写 |
| `apps/api/src/services/snapshot_service.py` | manifest 生命周期（open_or_create / attach_dataset_version / attach_export_artifact） |
| `apps/api/src/api/routes/snapshots.py` | `GET /api/v1/snapshots/{trace_id}` 链路 receipt 查询 |
| `apps/api/src/scripts/scenarios/*.yaml` | 3 个预置场景（night-vru / highway-cutin / urban-intersection） |
| `apps/api/src/scripts/lib/scenario_loader.py` | YAML → Scenario dataclass，支持 random pick |
| `apps/api/src/scripts/lib/clip_matcher.py` | 按 scenario.clip_filter 从 `data/lance/` 选候选 clip（兜底 fallback） |
| `apps/api/src/scripts/lib/streaming_probe.py` | 探测 Kafka broker 可用性，软依赖降级到 file-mode |
| `apps/api/src/scripts/e2e_demo.py` | 8 步主驱动 |

### 替换 / 修改

- `apps/api/src/api/routes/ops_modules.py`：`_InMemoryStore` 整体替换为
  SQLAlchemy 实现，HTTP 契约保持兼容；新增 `x_trace_id` / `operations_task_id`
  过滤参数。
- `apps/api/src/api/routes/export.py`：导出后调
  `snapshot_service.attach_export_artifact()` 回写 manifest，把链路 receipt 封口。
- `apps/api/src/main.py`：注入 `XTraceMiddleware`，注册 `snapshots_router`，
  CORS `expose_headers` 加 `X-Trace-Id`。
- `apps/api/src/models/__init__.py`：补全 `OperationsTask` / `OpsItem` /
  `DatasetSnapshotManifest` 导出，确保 alembic autogenerate 与 init_db
  create_all 都能感知。

### Makefile 新 target

```
make e2e-demo                                # 随机场景一键跑
make e2e-demo SCENARIO=night-vru SEED=42     # 指定 + 可复现
make e2e-demo INCLUDE_STREAMING=0            # 跳过 streaming
make e2e-demo-reset                          # 跑前清空 trace_e2e_* 历史
```

## 8 步链路与产物对照

| 步 | 步骤 | 产物 | 持久化位置 |
|---|---|---|---|
| 1 | Requirement | scenario-aware 需求（含 scene_tags / x_trace_id） | `requirements` |
| 2 | DataTask | 4 类自动 sign-off | `data_tasks` + `collection_jobs` + `annotation_tasks` |
| 3 | Mining | 候选 clip 集合（OpsItem×N，kind=hard_case） | `operations_tasks(MINING)` + `ops_items` |
| 4 | Pipeline batch | Bronze→Silver(clip)→Silver(feature)→Gold 4 条 PipelineRun | `pipeline_runs` |
| 4b | Pipeline streaming | Kafka 重放（broker 不可达降级 file），1 条 PipelineRun | `pipeline_runs` + JSONL/Kafka |
| 5 | Labeling/Tagging/Checking | 每候选 clip 1 条 OpsItem×3 模块 | `operations_tasks` + `ops_items` |
| 6 | Explorer | 复用现有 /clips API（仅打印验证 URL） | — |
| 7 | Release | OperationsTask(release) + DatasetVersion + Manifest open | `operations_tasks` + catalog `dataset_versions` + `dataset_snapshot_manifests` |
| 8 | Export | export_job + 物理文件 + Manifest seal | catalog `export_jobs` + `data/exports/` + `data/exports/e2e-snapshot-<trace>.json` |

## Verification

```bash
# 一键跑通
make e2e-demo SCENARIO=night-vru SEED=42

# 同一 SQLite 文件，API 立即可读
curl http://localhost:8000/api/v1/snapshots/trace_e2e_xxx
curl 'http://localhost:8000/api/v1/pipeline-runs?x_trace_id=trace_e2e_xxx'
curl 'http://localhost:8000/api/v1/ops/mining?x_trace_id=trace_e2e_xxx'

# 链路 receipt 落盘
ls data/exports/e2e-snapshot-trace_e2e_*.json
```

## 5 条产品 / 架构优化点（围绕本 demo）

1. **X-Trace-Id middleware**：API 层注入；OpsItem/PipelineRun/ExportJob 自动可继承当前 trace。
2. **Lineage 双写收敛**（待办）：PipelineRun 完成时统一 emit `lineage_event` 到 catalog，
   单一事实源；目前两套并存。
3. **Snapshot Manifest = "链路 receipt"**：DB 行 + JSON 文件双写，banner 末尾打印 URL。
4. **Streaming 降级显式化**：file-mode 也写一条 PipelineRun(stage=raw_ingest, trigger_source=external, run_purpose=replay)，避免被静默吞。
5. **Clip → Catalog 自动登记**：demo 启动时 `_bootstrap_catalog` 把候选 clip 注册为 dataset，否则 release 阶段挂不上 dataset_version。

## Follow-ups（未做）

- BFF 透传 `/api/v1/snapshots`（前端 UI 加"链路 receipt"页）
- Web Pipelines Overview 加 "Latest snapshots" 卡片
- Streaming step：对 Kafka 端的实际 lag 做软探活（当前只检查 TCP 可达）
- 把 lineage_event 双写收敛掉
- e2e 用例随机化更"真"：candidate clip 评分 + 部分失败重跑
