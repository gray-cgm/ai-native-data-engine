# 2026-05-04 · Exports · Per-sample 训练贡献追踪 · PRD + Architecture

> 设计稿（未编码）。目标：把"export 次数"升级成"每条 sample 对模型梯度下降的贡献度"，闭环回流到 mining。
>
> 北极星：**算法工程师改 1 行 import；数据工程师从此能看到每条数据的 ROI。**

---

## 0. 现状一句话

`POST /exports/dataset/{id}` → 落 Lance/CSV/JSONL + 写 `dataset_snapshot_manifests`（带 `x_trace_id`）。**之后失明**：谁拉走了、训练用没用、效果怎么样、要不要回流——全部未知。

---

## 1. 价值分层（核心思想：按 ROI 切层，独立可上线）

| Level | 算法工程师 effort | data工程师 / 平台 effort | 收益 | 落地难度 |
|---|---|---|---|---|
| **L0 · Snapshot 闭环** | 0 | 1 张表扩字段 + 1 个 UI Tab | 知道哪个 snapshot 被谁、什么时候拉走 | 低 |
| **L1 · Consumption 追踪** | `import dlkit` 1 行 | SDK + 1 张事件表 | 每条 sample 是否被消费 / 频次 / 哪次训练用 | 中 |
| **L2 · Contribution 评分** | `+ dlkit.LossLogger()` 1 行 | + loss 聚合 Dagster job + 2 个 UI Tab | 每条 sample 的 loss 分布 / hard score / dataset ROI | 中 |
| **L3 · 真梯度归因** | callback 改造 + 算力 | influence functions / TracIn pipeline | 严格因果归因 | 高 ← **不做** |

**L2 是 sweet spot**：per-sample loss + 使用频次足以定位 hard example 与冷门样本，覆盖 95% 业务诉求；上 L3 算力指数增长，业务收益边际递减。

---

## 2. PRD

### 2.1 用户故事

**A · 算法工程师（核心：无感）**
- 下载完 export，`import dlkit; ds = dlkit.dataset("ds-xxx@v3")` → DataLoader 直接喂 → 自动上报消费
- 加 1 行 `trainer.add_callback(dlkit.LossLogger())` → 每条 sample 的 loss 自动回传
- 不强制；不上报也能用，但平台对其 train run 失明

**B · 数据工程师 / 数据治理（核心：可视化 + 一键回流）**
- "高 loss sample 集中在哪些 scenario？" → 反推下一轮 mining 的查询条件
- "这条 corner case clip 上次训练学得怎么样？" → Explorer clip 详情新增 Training History
- "哪些 sample 从未被消费？" → 数据集瘦身候选
- "official Dataset v3 vs v2 哪个对收敛更有利？" → ROI 看板
- 一键 "high-loss → 创建 mining DataTask"，自动继承 parent_trace_id

**C · 平台运营 / PMO**
- export → train → eval → mining 真闭环可观测
- 与 Requirement 模块关联：一个 Requirement 累计训练消费多少次 / 产出多少 hard sample

### 2.2 关键场景

| # | 场景 | 触达点 |
|---|---|---|
| S1 | 训练自动注册 | SDK 检测 `MLFLOW_RUN_ID` / `WANDB_RUN_ID` 环境变量自动注册 train_run，0 配置 |
| S2 | Hard sample 自动报告 | 训练结束 24h 内 Dagster schedule 跑 contribution_score，生成报告 |
| S3 | 一键回流 mining | UI "Send to Mining" → 创建 mining DataTask，预填 query filter，trace 链贯通 |
| S4 | 数据集 ROI 看板 | Catalog official dataset 详情页加 Training Impact Tab |
| S5 | 离线降级 | SDK 网络抖动时本地 jsonl 落盘，事后补传，绝不阻塞训练 |

### 2.3 非目标（明确 out of scope）

- ❌ 不做模型管理（model registry 留给 MLflow / W&B）
- ❌ 不做训练编排（不抢 Kubeflow / Ray 的活）
- ❌ 不做严格梯度归因（influence functions 算力不划算）
- ❌ 不强制改训练代码（不上报也能用，只是平台失明）

---

## 3. Architecture · 6 层落点

### 3.1 全景

```
┌───────────────────────────────────────────────────────────────────┐
│ apps/web   exports module 5 Tab：                                   │
│   Snapshots / Consumers / Hard Samples / ROI / Contributions       │
│   + Catalog official Dataset 加 Training Impact Tab                  │
│   + Explorer clip 详情加 Training History 折叠区                      │
├───────────────────────────────────────────────────────────────────┤
│ apps/bff   /exports/* ViewModel 聚合 + train_run / consumption 拼装  │
├───────────────────────────────────────────────────────────────────┤
│ apps/api   /v1/exports/snapshots          (扩字段)                    │
│            /v1/exports/train-runs         (新)                       │
│            /v1/exports/usage              (新, SDK 异步上报入口)       │
│            /v1/exports/contributions      (新, 聚合查询)               │
│            services/training_feedback_service.py (事务型)            │
├───────────────────────────────────────────────────────────────────┤
│ python/workflows/exports/                                           │
│   ├ usage_ingest.py        consumption 落盘 + dedup                  │
│   ├ contribution_score.py  loss → hard_score / ROI 聚合              │
│   └ feedback_loop.py       high-loss → mining DataTask 触发          │
├───────────────────────────────────────────────────────────────────┤
│ python/adapters/                                                    │
│   └ event store: consumption events 走 DuckDB 分区表                 │
│                  （不落主 SQLite，量级 50M+/训练）                     │
├───────────────────────────────────────────────────────────────────┤
│ python/core/domain/exports.py                                       │
│   TrainRun / SampleConsumption / SampleContribution （Pydantic）     │
└───────────────────────────────────────────────────────────────────┘
                          ▲
        ┌─────────────────┴─────────────────┐
        │  python/sdk/  新建 workspace 包      │
        │  dlkit.dataset() / dlkit.LossLogger()│
        │  发布到内部 PyPI                      │
        └─────────────────────────────────────┘
                          ▲
                训练侧（一行 import；离线降级 jsonl）
```

### 3.2 数据模型（apps/api/src/models/）

**复用，不新建**：
- `dataset_snapshot_manifests` 加 4 字段：`consumed_count`, `last_consumed_at`, `train_run_count`, `hard_sample_count`
- `LineageEvent.event_type` 新增枚举值：`train_consume`（不新建独立表，复用 Snowflake 中心）

**新增 3 张表**：

`train_runs`（训练运行注册）
| 列 | 说明 |
|---|---|
| `id` PK | run uid |
| `name` | 用户/SDK 给的 run 名 |
| `consumer` | user / team / service account |
| `external_run_id` | MLflow / W&B run id（可空） |
| `model_version` | 用户标注 |
| `started_at` / `finished_at` / `status` | run 生命周期 |
| `snapshot_ids` JSON | 消费的 snapshot 列表 |
| `x_trace_id` | 继承（多 snapshot 取主 trace 或新生成 child） |

`export_consumption_events`（高频，**落 DuckDB / lance 分区表**，**不落 SQLite**）
| 列 | 说明 |
|---|---|
| `id` | uuid |
| `snapshot_id` FK | |
| `sample_uid` | DatasetSample 复合键拼接 |
| `train_run_id` FK | |
| `epoch` / `step` | 训练位置 |
| `loss` nullable | L2 才有 |
| `ts` | |
| `x_trace_id` | 透传 |

按天 + snapshot_id 分区。索引 `(snapshot_id, sample_uid)`, `(train_run_id, ts)`, `x_trace_id`。

`sample_contributions`（按 sample 维度的聚合表，由 Dagster 异步刷新）
| 列 | 说明 |
|---|---|
| `sample_uid` PK | |
| `dataset_id` / `clip_id` | 反查锚点 |
| `consumed_count` / `train_run_count` | 频次 |
| `mean_loss` / `loss_p95` / `loss_trend` | 统计 |
| `hard_score` | 综合分（loss × 频次衰减） |
| `last_used_at` | |
| `x_trace_id` | |

ORM 落点：`apps/api/src/models/train_run.py`（新文件）+ `lineage_event.py`（P2 加枚举值）。

### 3.3 x_trace_id 链路扩展

```
Requirement → DataTask(release) → OperationsTask → PipelineRun
   → Dataset(official) → ExportSnapshot
        ▼
     TrainRun → ConsumptionEvent → SampleContribution
        ▼
     LineageEvent(train_consume) → 反哺 ▼
        Mining DataTask（parent_trace_id = 上一条 train trace）
```

**这是平台终于闭环的一刻**：之前 trace 链止步 ExportSnapshot，现在能延伸到训练侧再回流 mining，形成"AI Native Data Engine"名副其实的数据闭环。

新约束：
- `train_runs.x_trace_id` 多 snapshot 时取主 snapshot 的 trace；同时新增 `train_runs.parent_trace_ids` JSON 列保留全部 upstream
- 反哺 mining 时 `OperationsTask.parent_trace_id` = 触发它的 `train_run.x_trace_id`，新生成自己的 trace（不复用，避免环）

### 3.4 Python SDK 设计（**zero-touch 关键**）

新增 workspace 包 `python/sdk/dlkit/`，发布到内部 PyPI。命名取自 **D**ata **L**oop **Kit**——刻意避开 `aide` / `dataloader` 等会与 PyTorch `DataLoader` 撞心智的名字。

**Layer 0 · 仅元数据**（最小耦合）
```python
import dlkit
manifest = dlkit.exports.fetch("ds-xxx@v3")
# 返回 ExportSnapshot Pydantic 对象，不改训练代码
```

**Layer 1 · IterableDataset（一行替换）**
```python
import dlkit
ds = dlkit.dataset("ds-xxx@v3")       # 自动 detect _dlkit.json，注册 train_run
for x, y in DataLoader(ds): ...        # 后台 emit ConsumptionEvent
```

**Layer 2 · Loss callback（一行）**
```python
# vanilla pytorch
trainer.add_callback(dlkit.LossLogger())
# pytorch lightning
trainer = pl.Trainer(callbacks=[dlkit.LossLogger()])
# huggingface trainer
trainer = Trainer(..., callbacks=[dlkit.LossLogger()])
```

**SDK 内部要点**：
| 关注点 | 设计 |
|---|---|
| 上报通道 | 本地 SQLite ring buffer + 后台线程异步 batch flush |
| 训练阻塞 | 0 阻塞——SDK 任何调用都不在主线程同步 IO |
| 失败降级 | 网络失败 → 本地 jsonl 落盘 `~/.dlkit/buffer/<run_id>.jsonl`，事后 `dlkit flush` 补传 |
| run id 发现 | 自动读 `MLFLOW_RUN_ID` / `WANDB_RUN_ID` / `KUBEFLOW_RUN_ID`，缺省自生成 |
| Manifest 内嵌 | export 产物根目录加 `_dlkit.json`：`{snapshot_id, sample_index, api_endpoint, x_trace_id}`，SDK 自检后零配置注册 |
| 鉴权 | `DLKIT_TOKEN` 环境变量；缺失则 SDK 退化为本地日志模式（仍能 jsonl 留痕） |

### 3.5 UI 落位

| 位置 | 改动 |
|---|---|
| `apps/web/src/modules/exports/`（**新建模块**，从 operations 拆出） | 5 Tab：Snapshots / Consumers / Hard Samples / ROI / Contributions |
| `apps/web/src/modules/catalog/.../official-dataset-detail` | 加 "Training Impact" Tab |
| `apps/web/src/modules/explorer/.../clip-detail` | 加 "Training History" 折叠区（这条 clip 累计被多少次训练消费、平均 loss） |
| `apps/web/src/modules/operations/.../mining` | 创建 mining task 表单加"从 Hard Sample Report 导入" |

---

## 4. 落地分期

| Phase | 范围 | 周期 | 单独价值 |
|---|---|---|---|
| **P0 · L0 闭环** | manifest 字段扩 + train_runs 表 + UI Snapshots Tab + e2e_demo 串通 | 1 周 | 知道谁拉走了 |
| **P1 · L1 SDK** | python/sdk 发布 + `/usage` 入口 + DuckDB 事件表 + Consumers Tab | 2 周 | 消费可见 |
| **P2 · L2 贡献** | LossLogger + contribution_score Dagster job + Hard Samples Tab + ROI Tab + Catalog Training Impact | 2 周 | 贡献可见 |
| **P3 · 闭环回流** | feedback_loop workflow + mining 创建表单整合 + Explorer Training History | 1 周 | 闭环回流 |

每 phase 独立可上线、独立有价值。L0 上线后即使 SDK 不发布，也已比现状强。

---

## 5. 关键设计决策

| # | 决策 | 理由 |
|---|---|---|
| D1 | 不做 influence functions / TracIn | 算力指数增长，per-sample loss + 频次衰减作为 hard_score proxy 已能覆盖 95% 业务诉求 |
| D2 | consumption events 落 DuckDB / lance，不落 SQLite | 单次训练 1M sample × 50 epoch = 50M event，SQLite 写穿 |
| D3 | SDK 而非 sidecar agent | sidecar 要改部署脚本；import 一行更"无感"，符合算工心智 |
| D4 | train_run_id 从环境变量自动 detect | MLflow / W&B / Kubeflow 已标准化，0 配置最优 |
| D5 | 失败降级本地 jsonl，绝不阻塞训练 | 训练侧网络不可控，阻塞=不可接受 |
| D6 | 复用 LineageEvent，新增 `train_consume` 枚举 | 与 6 类 OperationsTask 平级查询；不新建独立查询视图 |
| D7 | 复用 `dataset_snapshot_manifests`，不新建 export_snapshots | 避免双轨同步成本 |
| D8 | exports 从 operations 模块独立 | 5 Tab 信息密度足够撑独立模块；与 Pipelines 模块对称（运行观测 vs 交付观测） |
| D9 | 反哺 mining 用 `parent_trace_id`，新生成 trace_id | 避免 trace 环；保留 upstream 反查 |
| D10 | hard_score = `loss × log(1 + recent_consume_count) × time_decay` | 综合 loss 高低 + 是否反复训仍学不会 + 时效性。可配置权重 |

---

## 6. effort 量化

| 角色 | 现状 | P1 | P2 | P3 |
|---|---|---|---|---|
| 算工 | 手动下载 / 加载 | +1 行 import | +1 行 callback | 同 P2 |
| 数工 | 看 export 计数 | 看消费列表 | 看 hard sample / ROI | 一键回流 mining |
| 平台 | 失明 | snapshot ↔ run 对账 | 全链路可观测 | 闭环成立 |

---

## 7. 风险 & 缓解

| 风险 | 缓解 |
|---|---|
| 算工拒装 SDK | 保留 L0 manifest 下载，至少 snapshot 级闭环不失；Internal evangelism 配 ML infra 团队 |
| consumption event 写入压力 | Buffer + batch + DuckDB 分区；必要时引入 Kafka |
| 多 framework 兼容 | P2 先 PyTorch / Lightning / HuggingFace，TF / JAX 进 backlog |
| 多租户数据泄漏 | `DLKIT_TOKEN` 隔离；snapshot 只能 SDK 上报到自己 tenant |
| Hard score 算法争议 | 公式可配置 + 暴露原始 loss 数据供算工自取 |

---

## 8. 与红线 / 分层的自洽性检查

- ✅ `python/workflows/exports/` 只接 `RuntimeContainer`，无 fastapi / dagster import
- ✅ `python/sdk/` 是新 workspace 包，对外发布，不依赖 `apps/`
- ✅ FastAPI route 薄壳，事务走 `services/training_feedback_service.py`
- ✅ Dagster asset 只调 workflow，container 走 resource 注入
- ✅ x_trace_id 全程透传；新表都带列 + 索引
- ✅ 不在 `python/core` 引入框架；不复制 ORM
- ✅ BFF 只做 ViewModel 聚合，不直连 runtime

---

## 9. 下一步

待 user 确认本设计后：
1. 拉 issue：P0 ~ P3 各一张 epic
2. P0 先动手：alembic 迁移 + UI Snapshots Tab + e2e_demo 串通
3. 同步更新 `docs/architecture/business-flows.md`（加训练反哺闭环）和 `.claude/skills/AI_Data_Engine_Skill.md`（§4 Exports 模块改一句话职责）
