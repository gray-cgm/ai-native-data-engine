# 领域模型草图

## 核心对象

平台围绕“数据资产”组织，而不是围绕目录结构或零散脚本组织。主数据单元是 **Clip**（`data/lance/c-<uuid>/` 目录），它天然承载多相机视频 + 多 Topic 信号 + 标定，取代了早期按图像粒度建模的 `Sample` 概念。

```text
Raw Data
-> RawRecord
-> Clip        (meta.lance + topic.lance + <topic>.lance*)
-> Scenario    (clip.meta.scenario 归并出的业务场景)
-> Dataset     (按 Scenario 聚合产生的虚拟数据集)
-> DatasetVersion
-> JobRun
-> ExportJob
-> LineageEvent
```

## 实体说明

### Raw Data
来自本地目录、传感器、日志，或未来对象存储的数据原始输入资产。
它们始终是事实来源。

### RawRecord
对原始输入 metadata 的统一归一化表达，使不同数据源布局都能用一致方式处理。

### Clip
平台内部最小的统一业务单元。一个 `c-<uuid>` 目录对应一次采集片段，内部包含：

- `meta.lance`：单行元数据（vehicle、city、district、scenario、tags、da_tags、jira_id、start_time/end_time、calibration_info、mp4_path / mp4_resize_path 等）。
- `topic.lance`：以 keyframe 为行，相机列与 topic 列以 struct 形式并列。
- `<TopicName>.lance`：粒度更细或频率更高的信号以兄弟目录形式独立存储。
- （可选）`wm.lance`：水位线表。

Clip 在领域上关心：

- clip ID（`c-<uuid>`）
- 车辆 / 城市 / 区域 / scenario
- tags / da_tags（CSV，后端在索引层拆分出标签条目）
- 关键帧数量、时长、起止时间
- 相机目录、topic 目录、siblings 数量
- 对应的原始 MP4 / 降采样 MP4 路径

历史的 `Sample`（图像 + JSON metadata）仅保留在 `examples/datasets/custom-local` 的演示固件中，由 `workflows.demo` 消费，不再是平台一等公民。

### Scenario
由 `clip.meta.scenario` 规整归并出的业务场景（例如 `xminer-pipeline-video`、`urban-night`、`intersection`）。空值归并为 `scenario:unassigned`。Scenario 提供：

- 稳定的 `scenario_id`（`scenario:<slug>`）
- clip_count / keyframe_count / duration_seconds 聚合
- tag / vehicle / city 分布直方图

### Dataset
被平台统一管理的一组逻辑 clip 集合。当前 MVP 将 Scenario 直接映射为虚拟 Dataset（`dataset_id = scenario:<slug>`），并在 Catalog 上呈现为稳定的入口对象。未来接入真正的 Dataset 注册中心后，grouping key 可以从 `scenario` 切换到注册 id，API 与 UI 的 Catalog→Clips→Clip 流程保持不变。

### DatasetVersion
某个 Dataset 的版本化快照。它存在的意义是让系统可以回答：

- 当前暴露给用户的是哪个数据版本？
- 训练使用的是哪一个版本？
- 这个版本背后对应的是哪张表 / 哪次物化结果？
- 哪些导出产物属于这个版本？

### JobRun
一次执行实例的记录，例如：

- ingestion run（clip 注册 + 索引构建）
- materialization run
- indexing run
- export run

### ExportJob
用户可见的导出请求及其结果。
当前支持的格式包括：

- Lance
- Parquet
- CSV
- JSONL

### LineageEvent
连接运行、版本和数据产物的最小血缘记录。
即使在本地 MVP 中，这也是非常重要的对象，因为它能从一开始就建立正确的数据系统习惯。

## 访问模型映射

领域模型与访问模式刻意分离：

- **metadata plane**：datasets、versions、workspaces、tasks、runs、exports、lineage。
- **catalog plane**（新增）：clip catalog 索引（`adapters.catalog.ClipCatalogIndex`，SQLite 落盘于 `data/metadata/clip_catalog.sqlite`）。承担 clip 列表 / 点查 / 批查 / scenario 聚合，底层以 per-clip mtime 触发懒增量刷新，避免每次请求重扫所有 Lance 文件。
- **query plane**：distribution、过滤、分析、聚合。
- **table plane**：基于 Lance / Parquet 的 clip 物化表。
- **search plane**：clip 索引上的 preview 与 retrieval（标量+向量混合检索，向量后端可插拔）。
- **storage plane**：原始文件 / 对象访问。

## 为什么这个模型重要

这个模型让平台即使建立在文件之上，依然呈现出“类数据库”的使用体验。用户应该通过 clip / scenario / dataset 这类数据资产、API、SDK 来工作，而不是直接依赖底层 Lance 目录或存储凭证。

## Corner Case Manager 语义统一

这一节用于解决当前产品里最容易混淆的三个概念：`Requirement`、`Case`、`Mining`。

### 一句话边界

- `Requirement`：**为什么做**（业务需求与验收目标）
- `Case`：**做什么**（可复用的场景定义 / 挖掘模板）
- `MiningTask`：**怎么做与做到哪**（一次执行型运营任务）
- `Explorer`：**找与看**（交互式检索与验证）

### Requirement 与 Case 的关系（避免重复）

在自动驾驶里这两者看起来接近，但语义层级不同：

- Requirement 面向业务承诺：来源、优先级、截止时间、DRE owner、验收门槛。
- Case 面向数据定义：触发条件、场景标签、筛选表达式、排重策略、难例判定阈值。

因此原则是：

- Requirement 可以关联多个 Case（一个需求拆成多个典型场景）。
- 同一个 Case 也可复用于多个 Requirement（避免同类场景定义重复维护）。
- Requirement 不直接保存复杂筛选逻辑；复杂逻辑收敛在 Case 模板里。

建议关系：

```text
Requirement 1 --- n RequirementCaseLink n --- 1 CaseTemplate
CaseTemplate 1 --- n MiningTask
MiningTask n --- n Clip (candidate set)
```

### Explorer 与 Mining 的区别

#### Explorer（探索平面）

- 目标：人机交互式检索、校验、下钻、回溯。
- 粒度：以 clip 为主，强调即时查询。
- 产物：临时筛选结果、人工判断、可跳转上下文（requirement/dataset/scenario）。
- 生命周期：短，会话级。

#### Mining（运营平面）

- 目标：将“探索发现”沉淀为可跟踪、可复跑、可交接的任务对象。
- 粒度：以 task / candidate set 为主，强调状态流与责任人。
- 产物：`MiningTask` + candidate clip set + 后续 tagging/checking/release 衔接。
- 生命周期：长，跨天跨人协作。

核心判断：

- 需要“看数据” -> Explorer
- 需要“持续生产并运营候选集” -> Mining

## 联动设计（当前工作台）

### 入口联动

- Requirement List / Detail -> Explorer Search（已存在）
- Requirement List / Detail -> Mining（新增）
- Explorer Search -> Mining（新增）

这些跳转会携带上下文：`requirement` / `scenario` / `dataset` / `q`。

### Mining 接收上下文规则

- 若 URL 有 `requirement=<id>`，Mining 列表默认按该 requirement 过滤。
- 若 URL 有 `scenario`/`dataset`，Mining 列表附加对应范围过滤。
- 新建 MiningTask 时自动预填 `requirement_id`、`scenario`、`dataset_id`、`title`。

### 推荐闭环

```text
Requirement
-> Explorer (find candidate clips)
-> MiningTask (persist candidate set + owner + status)
-> Tagging / Checking
-> Release
-> 回写 Requirement task progress
```

## 状态责任划分

- Requirement status：业务状态（draft / in_progress / completed / blocked）
- Mining status：数据运营状态（queued / running / candidates_ready / failed / cancelled）
- Checking status：数据质量与 gating 状态（running / passed / failed / waived）

不要把这三种状态混成一个字段；它们是三个独立视角。

## API 与数据模型建议（下一步）

为彻底消除概念重叠，后续建议补两类对象：

1. `CaseTemplate`
	- `id`, `name`, `description`, `scene_tags`, `query_template`, `dedup_policy`, `quality_gate_policy`
2. `RequirementCaseLink`
	- `requirement_id`, `case_id`, `priority`, `target_count`, `acceptance_rule`

这样 Requirement 管业务承诺，Case 管数据定义，MiningTask 管执行过程，职责清晰且可复用。
