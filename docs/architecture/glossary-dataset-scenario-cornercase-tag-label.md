# 术语澄清：E2E 全部域对象一览

> 本文是项目所有领域名词的"标准定义索引"。读完本文，你能在任意一个 Web 页面、任意一个 API 响应、任意一行 e2e demo 输出里说出每个名词的精确含义。
>
> 全文按 E2E demo 的 9 步流程组织：先讲 5 个最容易混的核心名词（Dataset / Scenario / Cornercase / Tag / Label），再扩展讲清楚 E2E 涉及的其它 ≈ 15 个域对象。
>
> 配套阅读：[领域模型与语义](./domain-model.md)（ER 图 + 字段表 + 关系矩阵）、[E2E Demo 教程](../tutorials/e2e-demo.md)。

---

## 0. 一图看懂

```
       Requirement（业务承诺：「提升夜间路口 VRU 召回率」）
              │
              ▼
       Scenario（场景：「夜间 + 十字路口 + VRU」—— 业务/物理世界分类）
              │  scene_tags = ["nighttime", "intersection", "vru"]
              ▼
       ┌──────────────────── Clip（一段时序采集，即 data/lance/c-<uuid>/）─────────────────────┐
       │                                                                                       │
       │   meta.scenario = "night_intersection_vru"   ← Scenario 落到 clip 的字段              │
       │                                                                                       │
       │   meta.tags     = "rain,intersection,vru,cutin_v1_12"   ← Tag = 系统/规则/模型产出      │
       │                                                                                       │
       │   meta.da_tags  = "Good_behavior_v1"                    ← Label = 人工标注（annotation）│
       │                                                                                       │
       │   payload.cornercase = {                                ← Cornercase = 这段 clip 暴露了│
       │     "kind": "disengagement",                              模型/系统能力边界——是状态 + │
       │     "trigger": "shadow_model_disagreement",               来源，不是独立实体。它驱动整 │
       │     "severity": 0.87,                                     个数据闭环不断重训。          │
       │     "tag": "hard_case_night_vru_v1"                                                      │
       │   }                                                                                      │
       └───────────────────────────────────────────────────────────────────────────────────────┘
              │
              ▼
       Dataset（训练消费单位）
       ├─ customized: ds_night_vru_..._customized   (allow_train=false, 工作集)
       └─ official  : ds_night_vru_..._official     (allow_train=true,  发版集，由 Operations·Release 提级)
              │
              ▼
       DatasetSample (clip_id, ts, range_l, range_r, training_type)
```

---

## 1. 五个概念逐个解释

### 1.1 Dataset（数据集）

| 项 | 内容 |
|---|---|
| **是什么** | 一组「**可被算法工程师直接消费**」的训练/评估样本的集合 |
| **物理位置** | `datasets_v2`（主表） + `dataset_samples_v2`（事实表）；导出后是 `data/exports/<id>-v<n>.jsonl` 之类的 artifact |
| **类型** | 仅两种：`customized`（工作集，allow_train=false） + `official`（发版集，allow_train 可 true） |
| **谁产出** | Explorer 的灵活切割 / Mining / Migration 工作流 → customized；Operations · Release 的 Promote 动作 → official |
| **谁消费** | 算法工程师（训练 loader）；Catalog UI；e2e demo 的最终交付 |
| **粒度** | Dataset 是容器；真正的样本粒度在 **DatasetSample**：`(clip_id, ts, range_l, range_r, training_type)` 四元组 |
| **标识** | UUID，名字风格 `ds_<scenario>_<short_trace>_official` |

**关键认知**：Dataset 不是 Clip 集合，是 **样本（带时间窗口的 clip 切片）** 集合。一个 clip 可以在多个 dataset 里以不同 ts/range 存在。

---

### 1.2 Scenario（场景）

| 项 | 内容 |
|---|---|
| **是什么** | **物理世界 / 业务领域的分类标签**——"夜间路口 VRU"、"高速 cutin"、"城市无保护左转"等 |
| **物理位置** | `ClipMeta.scenario`（字符串字段，落在 `meta.lance` 里）；Catalog 的 "By scenario" 视图按它聚合 |
| **谁产出** | 通常在采集 / 切片阶段由规则或模型打上；也可由 PM 在 scenario yaml（`apps/api/src/scripts/scenarios/*.yaml`）声明 |
| **谁消费** | Mining 用 `scene_tags` 过滤候选；Catalog "By scenario" tab；Requirement.target_scene 字段串通业务 |
| **粒度** | 一个 clip 通常**只挂一个 scenario**（main category） |
| **特点** | 高层、稳定、半结构化—**业务直觉强**，非技术人员也理解 |

**关键认知**：Scenario 是 **业务领域语言**（domain），是 Requirement 与数据的桥梁；Tag 是**技术语言**（实现），描述 clip 的一组细粒度属性。

---

### 1.3 Cornercase（长尾场景 / 边界样本）

> 行业里 cornercase（也叫 corner case / edge case / long tail）**不是**简单的"难"或"质量差"，而是**特指三类样本的并集**——它是 AI 数据闭环的引擎油门。

| 项 | 内容 |
|---|---|
| **是什么** | 满足以下**任一条件**的 clip / 时间窗口：<br>① **罕见但安全关键**（rare-yet-safety-critical）：鬼探头、施工临时改道、异形车（混凝土搅拌车 / 突出钢筋的皮卡）、紧急车辆逆行、雨夜信号灯漫反射……<br>② **模型当前的失败模式**（failure / disagreement）：影子模式（shadow mode）下模型预测与真值不一致；预测置信度低但实际有目标；OOD 输入；触发自动驾驶降级 / 接管（disengagement）<br>③ **长尾组合**（long-tail combinations）：维度叠加产生的稀有交集，如「夜间 + 大雨 + 施工 + VRU」 |
| **行业类比** | Waymo "long tail of rare events"、Tesla "shadow mode" 触发样本、Mobileye "edge case library"、ML 通用 "OOD / active learning sample" |
| **不是什么** | ❌ 不是"标错的样本"（那是 labeling QC 问题）<br>❌ 不是"质量差的 clip"（曝光糟、传感器掉线 → 走 Checking 拒收）<br>❌ 不是模型已经学好的难样本（hard sample 而非 cornercase） |
| **物理位置** | 多载体：<br>• tag 形式：`hard_case_v1` / `disengagement_2026q2` / `ood_construction_v3` 落 `ClipMeta.tags` 与 `EventResult.tags`<br>• Mining 工作流产出：`OpsItem(module=mining).payload.cornercase = {kind, trigger, severity, source_run_id}`<br>• 专项 dataset：`Dataset(dataset_type=customized, tag_expr="hard_case_v1 AND nighttime")` |
| **谁产出** | **Mining 模块** 是主入口，触发源包括：<br>① **Disengagement**：路测车人工接管事件回流<br>② **Shadow mode**：影子模型预测 vs 主模型 / 真值的 disagreement<br>③ **Active learning**：模型预测低置信度样本批量挑选<br>④ **Similarity / Retrieval**：用 known cornercase 当 query 在向量库找相似样本<br>⑤ **Scenario mining**：规则/LLM 在 tag 组合上挖稀有交集<br>⑥ **Simulation seed**：仿真器生成的极端场景 |
| **谁消费** | • **重训数据（专项加权）**：训练时把 cornercase clip 上采样或 loss 加权<br>• **回归评估集**：每次模型迭代必跑的 hard set（防止 regression）<br>• **场景库（scenario library）**：长期沉淀，记录"这类 cornercase 在版本 vX 已被攻克 / 仍未解决" |
| **是不是实体表** | ❌ 项目里**不存在** `cornercases` 表。Cornercase 是 Mining 工作流的语义产出，落地依然是 **Tag + Mining 事件 + 可选 customized Dataset** 三件套 |
| **生命周期** | 短：随模型版本演进而**贬值**——v3 模型攻克了 v2 的 cornercase 后，那批 tag 自然降级为普通 hard sample。**所以 tag 名要带版本号**（`hard_case_v1` / `_v2`）以追踪演进 |

**关键认知**

- Cornercase 是 **数据闭环的"信号源"**：没有它，模型迭代就成了盲调。整个 Operations · Mining 模块的存在意义就是**持续发现新 cornercase + 把已知 cornercase 沉淀成可复跑的回归集**。
- 不要把 cornercase 当作 clip 的固有属性，**它是 (clip × 模型版本 × 时间) 的三元关系**。同一段 clip 对 v1 模型是 cornercase，对 v3 模型可能不是。
- 在数据模型层，cornercase 通过 **带版本号的 tag** + **Mining LineageEvent** 表达，无需新实体；想要一个"专项 cornercase 数据集"时，开一个 customized Dataset，`tag_expr` 写成 `hard_case_v1 AND scenario:nighttime` 即可。

---

### 1.4 Tag（标签 / 系统标记）

| 项 | 内容 |
|---|---|
| **是什么** | **机器/规则/模型产出的描述性标记**——"这段 clip 有什么属性" |
| **物理位置** | `ClipMeta.tags`（CSV 字符串字段）、`EventResult.tags`、`Dataset.tag_expr` |
| **谁产出** | Tagging 模块（rule/model）、Migration（migration_cutin_10-11）、Mining（候选 tag）、流水线规则 |
| **谁消费** | Mining 过滤（`any_tags`）、Dataset.tag_expr 组合表达式（`migration_v1 AND cutin`）、Catalog 浏览、Snowflake event result 维度 |
| **粒度** | 一个 clip 可有多个 tag（CSV / list）；同一 event 可产出多 tag |
| **特点** | **Tag 是 result，不是 entity**——这是 Snowflake 设计的核心结论。同一 tag 名可来自多个 event，不可拥有单独的"tag 实体表" |
| **典型例子** | `nighttime`、`intersection`、`vru`、`cutin_v1_12`、`migration_cutin_10-11`、`hard_case_v1` |

**关键认知**：Tag 是细粒度、可组合、可累积的属性集合；可以通过逻辑表达式组装出 Dataset（"tag_expr"）。

---

### 1.5 Label（标注 / 人工真值）

| 项 | 内容 |
|---|---|
| **是什么** | **人工标注的真值（ground truth）**——bbox 2D/3D、polygon、semantic seg、tracking、属性（行为、车型等） |
| **物理位置** | `AnnotationTask`（任务表）、`OpsItem(module=labeling)`（执行项）、`ClipMeta.da_tags`（da = data annotation）、`EventResult.da_tags` |
| **谁产出** | **Labeling 模块**（人工标注 / auto-label / hybrid）+ Checking 模块（QC） |
| **谁消费** | 训练时作为 supervised target（y）；评估指标计算（IoU、precision、recall）；模型回归对比 |
| **粒度** | 通常对应 clip + frame + object；也可是 clip-level 行为标注 |
| **特点** | **Label 是训练目标本身**，与 Tag 的「描述性属性」根本不同 |
| **典型例子** | `Good_behavior_v1`、`HardBraking_v2`、bbox `[x1,y1,x2,y2,class=pedestrian]` |

**关键认知**：Label 必须经过 **sign-off / Checking** 才能进入 official dataset；Tag 不需要（系统产出可信度由模型版本/规则版本兜底）。

---

## 2. 五者对比表

| 维度 | Dataset | Scenario | Cornercase | Tag | Label |
|---|---|---|---|---|---|
| **本质** | 样本容器 | 业务分类 | 长尾 / 失败模式 / 安全关键样本 | 系统属性标记 | 人工真值 |
| **谁打** | Operations · Release | 采集/PM | Mining（disengagement / shadow / active learning / similarity） | Tagging / Migration | Labeling 人工 |
| **是不是实体表** | ✅ `datasets_v2` | ❌ ClipMeta 字段 | ❌ Tag + Mining event + 可选 customized Dataset | ❌ ClipMeta 字段 + EventResult | ❌ AnnotationTask + OpsItem + EventResult.da_tags |
| **是 result 还是 entity** | entity（带 ID） | entity（business） | result of mining 工作流 | **result of event** | **result of human work** |
| **训练里角色** | 容器 / 配方 | 切片维度 | **重训信号源** + 回归评估集 | 过滤 / 表达式 | y（target） |
| **可不可组合** | 通过 promote 链组合 | 通常单选 | tag 表达；可单独成 customized dataset | 逻辑表达式（AND/OR） | 同 clip 可多 label |
| **典型字段** | `dataset_type`, `tag_expr` | `meta.scenario` | `hard_case_v*` / `disengagement_*` tag、`payload.cornercase = {kind, trigger, severity}` | `meta.tags` (CSV) | `meta.da_tags`, bbox 列 |
| **生命周期** | active / frozen / deprecated | 长期稳定 | **跟模型版本同步演进**（v1 cornercase 被 v3 攻克即贬值） | 跟 tagger 版本 | 跟标注供应商 |
| **谁消费** | 算法工程师 | Mining + Catalog | 训练上采样 / 加权 + 回归集 + 场景库 | Mining + Dataset 表达 | 训练 + 评估 |

---

## 3. 常见混淆与澄清

### 3.1 "Tag 和 Label 不是一回事？"

**不是**。区别核心是**谁产出 + 用途**：

| | Tag | Label |
|---|---|---|
| 产出方 | 系统 / 规则 / 模型 | **人** + 校对 |
| 形态 | 字符串属性（"vru","nighttime"） | 结构化标注（bbox 坐标、类别、轨迹） |
| 训练角色 | 选样、过滤 | 监督信号 |
| 可信度 | 取决于产出器版本 | 经 Checking sign-off |

> 项目里 `tags` 字段（CSV）落 Tag；`da_tags`（**d**ata **a**nnotation tags）落 clip-level 的人工标注摘要；具体的 bbox/polygon 坐标走 AnnotationTask + Lance 列。

### 3.2 "Scenario 和 Tag 怎么没分开？"

Scenario **是** Tag 的一个特例，但被单独提出来是因为：
- Scenario 只挂 **一个**（main category），便于 Catalog 聚合分桶；
- Tag 可以挂 **多个**，是细粒度属性；
- Scenario 字段独立（`meta.scenario`）方便快速检索，避免在 CSV `tags` 里 like 匹配。

> 经验法则：**业务方说得出来的"场景"** 就是 Scenario；**只有标注 / 算法人员理解的属性**就是 Tag。

### 3.3 "Cornercase 为什么不是独立类型？"

业内有 "Edge Case Library / Scenario Library / Hard Case DB" 这类称呼，听起来像独立实体。但实质上它们是 **Mining 工作流的产出语义** + **带版本的 Tag 沉淀**，没必要新建实体表。理由：

- **Cornercase 是 (clip × 模型版本 × 时间) 三元关系**，不是 clip 的固有属性。同一段 clip 对 v1 模型是 cornercase，对 v3 可能不是。硬建表会把"是否困难"凝固，与模型迭代节奏冲突。
- **来源多样**（disengagement / shadow / active learning / similarity / scenario mining / simulation），用一张表统一存反而需要无数 nullable 字段。改用 Mining LineageEvent + payload 描述来源更自然。
- **消费方式只有两类**：① 当 tag_expr 条件去开 customized Dataset；② 当回归评估集长期持有——两者都已被现有 Tag + Dataset 覆盖。
- **跨公司经验**：Waymo / Tesla / Mobileye 公开材料里 "long tail" / "edge case" 的工程实现也都是「scenario library = tag 集合 + 关联 dataset」，没有人把它做成单独实体。

→ 项目最终收敛为：**Tag + Mining LineageEvent + 可选 customized Dataset** 三件套。Mining 产出新 cornercase 时，写一条 `LineageEvent(event_type=mining, source_type=disengagement|shadow|active_learning|...)` + `EventResult(payload_type=mining_candidate, tags="hard_case_night_vru_v1")`，需要专项数据集时再 Promote。

### 3.4 "Dataset 和 Scenario 不能合？"

不能。Dataset 是**训练消费单位**（带 sample 列、版本、可训练 flag、提级路径）；Scenario 是**业务分类**（一个 clip 一个，长期稳定）。一个 Scenario 可生成多个 Dataset（不同时间切片、不同 tag 表达、不同 v1/v2）。

### 3.5 "EventResult.tags 和 ClipMeta.tags 重了？"

**没重，是不同时间维度**：

- `ClipMeta.tags`：clip 当前**累积态**（最新 tagging 结果汇总）；CSV 字段直接读。
- `EventResult.tags`：每次 tagging / migration **事件产出**；多个 event 的 tags 加起来才是 clip 的当前态。

类比：ClipMeta.tags 是 Git 工作区文件；EventResult 是 Git commit 历史。

---

## 4. 端到端例子：从 Requirement 到 Dataset

> 业务诉求：「夜间路口 VRU 召回率从 88% 提到 95%」

| 阶段 | 产出 | 名词体现 |
|---|---|---|
| 1. Requirement | `Requirement(target_scene="夜间路口 VRU")`、`scene_tags=["nighttime","intersection","vru"]` | **Scenario**（target_scene） + 期望的 **Tag** 集合 |
| 2. DataTasks | 4 条业务里程碑：collection / annotation / quality_check / pipeline | — |
| 3. Mining | 从 `data/lance/` 找 `meta.scenario = night_intersection_vru` 且 `tags ⊇ {nighttime,intersection,vru}` 的 25 个 clip；其中 12 条来自路测 disengagement 回流，8 条由影子模型预测 disagreement 触发，5 条 active-learning 低置信度——这 25 条都打上 `hard_case_night_vru_v1` tag，写 LineageEvent(event_type=mining, source_type=disengagement/shadow/active_learning) | **Scenario** 过滤 + **Tag** 过滤 → 形成本轮 **Cornercase** 候选；不同 source_type 区分来源 |
| 4. Tagging | 模型/规则给候选 clip 打 `cutin_v1_12`、`pedestrian_present` 等 tag；写 LineageEvent(event_type=tagging) | **Tag** 落地（EventResult.tags） |
| 5. Labeling | 人工标注 25 个 clip 的 bbox + 行为属性；写 LineageEvent(event_type=labeling, payload_type=label)；产出 `da_tags="Good_behavior_v1"` | **Label** 落地（da_tags + AnnotationTask） |
| 6. Checking | 对 labeling 结果 QC，passed 20 / waived 3 / failed 2 | — |
| 7. Build customized | 把 23 个通过 checking 的 clip 收成 `ds_night_vru_xxx_customized`，每个 clip 一条 DatasetSample（ts 来自 Lance start/end 中点） | **Dataset (customized)** 诞生，sample 引用 **clip + ts** |
| 8. Release Promote | release OpsItem(approved) → `promote_to_official` → 复制 sample 到 `ds_night_vru_xxx_official`（allow_train=true） | **Dataset (official)** 交付物 |
| 9. Export | dataset 的 sample 列表写到 `data/exports/<id>-v1.jsonl`；登记 Asset(asset_kind=derived, producer_event_id=release_event) | 算法工程师消费入口 |

---

## 5. 落表对照（给开发参考）

| 概念 | DB 表 / 字段 | 文件 |
|---|---|---|
| Dataset | `datasets_v2` (id, name, dataset_type, tag_expr, slice_strategy, allow_train, ...) | `apps/api/src/models/dataset.py::Dataset` |
| DatasetSample | `dataset_samples_v2` (dataset_id, clip_id, ts, range_l, range_r, training_type) | `apps/api/src/models/dataset.py::DatasetSample` |
| Scenario | `ClipMeta.scenario` (string) + `apps/api/src/scripts/scenarios/*.yaml` | `python/core/src/core/domain/models.py::ClipMeta` |
| Tag | `ClipMeta.tags` (CSV) + `EventResult.tags` | `apps/api/src/models/lineage_event.py::EventResult` |
| Label (clip-level) | `ClipMeta.da_tags` (CSV) + `EventResult.da_tags` + `AnnotationTask` | `apps/api/src/models/lineage_event.py`、`apps/api/src/models/requirement.py::AnnotationTask` |
| Label (geometry) | Lance 列（bbox / polygon / track）+ AnnotationTask.annotation_type | `data/lance/c-<uuid>/<TopicName>.lance` |
| Cornercase | 带版本号 Tag（`hard_case_v*` / `disengagement_*` / `ood_*`）+ `LineageEvent(event_type=mining, source_type=...)` + `OpsItem(module=mining).payload.cornercase = {kind, trigger, severity}` + 可选 `Dataset(tag_expr="hard_case_v1 AND ...")` | `apps/api/src/models/lineage_event.py`、`apps/api/src/models/ops_item.py` |

---

## 6. 一句话总结（5 个核心名词）

- **Dataset** 是装样本的桶。
- **Scenario** 是业务的分类。
- **Cornercase** 是模型的"短板地图"——罕见 + 安全关键 + 失败模式的并集，驱动数据闭环不断重训。
- **Tag** 是机器打的属性。
- **Label** 是人画的真值。

---

## 7. E2E 全部域对象一览（按 9 步流程组织）

> 围绕 [E2E Demo 教程](../tutorials/e2e-demo.md) 的 9 步，把所有出现的域对象一次说清楚。每个对象给出**一句话定义 / 物理表 / 关键字段 / 在 E2E 里何时出现 / 与其它对象的关系**。

### 7.1 业务承诺层（Step 1-2）

#### Requirement（需求）

| 项 | 内容 |
|---|---|
| 一句话 | 业务对数据交付的**承诺**——"夜间 VRU 召回率 88% → 95%"，挂 dre_owner / 飞书文档 / due_date |
| 物理表 | `requirements` |
| 关键字段 | `id` (UUID) · `title` · `priority(high/medium/low)` · `source(dre/product/algorithm/test)` · `status(draft → in_progress → completed)` · `dre_owner` · `target_scene`（关联 Scenario）· `scene_tags`（期望 tag 集合）· `vehicle_tags` · `estimated_data_volume` · `due_date` · `feishu_doc_id` |
| E2E 出现 | Step 1：1 行 |
| 关系 | 1 ↔ N `DataTask`；M ↔ N（弱关联）`OperationsTask` / `PipelineRun` / `Asset` / `Dataset`（通过 requirement_id 冗余字段） |

#### DataTask（数据任务）

| 项 | 内容 |
|---|---|
| 一句话 | Requirement 拆解出的**业务里程碑**，固定 4 类，每条独立 sign-off |
| 物理表 | `data_tasks` |
| 关键字段 | `id` · `requirement_id`(FK) · `task_type ∈ {collection, annotation, quality_check, pipeline}` · `status` · `sign_off_status(pending/approved/rejected)` · `sign_off_by/at/comment` · `target_count` · `actual_count` · `assigned_to` · `due_date` · `x_trace_id` |
| E2E 出现 | Step 2：4 行（4 类 task_type 各 1 条） |
| 关系 | N ↔ 1 `Requirement`；1 ↔ N `OperationsTask` / `PipelineRun` / `CollectionJob` / `AnnotationTask` / `DigitalReconstruction` |

> 注：`task_type` 是固定枚举（4 类），与 `OperationsTask.module`（5 类 ops 子域）属于不同维度——前者是业务里程碑，后者是运营协调单元。

### 7.2 协调与执行层（Step 3-6）

#### OperationsTask（OpsTask · 运营任务）

| 项 | 内容 |
|---|---|
| 一句话 | 一次**人机协同的执行协调**单元——"为某次 mining 派一组人去找 25 条候选" |
| 物理表 | `operations_tasks` |
| 关键字段 | `id` · `requirement_id`(FK) · `data_task_id`(FK) · `module ∈ {labeling, tagging, checking, mining, privacy, release}` · `title` · `status(draft → scheduled → running → completed/failed/cancelled)` · `assigned_to` · `started_at` · `completed_at` · `payload(JSON)` · `x_trace_id` |
| E2E 出现 | Step 3 (mining) · Step 5 (labeling/tagging/checking) · Step 8 (release) |
| 关系 | N ↔ 1 `DataTask`；1 ↔ N `OpsItem` / `PipelineRun` |

#### OpsItem（运营子项）

| 项 | 内容 |
|---|---|
| 一句话 | OpsTask 内部的**具体执行项**——一行对应一个候选 clip / 一次标注 / 一次质检 |
| 物理表 | `ops_items` |
| 关键字段 | `id` · `operations_task_id`(FK) · `module(=同 OpsTask)` · `title` · `status`（开放词表）· `kind`（如 human/auto/hybrid/qc_auto/...）· `owner` · `clip_ids[]` · `dataset_id`（弱引）· `scenario` · `payload(JSON)` · `x_trace_id` · `requirement_id` / `data_task_id`（冗余便于过滤） |
| E2E 出现 | Step 5：每模块 N 条；Step 8：1 条 release item |
| 关系 | N ↔ 1 `OpsTask`；M ↔ N `Clip`（通过 clip_ids 数组） |

> Release 模块的 OpsItem 状态机：`drafted → gated → approved → published`；`approved` 才能 Promote。

#### PipelineRun（流水线运行）

| 项 | 内容 |
|---|---|
| 一句话 | **机器执行**的最小事实记录——任意一段批 / 流计算的开始-结束-指标快照 |
| 物理表 | `pipeline_runs` |
| 关键字段 | `id` · `data_task_id`(FK) · `requirement_id` · `operations_task_id` · `pipeline_name` · `stage`（自由文本 step 名）· `input_uri` / `output_uri` · `status(pending/running/success/failed)` · `trigger_source` · `run_purpose` · `config(JSON)` · `metrics(JSON)` · `started_at` / `completed_at` · `x_trace_id` · `trace_parent_id` |
| E2E 出现 | Step 4：4 条（collect / clip-extract / feature-compute / release）；Step 4b：1 条 streaming-replay（可选） |
| 关系 | N ↔ 1 `DataTask`；N ↔ 1 `OperationsTask`（可空）；1 ↔ N `Asset`（producer_pipeline_run_id）；1 ↔ N `LineageEvent`（pipeline_run_id） |

##### `trigger_source`（触发来源枚举）

`data_task` · `operations_task` · `scheduler` · `manual` · `external`

##### `run_purpose`（运行目的枚举）

`initial_build` · `backfill` · `repair` · `reindex` · `replay` · `validation`

### 7.3 数据资产层（Step 7-9）

#### Clip（采集片段）

| 项 | 内容 |
|---|---|
| 一句话 | 项目的**最小物理数据单元**——`data/lance/c-<uuid>/` 一个目录 = 一段时序采集 |
| 物理位置 | Lance 目录：`meta.lance`（单行元数据）+ `topic.lance`（关键帧 + 多 topic struct）+ `<TopicName>.lance`（独立 topic）+ 可选 `wm.lance`（水位线） |
| 索引 | `clip_catalog.sqlite`（SQLite 单表，按 mtime 增量刷新） |
| ClipMeta 关键字段 | `clip_id` · `vehicle_name/model/info` · `city/district` · `scenario` · `tags`(CSV) · `da_tags`(CSV) · `start_time`/`end_time`(ns) · `calibration_version/info` · `mp4_path` / `mp4_resize_path` · `jira_id` |
| E2E 出现 | Step 3 mining 候选；Step 7 写入 customized dataset 时取 start/end 算 ts |
| 关系 | M ↔ N `DatasetSample`（dataset_id × ts × range_l/r）；M ↔ N `OpsItem.clip_ids` |

#### Dataset（数据集）+ DatasetSample（样本）

详见 §1.1（Dataset） 与本节 §7.5 物理字段表。

E2E 出现：Step 7（customized）→ Step 8（official）。

#### Asset（数据资产）

| 项 | 内容 |
|---|---|
| 一句话 | **非 dataset 的数据资产**统一登记表——raw 采集落盘文件 / derived 派生产物（特征 / 报告 / 导出 artifact） |
| 物理表 | `assets` |
| 关键字段 | `id` · `name` · `asset_kind ∈ {raw, derived}` · `uri` · `format(parquet/lance/mp4/jsonl/...)` · `clip_id` · `producer_pipeline_run_id`(FK) · `producer_event_id`(FK) · `requirement_id` · `x_trace_id` · `byte_size` · `row_count` · `payload(JSON)` |
| E2E 出现 | Step 4 pipeline run 产出 derived asset；Step 9 export artifact 登记一条 `asset_kind=derived, payload.delivered_to="algorithm_engineer"` |
| 关系 | N ↔ 1 `PipelineRun`（producer_pipeline_run_id）或 1 `LineageEvent`（producer_event_id）；M ↔ 1 `Clip`（可选） |

> Asset 取代了旧 ingest/curate/publish 三段命名。所有"非 dataset 的数据"都是 Asset。

### 7.4 血缘观测层（横切 9 步）

#### LineageEvent（血缘事件 · Snowflake 中心）

| 项 | 内容 |
|---|---|
| 一句话 | **每次操作的事实快照**——一次 mining / 标注 / 质检 / migration / flexible_cut / release = 一条 event |
| 物理表 | `lineage_events` |
| 关键字段 | `id`(UUID PK) · `event_id`（业务 ID 如 `evt_20260429_xxxxx`）· `event_type ∈ {tagging, labeling, checking, mining, migration, flexible_cut, release, generation, trigger}` · `job_id` · `requirement_id` · `operations_task_id`(FK) · `pipeline_run_id`(FK) · `source_type`（disengagement / shadow / active_learning / manual_ui / kafka_stream / ops_release_promote / ...）· `pipeline_commit` · `pipeline_repo` · `branch_name` · `snapshot_id` · `table_name` · `payload(JSON)` · `x_trace_id` |
| E2E 出现 | 几乎每步都写：Step 5 写 labeling/tagging/checking 各 N 条；Step 8 写 1 条 release event；Explorer Save Cut 写 flexible_cut event |
| 关系 | 1 ↔ N `EventResult`；N ↔ 1 `OperationsTask` / `PipelineRun`（可空） |

#### EventResult（事件产物 · Snowflake 维度）

| 项 | 内容 |
|---|---|
| 一句话 | LineageEvent 产出的**逐 clip 结果行**——一次 event 通常产出 N 行 EventResult |
| 物理表 | `event_results` |
| 关键字段 | `id` · `event_pk`(FK→lineage_events) · `clip_id` · `payload_type ∈ {tag, label, check, mining_candidate}` · `tags`（产出 tag）· `da_tags`（人工标注） · `trigger_event_tags`(TriggerName) · `ts`（部分有部分无）· `extra(JSON)` · `note` |
| E2E 出现 | Step 5 / Step 8 内部，每条 EventResult 对应一个 clip |
| 维度视图 | 4 个 query view（不是物理表）：tagging / labeling / checking / mining，通过 `(event_type, payload_type)` 联合 filter |

#### DatasetSnapshotManifest（链路 receipt）

| 项 | 内容 |
|---|---|
| 一句话 | 一个 trace 的**端到端 receipt**——把 requirement → release pipeline_run → official dataset → export artifact 钉成一行 + 一个磁盘 JSON |
| 物理表 | `dataset_snapshot_manifests` |
| 关键字段 | `id` · `x_trace_id`（unique）· `requirement_id`(FK) · `data_task_id` · `operations_task_id` · `gold_pipeline_run_id`（即 release 终态 PipelineRun，字段名沿用历史）· `pipeline_run_count` · `dataset_id` · `dataset_version_id` · `export_job_id` · `export_artifact_uri` · `export_format` · `clip_ids[]` · `scenario` / `title` / `summary` · `manifest_json(JSON)` · `sealed_at` |
| E2E 出现 | Step 8 调 `snapshot_service.open_or_create` + `attach_dataset_version`；Step 9 调 `attach_export_artifact` 并落 `data/exports/e2e-snapshot-<trace>.json` |
| 关系 | 1 ↔ 1 `x_trace_id`；M ↔ 1 `Requirement` |

#### x_trace_id（全链路追踪键）

| 项 | 内容 |
|---|---|
| 一句话 | 一条 trace 的**唯一标识符**——格式 `trace_e2e_<seed:012x>`（demo）或 `trace_<uuid8>`（运行时生成） |
| 传播路径 | HTTP Header（`X-Trace-Id`）→ 日志 / Dagster 任务参数 / Kafka header → DB 列 |
| 写入对象 | DataTask / OperationsTask / PipelineRun / OpsItem / LineageEvent / Asset / DatasetSnapshotManifest 都有 `x_trace_id` 列 |
| E2E 出现 | Step 1 生成；从 Step 2 开始所有写入对象都带它；Step 9 banner 打印 |
| 中间件 | `apps/api/src/api/middleware/x_trace.py` 入站取 header / 出站回写；BFF 透传 |

### 7.5 训练消费层

#### DatasetSample（训练样本）

| 项 | 内容 |
|---|---|
| 一句话 | **训练 / 评估 loader 直接消费的最小行**——一行 = 一条样本 |
| 物理表 | `dataset_samples_v2` |
| 关键字段 | `id` · `dataset_id`(FK) · `clip_id` · `ts(BigInt, ns)` · `range_l` · `range_r` · `ts_origin ∈ {flexible, from_tag, computed_1to4, from_csv, random_window}` · `origin_ref`（tag_name / csv_row_id / event_id）· `extra_meta(JSON)` · `training_type ∈ {train, test, holdout}` |
| 唯一性 | `(dataset_id, clip_id, ts)` 联合唯一——重复切割幂等 |
| E2E 出现 | Step 7 写 customized；Step 8 复制到 official |

##### `slice_strategy` ↔ `ts_origin`（Dataset 与 Sample 的策略对应）

| dataset.slice_strategy | sample.ts_origin | 含义 |
|---|---|---|
| `one_to_four` | `computed_1to4` | clip 等分 4 段，每段中点为 ts |
| `flexible` | `flexible` | 用户在 Explorer 拖动选定 [start,end]，ts = (start+end)/2 |
| `random_sample` | `random_window` | 随机窗口 |
| `no_ts` | `from_tag` | 整片消费，ts 取自 tag 时间 |

### 7.6 多租户 / 配置层（贯穿）

#### Workspace（工作空间）

| 项 | 内容 |
|---|---|
| 一句话 | 多租户 / 多团队隔离的容器（个人版默认 1 个 `local-ad-workspace`） |
| 物理表 | metadata adapter 的 `workspaces`（catalog 库） |
| 用途 | 把 dataset / clip / catalog 项归属到一个 workspace；未来 SaaS 阶段做 ACL |

#### Profile（运行时配置）

| 项 | 内容 |
|---|---|
| 一句话 | 描述"这个进程用什么 adapter / 后端"的 YAML 配置——驱动 Personal / Team / SaaS 切换 |
| 文件 | `infra/profiles/local-dev.yaml` 等；通过 `python/profiles/src/profiles/resolver.py` 装配 |
| 决定 | `query.engine`（duckdb/datafusion）· `storage.driver`（local/s3/opendal）· `metadata.driver`（sqlite/postgres）· `compute.driver`（local/dagster）等 |

### 7.7 历史辅助对象（保留兼容）

| 对象 | 物理表 | 一句话 |
|---|---|---|
| `CollectionJob` | `collection_jobs` | DataTask(collection) 的子任务，记录车辆 / 路线 / 帧数（演示用） |
| `AnnotationTask` | `annotation_tasks` | DataTask(annotation) 的子任务，记录标注供应商 / TPI 分数（演示用） |
| `DigitalReconstruction` | `digital_reconstructions` | 物理还原层（camera/lidar/imu）的还原任务，**当前 demo 不写**，留作未来 |

---

## 8. E2E 9 步 ↔ 域对象映射

| Step | 写入对象 | 关键产出 |
|---|---|---|
| 1 Requirement | `Requirement` ×1 | 1 行需求 |
| 2 DataTasks | `DataTask` ×4 + `CollectionJob` ×1 + `AnnotationTask` ×1 | 4 业务里程碑 |
| 3 Mining | `OperationsTask(module=mining)` ×1 + `OpsItem` ×N | 候选 clip 集 |
| 4 Pipeline batch | `PipelineRun` ×4（按 step） | derived Asset 链 |
| 4b Streaming（可选） | `PipelineRun(stage=streaming-replay)` ×1 | streaming asset |
| 5 Labeling/Tagging/Checking | `OperationsTask` ×3 + `OpsItem` ×3N | label/tag/check 状态 |
| 6 Explorer | — | 仅打印验证命令 |
| 7 Build customized | `Dataset(dataset_type=customized)` ×1 + `DatasetSample` ×N | 工作集 |
| 8 Release Promote | `OpsItem(module=release, status=approved→published)` ×1 + `Dataset(dataset_type=official)` ×1 + `DatasetSample` 复制 + `LineageEvent(event_type=release)` ×1 + `EventResult` ×N | ★ official 数据集 |
| 9 Export | `Asset(asset_kind=derived)` ×1 + `DatasetSnapshotManifest` ×1（含 sealed_at + manifest_json）+ `data/exports/<id>-v1.jsonl` 文件 | 算法工程师消费入口 |

横切：每步写入对象都带同一个 `x_trace_id`；任意视图按 trace 反查得到完整链路。

---

## 9. 还有什么不在 glossary 里？

下面这些**不算业务名词**，归在其它文档：

- 「DuckDB / DataFusion / Lance / Parquet / OpenDAL / Iceberg」—— 引擎实现，见 [系统分层](./system-layers.md) 与 [技术选型](../adr/tech-selection-datafusion-opendal.md)
- 「Adapter / Profile / RuntimeContainer」—— 工程抽象，见 [Core / Adapters / Profiles / Workflows](./core-adapters-profiles-workflows.md)
- 「Bronze / Silver / Gold / ingest / curate / publish」—— 已**全部废弃**的命名，新代码不该出现；遗留视为占位 step 名
- 「Sample（图像 + JSON）」—— 演示固件中的旧概念，仅 `examples/datasets/custom-local` 残留

---

## 10. 与代码的对照速查

| 名词 | 代码入口 |
|---|---|
| Requirement / DataTask / OperationsTask / PipelineRun / CollectionJob / AnnotationTask / DigitalReconstruction | `apps/api/src/models/requirement.py` |
| OpsItem | `apps/api/src/models/ops_item.py` |
| Dataset / DatasetSample | `apps/api/src/models/dataset.py` |
| Asset / AssetKind | `apps/api/src/models/asset.py` |
| LineageEvent / EventResult | `apps/api/src/models/lineage_event.py` |
| DatasetSnapshotManifest | `apps/api/src/models/dataset_snapshot.py` |
| ClipMeta / ClipSummary / ScenarioSummary | `python/core/src/core/domain/models.py` |
| Workspace（catalog 库） | `python/adapters/src/adapters/metadata/sqlite/adapter.py` |
| Profile / RuntimeContainer | `python/core/src/core/profiles/runtime.py` + `python/profiles/src/profiles/resolver.py` |
| 公共枚举（PipelineStatus / TriggerSource / RunPurpose / OperationsModule / TaskType / TaskStatus / SignOffStatus / Priority / RequirementSource / RequirementStatus） | `apps/api/src/models/base.py` |
| E2E 主驱动 | `apps/api/src/scripts/e2e_demo.py` |
