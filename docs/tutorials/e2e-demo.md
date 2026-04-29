# E2E Demo 演示：从 Requirement 到 Official Dataset

> 目标读者：第一次想看完整数据闭环跑通的 PM / 算法 / 工程师。
> 预计时长：环境就绪后 < 1 分钟跑完 9 步。
>
> 这是 **本项目的"Hello World"**——它把整条数据闭环（Requirement → DataTask → Mining → Pipeline → Labeling/Tagging/Checking → Customized Dataset → Promote → Official Dataset → Export Artifact）压缩到一条命令里，所有对象共享同一个 `x_trace_id`，可在 Web UI 任意视图回看。

---

## 1. 一句话理解

```
Requirement                  ← 业务承诺：「夜间 VRU 召回率 88% → 95%」
   │
   ├── DataTasks (4)         ← collection / annotation / quality_check / pipeline
   │
   ├── Operations
   │     ├─ Mining           ← 找候选 clip
   │     ├─ Labeling         ← 人工标注
   │     ├─ Tagging          ← 系统打 tag
   │     └─ Checking         ← QA 通过
   │
   ├── PipelineRuns          ← 4 个 step：collect / clip-extract / feature-compute / release
   │
   └── ★ Datasets
         ├─ customized       ← 把通过 Checking 的 clip 收成工作集
         └─ official         ← 通过 Release Promote 提级，allow_train=true
                │
                ▼
         Export Artifact     ← data/exports/<official_id>-v1.jsonl  (算法工程师消费入口)
```

---

## 2. 准备工作

```bash
# 1) 安装依赖
make install                  # 安装 pnpm + uv 依赖

# 2) 初始化数据库（首次必跑）
make db-upgrade               # 跑 alembic 迁移到最新版本

# 3) 把 demo clip 数据放到 data/lance/  （如已有可跳过）
#    项目里 examples/datasets 提供 minimal sample；正式 demo 期望 ~25 个 clip
```

---

## 3. 跑一次 E2E

```bash
# 推荐：指定场景 + 固定种子，便于复现
make e2e-demo SCENARIO=night-vru SEED=42

# 跑前清空旧 trace（多次实验时常用）
make e2e-demo-reset SCENARIO=night-vru SEED=42

# 跳过 streaming 步骤（无 Kafka 时）
INCLUDE_STREAMING=0 make e2e-demo SCENARIO=night-vru SEED=42

# 随机场景
make e2e-demo
```

可选环境变量：

| 变量 | 默认 | 含义 |
|---|---|---|
| `SCENARIO` | `random` | `night-vru` / `highway-cutin` / `urban-intersection` / `random` |
| `SEED` | 自动生成 | 整数，固定后可复现实验 |
| `INCLUDE_STREAMING` | `1` | `0` 跳过 Kafka streaming step |
| `RESET` | 未设置 | `1` 等价 `make e2e-demo-reset` |
| `LANCE_ROOT` | `data/lance` | 覆盖 clip 数据目录 |

---

## 4. 9 步流程详解

| Step | 产出 | 你能看到什么 |
|---|---|---|
| **1/9 Requirement** | 1 行 `requirements`，状态 `IN_PROGRESS` | Web → Requirements 列表 |
| **2/9 Data Tasks** | 4 行 `data_tasks`：collection / annotation / quality_check / pipeline，全部 sign-off | Web → Requirements/<id> 详情页"DataTasks" |
| **3/9 Mining** | 25 个 clip 候选，写入 `OperationsTask(module=mining)` 与 25 条 `OpsItem` | Web → Operations · Mining |
| **4/9 Pipeline Batch** | 4 条 `PipelineRun`（collect → clip-extract → feature-compute → release） | Web → Pipelines · Runs |
| **4b/9 Pipeline Streaming** | 1 条 streaming-replay PipelineRun（可选，需 Kafka） | Web → Pipelines · Overview |
| **5/9 Labeling / Tagging / Checking** | 共 75 条 `OpsItem`（每模块 25 条） | Web → Operations 各子 Tab |
| **6/9 Explorer** | 仅打印验证命令（不写库） | 用 curl 验证 `/clips/<id>` |
| **7/9 Build customized Dataset** ★ | 1 行 `datasets_v2(dataset_type=customized)` + N 条 `dataset_samples_v2`，每个 sample 的 ts 来自 Lance metadata 的 start/end 中点 | Web → Catalog · Customized |
| **8/9 Release Promote** ★ | 1 条 release `OpsItem(status=approved → published)` + 1 行 `datasets_v2(dataset_type=official, allow_train=true)` + N 条复制后的 sample + 1 条 `LineageEvent(event_type=release)` | Web → Operations · Release · Promote 弹窗回看 |
| **9/9 Export Artifact** ★ | 1 个 jsonl 文件 `data/exports/<official_id>-v1.jsonl` + 1 行 `assets(asset_kind=derived, producer_event_id=...)` | Web → Catalog · Official → 该 dataset 详情 |

---

## 5. 终点：算法工程师消费入口

跑完后控制台会打印交付信息：

```
══════════════════════════════════════════════════════
✔ E2E Demo Complete — deliverable: official Dataset
══════════════════════════════════════════════════════
  ── Datasets ──
  customized        : 5aee788d-...   (20 samples)
  ★ official        : ea4894c8-...   (20 samples)
    name            : ds_night_vru_a3b1799d_official
    release_event   : bac8e553-...
  artifact (file)   : data/exports/ea4894c8-...-v1.jsonl
  asset_id          : 343ef40e-...
  trace receipt     : data/exports/e2e-snapshot-trace_e2e_xxx.json
──────────────────────────────────────────────────────
For the algorithm engineer (API expected at http://localhost:8000):
  curl 'http://localhost:8000/api/v1/datasets/<official_id>'
  curl 'http://localhost:8000/api/v1/datasets/<official_id>/samples?limit=200'
  open  http://localhost:5173/catalog/v2/<official_id>
```

artifact 的每行 JSONL 包含训练所需的最小字段：

```json
{
  "id": "...", "dataset_id": "...", "clip_id": "c-0b7cf8d7-...",
  "ts": 1763354223671148337, "range_l": -1, "range_r": 3,
  "ts_origin": "flexible", "training_type": "train",
  "extra_meta": {"window": [start_ns, end_ns], "scenario": "...", "vehicle": "...", "promoted_from_sample_id": "..."}
}
```

---

## 6. 链路追踪验证

E2E 跑完会输出一个 `x_trace_id`（如 `trace_e2e_3900a3b1799d`）。用它可以在任意视图回看该次实验的全链路对象：

```bash
# 链路 receipt
curl http://localhost:8000/api/v1/snapshots/<x_trace_id>

# 该 trace 涉及的所有 PipelineRun
curl 'http://localhost:8000/api/v1/pipeline-runs?x_trace_id=<x_trace_id>'

# Snowflake 中心事件 + 4 维度（tagging/labeling/checking/mining）
curl 'http://localhost:8000/api/v1/events?x_trace_id=<x_trace_id>'

# 数据资产（raw / derived）登记
curl 'http://localhost:8000/api/v1/assets?x_trace_id=<x_trace_id>'

# Web 上跳到 pipelines 视图
open http://localhost:5173/pipelines?x_trace_id=<x_trace_id>
```

---

## 7. 常见问题

**Q：为什么 Step 4 是 0 runs？**
检查 scenario yaml 的 `stage_sequence` 是否使用了 step 名（`collect / clip-extract / feature-compute / release`）。旧值（`ingest/curate/publish`、`raw_ingest/...`）通过 `_STAGE_MAP` 自动归一，但 yaml 拼写错误会被跳过。

**Q：`no such table: datasets_v2`**
忘记跑 `make db-upgrade`。alembic 升级到 head：

```bash
make db-upgrade
make db-current   # 应显示 e3a5b6c7d8e9 (head)
```

**Q：streaming step 总失败**
没起 Kafka 也能继续——加 `INCLUDE_STREAMING=0` 跳过即可。

**Q：怎么清空所有 e2e 数据重跑？**

```bash
make e2e-demo-reset SCENARIO=night-vru SEED=42
```

`reset_existing()` 会按 `trace_e2e_*` 前缀级联清理 datasets_v2 / dataset_samples_v2 / lineage_events / event_results / assets / ops_items / pipeline_runs / operations_tasks / data_tasks / requirements / dataset_snapshot_manifests。

---

## 8. 下一步

- 想看每个步骤的代码：`apps/api/src/scripts/e2e_demo.py`
- 想理解为什么这么设计：[Dataset + Snowflake 设计](../architecture/dataset-design.md)
- 想知道术语精确含义：[术语澄清：Dataset / Scenario / Cornercase / Tag / Label](../architecture/glossary-dataset-scenario-cornercase-tag-label.md)
- 想了解整体产品定位：[整体产品 PRD](../prd/ai-data-loop-infra-prd.md)
