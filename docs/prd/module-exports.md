# 模块 PRD · Exports（数据交付与训练贡献追踪）

> 父文档：[整体产品 PRD](./ai-data-loop-infra-prd.md)
> 路由：`/exports` （5 个内部 Tab，从 operations 模块独立出来）
> 设计稿：[2026-05-04 dev-log](../dev-logs/2026-05-04-exports-sample-contribution-design.md)

## 1. 模块定位

Exports 是**数据交付与训练反哺的可观测层**——所有 official Dataset 出仓后的去向、消费频次、训练效果、hard sample 回流，全部在这里集中观察。它是 Pipelines（机器执行观测）的天然对偶：

> 简单记忆：**Pipelines 看机器在干嘛，Exports 看数据被怎么用、值不值钱**。

平台北极星：**算法工程师改 1 行 import；数据工程师从此能看到每条数据的 ROI**。

## 2. 5 个 Tab

| Tab | 内容 | 数据源 | Phase |
|---|---|---|---|
| **Snapshots** | export 收据列表（trace_id / dataset / artifact / consumed_count / sealed_at），点行进 detail | `/api/v1/exports/snapshots` | ✅ P0 |
| **Consumers** | train_run 列表（哪个 user/team 在哪个 snapshot 上跑了多少次训练） | `/api/v1/exports/train-runs` | ✅ P1 |
| **Hard Samples** | hard_score 倒序排行，每行 "Send to Mining" 按钮（MVP：跳 Mining 创建页预填 query；P3 自动 create） | `/api/v1/exports/contributions` | ✅ P2 |
| **ROI** | dataset 级看板：消费次数 / 平均 loss / hard 占比；点行进 dataset 详情 | `/api/v1/exports/contributions/rollup` | ✅ P2 |
| **Contributions** | sample_uid 输入查询单 sample 详情（loss 时间序列 + 关联 train_runs） | `/api/v1/exports/contributions/{sample_uid}` | ✅ P2 |

跨模块嵌入：

| 位置 | 改动 | 状态 |
|---|---|---|
| Catalog · Dataset 详情 | "Training Impact" 卡（消费次数 / 平均 loss / hard 占比 + Top 5 hard samples） | ✅ P2 |
| Explorer · clip 详情 | "Training History" 折叠区（带 ?dataset 时显 clip 在该 dataset 内的训练事件 timeline） | ✅ P2 |
| Operations · Mining 创建表单 | 从 Hard Sample 行 "Send to Mining" 跳转预填 query；自动 create + parent_trace_id | ⏳ P3 |

## 3. 用户故事

| 角色 | 场景 | 主操作 |
|---|---|---|
| 算法工程师 | 拿到一个 official dataset 直接训练 | `import dlkit; ds = dlkit.dataset("ds-xxx@v3")` 一行替换 DataLoader 源 |
| 算法工程师 | 想让平台看到每条 sample 的 loss | `trainer.add_callback(dlkit.LossLogger())` 一行加 callback |
| 数据工程师 | 找出本季度高 loss 的 corner case | Hard Samples Tab → 按 scenario 聚合 → "Send to Mining" |
| 数据工程师 | 看一个 official dataset 是否值得继续维护 | ROI Tab → 该 dataset 行 → 查消费 / hard 占比趋势 |
| 数据工程师 | 反查某条特定 clip 的训练轨迹 | Explorer clip 详情 → Training History 折叠区 |
| PM / 运营 | 看全平台 export → 训练 → mining 闭环水位 | Snapshots Tab Overview 卡 + Consumers Tab |
| 算法工程师 | 不想装 SDK | 仍可手动下载 artifact，平台只少了 L1 / L2 数据，不影响出仓 |

## 4. 主要功能

### 4.1 ExportSnapshot 核心字段（复用 `dataset_snapshot_manifests` + 4 字段扩展）

| 字段 | 说明 | Phase |
|---|---|---|
| `x_trace_id` | trace 唯一键 | 已有 |
| `dataset_id` / `dataset_version_id` | 出仓的数据集 | 已有 |
| `export_artifact_uri` | 物理交付路径 | 已有 |
| `export_format` | lance / csv / jsonl | 已有 |
| `clip_ids` (JSON) | 包含的 clip 列表 | 已有 |
| `sealed_at` | export 完成时间 | 已有 |
| `consumed_count` | 被 SDK 上报的消费次数 | **P0 新增** |
| `last_consumed_at` | 最近一次消费时间 | **P0 新增** |
| `train_run_count` | 关联的 train_run 数量 | **P0 新增** |
| `hard_sample_count` | 含 hard_score ≥ threshold 的 sample 数 | **P2 写入** |

### 4.2 TrainRun 核心字段（**P0 新增表 `train_runs`**）

| 字段 | 说明 |
|---|---|
| `id` PK | run uid（UUID） |
| `name` | 用户/SDK 给的 run 名 |
| `consumer` | user / team / service account |
| `external_run_id` | MLflow / W&B / Kubeflow run id（可空） |
| `model_version` | 用户标注 |
| `started_at` / `finished_at` / `status` | run 生命周期 |
| `snapshot_ids` (JSON) | 消费的 snapshot 列表 |
| `parent_trace_ids` (JSON) | 全部 upstream trace（多 snapshot 时） |
| `x_trace_id` | 主 trace（多 snapshot 取主 snapshot 的 trace） |

### 4.3 SampleConsumption / SampleContribution（**P1 / P2 新增**）

详见 [设计稿 §3.2](../dev-logs/2026-05-04-exports-sample-contribution-design.md#32-数据模型appsapisrcmodels)：

- `export_consumption_events`：高频写入，落 DuckDB 分区表，**不入主 SQLite**
- `sample_contributions`：聚合视图，由 Dagster schedule 异步刷新

### 4.4 Snapshots 列表过滤

- 链路：`requirement_id / dataset_id / x_trace_id`
- 维度：`format / scenario / consumed=yes/no`
- 关键字：`title / dataset_id / clip_id` 模糊
- 分页 + 时间倒序

### 4.5 SnapshotDetail 抽屉

- 顶部 Breadcrumb：Requirement / DataTask / OpsTask / 自身 ExportSnapshot
- artifact 信息卡 + 消费统计卡
- 关联 TrainRun 列表
- 包含的 clip / sample 列表

### 4.6 Hard Samples 视图（P2）

- sample 排行表（按 hard_score 倒序）
- 按 scenario / dataset / clip 聚合切片
- 选中后一键 "Send to Mining"：弹 modal 预填 query filter，提交后创建 mining DataTask 并把 `parent_trace_id = train_run.x_trace_id`

### 4.7 ROI 视图（P2）

- 按 dataset 分组：消费次数 / 唯一 train_run 数 / 平均 loss / hard 占比
- 时间趋势图（消费量随版本变化）
- "未消费 sample 占比" 卡（数据集瘦身候选）

## 5. 与其他模块的关系

| 上游 | 描述 |
|---|---|
| Catalog · Promote | customized → official 提级，触发 export |
| Pipelines · release run | 终态 PipelineRun 通过 snapshot manifest 落 dataset_snapshot_manifests |
| 训练侧 dlkit SDK | 异步上报 ConsumptionEvent + LossEvent |

| 下游 | 描述 |
|---|---|
| Operations · Mining | hard sample report 一键导入，创建 mining DataTask |
| Catalog · official Dataset 详情 | Training Impact Tab |
| Explorer · clip 详情 | Training History 折叠区 |
| FinOps / 老板看板 | 数据 ROI 信号源 |

## 6. 关键设计决策

完整 10 条决策见 [dev-log §5](../dev-logs/2026-05-04-exports-sample-contribution-design.md#5-关键设计决策)。最重要的 5 条：

- **D1 不做 influence functions / TracIn**：算力指数增长，per-sample loss + 频次衰减作为 hard_score proxy 已能覆盖 95% 业务诉求。
- **D2 consumption events 落 DuckDB / lance，不进主 SQLite**：单次训练 1M sample × 50 epoch = 50M event，主库写穿。
- **D3 SDK 而非 sidecar agent**：sidecar 要改部署脚本，`import dlkit` 一行更"无感"。
- **D5 失败降级本地 jsonl，绝不阻塞训练**：训练侧网络不可控，阻塞=不可接受。
- **D7 复用 `dataset_snapshot_manifests`，不新建 export_snapshots**：避免双轨同步成本。

## 7. SDK（dlkit）三层 API

| Layer | 调用方式 | 算工 effort | 平台收益 | 状态 |
|---|---|---|---|---|
| L0 元数据 | `dlkit.fetch_snapshot(trace)` | 0（不改训练代码） | snapshot 级闭环 | ✅ P1 |
| L1 sample 消费上报 | `with dlkit.run(snapshot_traces=[...]) as r: r.report(sample_uid=...)` | 改 ~3 行 | 每条 sample 是否被消费 / 频次 | ✅ P1 |
| L2 Loss 上报 | `logger = dlkit.LossLogger(run); logger.log(sample_uids, losses, ...)` | 加 ~2 行 | 每条 sample 的 loss / hard score | ✅ P2 |

包路径：`sdk/dlkit/`（uv workspace member），发布到内部 PyPI。命名取自 **D**ata **L**oop **Kit**。

**MVP 设计取舍**（详见 [`sdk/dlkit/README.md`](../../sdk/dlkit/README.md)）：buffer 是普通 list + 后台 daemon thread；失败仅 log warning，不本地落盘 / 不重试（P3 再补）；`dlkit.dataset()` 返回 `list[dict]`，不依赖 PyTorch；LossLogger 是手工调用而非 framework callback hook（不同框架接口差异大，P3 再补 PyTorchLightning / HuggingFace 适配）。

## 8. 落地分期

| Phase | 范围 | 周期 | 状态 |
|---|---|---|---|
| **P0 · Snapshot 闭环** | manifest 字段扩 + train_runs 表 + UI Snapshots Tab + e2e_demo 串通 | 1 周 | ✅ 已上线 |
| **P1 · SDK + Consumption** | sdk/dlkit 包 + `/usage` 入口 + 事件表（MVP SQLite，P3 前迁 DuckDB）+ Consumers Tab | 2 周 | ✅ 已上线 |
| **P2 · Hard Sample / ROI** | LossLogger + contribution_service（live SQL，**未做 Dagster job**）+ Hard Samples / ROI / Contributions Tab + Catalog Training Impact + Explorer Training History | 2 周 | ✅ 已上线 |
| **P3 · 闭环回流 + 性能化** | "Send to Mining" 自动 create + parent_trace_id；事件表 SQLite → DuckDB；contribution materialize 到 sample_contributions；framework callback 适配（PL / HF） | 1-2 周 | ⏳ 待开 |

每 phase 独立可上线、独立有价值。

> **MVP storage 说明**：P1 的 `export_consumption_events` 表先落主 SQLite——量级 < 100k event/snapshot 没问题，新人 onboard 心智 0。设计稿 D2 决策保留：当真实训练量逼近 50M event 时，按既定接口契约迁 DuckDB（业务代码 0 改动）。
>
> **P2 contribution_score 的 MVP 取舍**：未引入 Dagster job 与 `sample_contributions` 物化表；`/api/v1/exports/contributions*` 三个端点直接 GROUP BY live aggregation。MVP 量级 < 100k events 跑得动；P3 量级触发后再 materialize（接口契约不变）。hard_score 公式简化为 `mean_loss × log(1 + consumed_count)`，P3 再加 time_decay + 配置化。

## 9. 待办与扩展

- [ ] Hard score 公式可配置（暴露 weight 参数到运营侧）
- [ ] dlkit 兼容 TF / JAX / Ray Train（P2 之后）
- [ ] 多租户 token 隔离 + snapshot ACL
- [ ] Sample 级别的 eval feedback（不只 train loss，还有 eval metric 反哺）
- [ ] dlkit CLI：`dlkit flush` / `dlkit status`（离线 buffer 管理）
