# 新手指南

> 目标读者：第一周入职的工程师 / 算法 / PM。
> 学习路径：按 [系统分层](../architecture/system-layers.md) 从下到上跑 7 个独立 demo，每个 demo 聚焦 1-2 个分层 / 1-2 个对象。
> 全部跑完 → 你能完全看懂 [E2E Demo](./e2e-demo.md)（11 步含闭环回流）的代码。

---

## 0. 为什么要做这套 Onboarding？

直接看 [`apps/api/src/scripts/e2e_demo.py`](../../apps/api/src/scripts/e2e_demo.py) 一上来 1000+ 行、11 步串行（含 Step 10 训练反馈 + Step 11 闭环回流），新人很难抓住"系统分了几层、每层在做什么"。

本教程把这 1000 行**拆成 7 个 < 250 行的小 demo**，每个：

- 聚焦 1-2 个分层（按 [system-layers.md](../architecture/system-layers.md)）
- < 250 行、注释密集
- console 大量打印（一眼看出"现在跑到哪步、做了什么、产出了什么"）
- 末尾打 `curl ...` / `open ...` 命令，方便用浏览器/终端验证

跑完 7 个 demo，再回头看 e2e_demo.py，你会发现它就是把这 7 步串起来。

---

## 1. 准备工作

```bash
# 1) 安装依赖
make install

# 2) 升级 DB schema（首次跑 04+ 必须）
make db-upgrade

# 3) 把 demo clip 数据放到 data/lance/c-<uuid>/
#    没有真实数据也可以跑 02 / 04 / 06（不依赖 clip）
#    01 / 03 / 05 / 07 至少需要 1 个 clip 才能完整体验
```

---

## 2. 学习路径（7 步）

| # | Demo | 对应分层 | 核心知识点 |
|---|---|---|---|
| **01** | `s01_lance_format.py` | ① 文件格式层 | 一个 clip 在磁盘上长什么样（`meta.lance` / `topic.lance` / standalone）；用 `lance.dataset()` 直接看 schema、读几行 |
| **02** | `s02_storage_adapter.py` | ② 存储层 | `LocalFileStorageAdapter` 的 put/get/list/delete + open（流式）；profile 切 backend 的设计 |
| **03** | `s03_duckdb_query.py` | ⑤ 查询层 | DuckDB 在 Lance 上跑 SQL：register Arrow → SQL → GROUP BY；DataFusion 演进规划 |
| **04** | `s04_business_flow.py` | ⑥ 业务承诺 | Requirement → 4 个 DataTask（sign-off）→ OperationsTask；x_trace_id 串通 |
| **05** | `s05_dataset_sample.py` | ⑥ 数据资产 | create customized Dataset；3 种切割（flexible / one_to_four / random_sample）；唯一约束实测 |
| **06** | `s06_snowflake_lineage.py` | 血缘观测 | emit LineageEvent + EventResult + 4 维度 query；登记 Asset |
| **07** | `s07_promote_export.py` | 端到端收尾 | Promote → official Dataset → 导出 jsonl + 登记 Asset + DatasetSnapshotManifest（闭环回流见 e2e_demo Step 10/11） |

跳过 ③ 湖表格式层 / ④ 计算层是有意为之——当前 MVP 还在用裸文件 + local Python，不用 Iceberg / Spark。等切到团队 / SaaS 阶段再写两节。

---

## 3. 跑法

### 推荐：用 Makefile

```bash
make onboarding-01            # 01 文件格式层
make onboarding-02            # 02 存储层
make onboarding-03            # 03 查询层
make onboarding-04            # 04 业务承诺
make onboarding-05            # 05 数据资产
make onboarding-06            # 06 血缘观测
make onboarding-07            # 07 端到端收尾

make onboarding-all           # 一次跑全部 7 个
```

### 直接 module 调用（细节）

```bash
uv run --package api python -m src.scripts.onboarding.s01_lance_format
uv run --package api python -m src.scripts.onboarding.s01_lance_format --clip c-0b7cf...
uv run --package api python -m src.scripts.onboarding.s04_business_flow --reset
```

每个 demo 都支持 `--reset`（清掉本 demo 自己产生的旧数据）和 `--help`。

---

## 4. 每步学到什么

### 01 · 文件格式层（Lance）

**目标**：理解一个 clip 在磁盘上长什么样。

**关键收获**：
- Lance 是列式 + 向量原生格式（vs Parquet：增量 append / 向量索引更友好）
- 一个 clip = 一个目录，含多个 `*.lance` 子表：
  - `meta.lance` → 单行元数据（车辆 / 地点 / 场景 / tags / 时间窗口）
  - `topic.lance` → 关键帧表（多 topic / 多 camera 列）
  - `<Topic>.lance` → 高频独立 topic 表
  - `wm.lance` → 水位线（可选）
- 时间字段（`start_time` / `end_time`）单位 = 纳秒
- `clip_reader` 是项目对 Lance 的薄包装

**进阶阅读**：[Clip + Lance 数据模型](../architecture/clip-lance-data-model.md)

---

### 02 · 存储层（Storage Adapter）

**目标**：学会用 `StorageAdapter` 抽象做"字节读写"，理解 profile 切换 backend 不改代码的原则。

**关键收获**：
- `StorageAdapter` 抽象在 `python/core/src/core/interfaces/contracts.py`
- 当前实现：`LocalFileStorageAdapter`（本地 fs）/ `S3StorageAdapter`（boto3）
- 操作语义：`put / get / list / delete + open`（流式）
- 未来规划：`OpenDALStorageAdapter` 接管 30+ 后端
- 写应用代码时**不要**直接 `boto3` / `open(...)`；走 adapter 才能在 personal/team/SaaS 间切换

**进阶阅读**：[技术选型：DataFusion / OpenDAL](../adr/tech-selection-datafusion-opendal.md)

---

### 03 · 查询层（DuckDB on Lance）

**目标**：学会用 DuckDB 在 Lance 文件上跑 SQL。

**关键收获**：
- 查询路径：`lance.dataset → PyArrow Table → DuckDB.register → SQL`
- DuckDB 是嵌入式 OLAP 引擎（无服务进程）
- 当前用法：cursor 模式 `con.execute(sql).fetchall()`
- `QueryAdapter` 抽象在 `python/core/src/core/interfaces/contracts.py`
- 未来规划：`DataFusionQueryAdapter`（Lance native，省一层 Arrow 中转）

**调试小贴士**（demo 末尾会打印）：
- explain plan：`con.execute('EXPLAIN <sql>').fetchall()`
- 看物化中间表：`PRAGMA show_tables`
- 大 Lance 用 `ds.scanner(columns=[...], filter=...)` 而不是 `to_table()` 全量

---

### 04 · 业务领域层（Requirement → DataTask → OperationsTask）

**目标**：学会"四层闭环对象"前 3 层的写法。

**关键收获**：
- 一切从 **Requirement**（业务需求）起步
- 自动拆 **4 条 DataTask**（collection / annotation / quality_check / pipeline）
- 每条 DataTask 走 sign-off 流程才能进入执行
- **OperationsTask** 是 5 子域（mining / labeling / tagging / checking / release）的协调单元
- 全部对象共享同一个 `x_trace_id`——后续视图都能按 trace 反查
- SQLAlchemy 模型见 `apps/api/src/models/requirement.py` + `ops_item.py`

**进阶阅读**：[模块 PRD · Requirement](../prd/module-requirement.md)

---

### 05 · 数据资产（Customized Dataset + 3 种切割）

**目标**：学会写 `DatasetSample` 的三种切割策略。

**关键收获**：
- Dataset 只有 customized + official 两类
- `DatasetSample` 由 `(dataset_id, clip_id, ts)` 三元组唯一约束
- 切割策略 `slice_strategy`：
  - `flexible` —— 用户在 Explorer 拖动选 `[start, end]`，ts 取中点
  - `one_to_four` —— clip 等分 4 段，每段中点为 ts
  - `random_sample` —— 随机窗口
- ts 取自 Lance metadata 的 `start_time / end_time`（ns）
- 服务函数：`apps/api/src/services/dataset_slice_service.py`

**进阶阅读**：[Dataset + Snowflake 设计](../architecture/dataset-design.md)

---

### 06 · Snowflake 血缘（LineageEvent + EventResult + Asset）

**目标**：学会 emit `LineageEvent` + `EventResult`，理解 4 维度是 query view 而非物理表；学会登记 Asset。

**关键收获**：
- `LineageEvent` 是中心事件：一次 mining / 标注 / 质检 / migration / release = 一条
- `EventResult` 是逐 clip 结果行（一次 event 通常 N 条 EventResult）
- 4 维度 = `(event_type, payload_type)` 的联合 filter，无独立物理表
  - `tagging` → `event_type ∈ {tagging, migration} ∧ payload_type=tag`
  - `labeling` → `event_type=labeling ∧ payload_type=label`
  - `checking` → `event_type=checking ∧ payload_type=check`
  - `mining` → `event_type=mining ∧ payload_type=mining_candidate`
- `Asset` 是数据资产登记表（`asset_kind=raw/derived`），靠 `producer_pipeline_run_id` / `producer_event_id` 反查血缘

**进阶阅读**：[Dataset + Snowflake 设计 §五](../architecture/dataset-design.md)、[术语澄清 · §7.4 血缘观测层](../architecture/glossary-dataset-scenario-cornercase-tag-label.md)

---

### 07 · 端到端收尾（Promote + Export）

**目标**：把 customized dataset 提级为 official，导出 jsonl artifact 给算法工程师消费。

**关键收获**：
- **Promote = 复制 sample + 新建 official Dataset 行 + 写 LineageEvent(release)**
- 唯一约束 `(dataset_id, clip_id, ts)` 保证幂等：重复 Promote 不会重复 sample
- export artifact 一行一个 sample，算法 dataloader 直接消费 jsonl
- `DatasetSnapshotManifest` 是端到端 receipt（trace → official → artifact）
- 服务函数：`dataset_slice_service.promote_to_official` + `snapshot_service.attach_*`

**算法工程师消费入口**（每个 demo 末尾打）：

```bash
curl 'http://localhost:8000/api/v1/datasets/<official_id>/samples?limit=200'
cat  data/exports/<official_id>-v1.jsonl
open http://localhost:5173/catalog/v2/<official_id>
```

> **下一步：训练反馈 + 闭环回流（Exports 模块的核心价值）**
>
> Onboarding 第 7 步只演示到 Export artifact 落地。算法工程师**消费**之后还有
> 两件事，构成完整的数据闭环——onboarding 不重复实现（避免引入 dlkit SDK
> 依赖），直接看 e2e_demo 的 Step 10/11：
>
> - **Step 10 · Training Feedback** —— 算工通过 [`dlkit`](../../sdk/dlkit/README.md) SDK
>   注册 TrainRun + 批量上报 per-sample loss。e2e_demo 直接调
>   `train_run_service.register` + `consumption_event_service.ingest_batch` 等价模拟。
> - **Step 11 · Closed-Loop Feedback** —— `contribution_service` 计算 hard_score
>   后，自动把 top hard sample 回流到下一轮 mining：spawn 新 `OperationsTask`
>   `(module=mining, payload.parent_trace_id=本轮 trace)`，**两轮 trace 用 parent
>   串通形成闭环**。
>
> 完整 11 步：[`apps/api/src/scripts/e2e_demo.py`](../../apps/api/src/scripts/e2e_demo.py) ·
> 模块 PRD：[Exports](../prd/module-exports.md)

---

## 5. 学完之后

跑完 7 个 demo 后，你已经摸过了：

✅ Lance 文件结构（① 文件格式层）
✅ Storage adapter 抽象（② 存储层）
✅ DuckDB on Lance（⑤ 查询层）
✅ 四层闭环对象 + sign-off（⑥ 业务承诺）
✅ Dataset / Sample / 切割策略（⑥ 数据资产）
✅ Snowflake 中心 + 4 维度 + Asset（血缘观测）
✅ Promote → official → artifact（端到端交付）

⏳ 7 个 onboarding demo 不覆盖的 2 步（在 e2e_demo 里）：
- **训练反馈**（Step 10）—— TrainRun 注册 + per-sample loss 上报，dlkit SDK 等价路径
- **闭环回流**（Step 11）—— hard sample → spawn 下一轮 mining task，parent_trace 串通

下一步：

1. **跑一次完整 e2e（11 步含闭环）**：`make e2e-demo SCENARIO=night-vru SEED=42`，对照刚才学的 7 步看代码，并在 banner 里看 Step 10/11 的训练反馈与闭环回流
2. **进入产品视角**：[产品使用说明](../prd/user-guide.md) 按角色看怎么用平台
3. **进入架构视角**：[架构总览](../architecture/overview.md) → 从这里往下挖每个分层
4. **想深入某模块**——按数据闭环主旅程 6 步追：
   ① [Requirement](../prd/module-requirement.md) 提需求 → ② [Explorer](../prd/module-explorer.md) 找候选 → ③ [Operations](../prd/module-operations.md) 人机协同加工 → ④ [Pipelines](../prd/module-pipelines.md) 机器执行观测 → ⑤ [Catalog](../prd/module-catalog.md) 构建数据集 → ⑥ [Exports](../prd/module-exports.md) 出仓 + 训练反馈
   主旅程之外：[Overview](../prd/module-overview.md)（综合首页入口）/ [Tools](../prd/module-tools.md)（跨切面工具门户）

---

## 6. 调试与 FAQ

**Q：为什么文件名带 `s01` 而不是 `01_`？**
A：`01_xxx` 不是合法 Python 标识符，无法用 `python -m` 调用。`s01_xxx` 是合法的。

**Q：跑 04 报 `no such table: requirements`？**
A：忘了 `make db-upgrade`，先升级到最新 alembic head。

**Q：跑 01 / 03 / 05 / 07 报「`{lance_root}` 下没有 clip」？**
A：先把 clip 数据放到 `data/lance/c-<uuid>/`。

**Q：跑过一次想清理重跑？**
A：04/05/06/07 都支持 `--reset`，按 `[ONB-XX]` / `ds_onb_` / `trace_onb_` 前缀清理本 demo 自己的数据，不影响其它对象。

**Q：和 `e2e_demo.py` 的关系？**
A：onboarding 是「拆开教学」（每 demo 聚焦 1-2 个分层 / 对象）；
    e2e_demo 是「一次串起来」（9 步全跑完产出 official dataset）。
    学完 onboarding 应该能完全看懂 e2e_demo 的代码。

---

## 7. 参考

- 脚本源码：[`apps/api/src/scripts/onboarding/`](../../apps/api/src/scripts/onboarding/)
- 脚本 README：[`apps/api/src/scripts/onboarding/README.md`](../../apps/api/src/scripts/onboarding/README.md)
- E2E 主驱动：[`apps/api/src/scripts/e2e_demo.py`](../../apps/api/src/scripts/e2e_demo.py)
- 系统分层文档：[`docs/architecture/system-layers.md`](../architecture/system-layers.md)
