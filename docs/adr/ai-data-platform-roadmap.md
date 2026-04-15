# AI 数据中台演进路线 ADR

## 状态

Proposed

## 背景

当前 `ai-data-loop-engine` 已经完成了本地 MVP 的核心架构骨架：

- 访问分层：Web -> BFF -> Platform API
- Python 分层：`core / adapters / profiles / workflows`
- local-first 数据底座：local fs 存储 + Lance 主文件格式 + DuckDB 查询 + SQLite metadata
- 统一系统分层：存储层 / 湖表格式层 / 文件格式层 / 计算层 / 查询层 / 应用层
- profile 驱动的个人版 -> 企业版 -> SaaS 版演进方向

这条主线是正确的，但它当前更准确的定位仍然是：

- **AI 数据中台的架构骨架 + 本地 MVP**

而不是：

- **完整的 AI 数据中台**

造成这个差距的主要原因不是“技术栈不够多”，而是平台还缺少以下几类关键能力：

1. AI 闭环专属领域模型
2. 平台级任务运营与异步调度系统
3. 版本一致性、治理与审计系统
4. 面向分析、运营和算法角色的数据消费层
5. 面向模型训练/评测/反馈的闭环连接层

因此需要一份明确的演进路线 ADR，说明接下来应该如何补齐这些能力，同时不破坏当前已建立的分层边界。

## 决策

项目后续将采用以下演进策略：

### 1. 保持现有主干架构不推翻

保留以下稳定边界不变：

- `apps/web`：工作台 UI
- `apps/bff`：app-facing 聚合层、浏览器上下文、前端友好 ViewModel
- `apps/api`：Platform API / control plane 外部入口
- `python/core`：领域模型、接口契约、能力边界
- `python/adapters`：provider 实现
- `python/profiles`：profile 解析与 runtime container 装配
- `python/workflows`：流程编排

也就是说，后续演进采取 **“在现有骨架上补能力”**，而不是推翻重搭第二套系统。

---

### 2. 优先把“数据平台骨架”补成“AI 闭环平台”

第一优先级不是替换底层基础设施，而是补齐 AI 闭环语义。

#### 第一批必须新增的领域对象
- `Scenario`
- `Episode` / `Trip` / `DriveSegment`
- `MiningTask`
- `LabelTask`
- `ReviewTask`
- `EvaluationRun`
- `FeedbackEvent`
- `BadCaseSet`
- `ModelVersion`
- `TrainingSetBinding`

这些对象将成为后续任务流转、版本治理、模型反馈、任务运营与分析消费的统一基础语义。

---

### 3. 建立“版本一致性系统”而不只是 catalog 记录

当前 `DatasetVersion` 必须继续演进为真正的平台级版本对象，而不是停留在元数据条目层。

后续需要补齐：

- dataset snapshot manifest
- table snapshot binding
- search index version binding
- export artifact manifest
- lineage-backed provenance
- compare / publish / rollback 语义

这意味着平台未来必须能稳定回答：

- 某个 dataset version 包含哪些样本
- 某个 export 基于哪个版本生成
- 某个搜索索引对应哪个样本版本
- 某次训练或评测绑定的是哪个数据快照

---

### 4. 调度与长任务能力服务化，不塞入 core

后续将明确区分：

- `python/core`：定义任务/运行对象、状态模型、调度所需 contract
- `python/workflows`：当前阶段承接编排逻辑
- `python/services/scheduler`：未来沉淀长任务与调度应用服务
- `apps/scheduler`：独立 scheduler service 入口

不将以下职责塞入 `python/core`：

- service lifecycle
- polling loop
- callback endpoint
- queue worker
- concurrency control
- resource quota scheduling

该决策延续当前 FDL 融合文档中的边界原则，但从“预留目录”推进到“明确的实施方向”。

---

### 5. 把任务系统从 demo 记录提升为中台层

后续 `Task` 不再只是一个松散的 metadata 记录，而要演进为明确的任务运营模型，至少覆盖：

- mining task
- labeling task
- review / QA task
- rework / relabel task
- assignment / queue / SLA
- task state machine
- result payload schema
- 人工反馈回流
- dataset promotion gate

这将使平台具备“推动闭环流转”的能力，而不仅仅是“展示已有数据”。

---

### 6. 增加中台消费层，而不只保留控制台层

平台后续不仅要服务开发者，还要服务：

- 算法工程师
- 数据工程师
- 标注运营
- 数据分析 / 质量分析
- 产品或项目角色

因此后续应补齐：

- query service
- ad hoc query / saved query
- notebook-facing access layer
- analysis dashboard / slice-and-dice 视图
- 数据质量报告与运营报表

这部分能力优先通过 `apps/api` + `python/services/query` 暴露，不要求一开始就引入完整外部 BI 产品，但要先建立中台级消费接口。

从统一分层模型看，这一段实际上是在补齐**应用层**，让系统不再只有一个最小工作台，而是开始具备：

- BI / 分析消费面
- 挖掘检索与 badcase 运营入口
- 标注与 review 入口
- 需求管理与任务运营入口

---

### 7. 治理层要尽早抽象，而不是最后补

尽管完整的多租户、SSO、RBAC、治理工作流可以放到后期实现，但以下对象与边界应尽早定义：

- audit log
- approval record
- access policy
- export approval
- sensitive data tagging
- masking / watermark / redaction rule
- retention policy

理由是：AI 数据平台天然会承载图像、视频、位置、标签、日志等高敏感资产。如果等到底层 provider 都成型后再回补治理层，会造成领域边界漂移。

---

### 8. 企业化演进继续通过 adapter/profile 体系完成

未来从本地 MVP 演进到企业版时，以下替换仍通过现有 adapter/profile 体系完成：

- local fs -> S3 / MinIO / OSS / HDFS
- SQLite -> Postgres / 服务化元数据与事务控制层
- 裸 Parquet 文件集 -> Iceberg / Paimon / Hudi 管理的湖表层
- DuckDB -> StarRocks / Trino / distributed query
- local compute -> Spark / Flink / Fluss / distributed execution
- local auth stub -> OIDC / SSO / tenant-aware auth

这里要特别避免把不同层混写成一条“技术替换链”。更准确的理解是：

- 底层存储层决定文件放在哪
- 湖表格式决定表快照、schema 演进和事务语义怎样管理
- 文件格式决定数据如何编码；当前主格式是 Lance
- 计算层决定批流处理如何执行
- 查询层决定用户和服务如何读取数据
- 应用层决定最终有哪些产品和角色入口在消费这些能力
- 元数据与事务控制层决定版本、任务、血缘、权限、审计与其他控制状态如何被一致记录和管理

也就是说：

- **业务主干不重写**
- **provider 与部署拓扑替换通过 adapter/profile 完成**

---

### 9. 模型闭环集成作为后续高阶层，而不是现在直接混入底层

项目后续将增加与模型训练、评测、badcase 回流、simulation/synthetic data 的连接层，但不会在当前阶段把 MLOps 或 simulation 逻辑直接混入基础数据层。

推荐边界：

- `python/core/domain/mlops.py`：模型、评测、反馈对象
- `python/services/evaluation`
- `python/services/feedback`
- `python/workflows/evaluation`

这样既保留 AI Native 的演进方向，也不会过早让当前 MVP 失焦。

## 推荐实施顺序

### Phase 1：补平台语义与任务骨架
1. 扩展闭环领域模型
2. 扩展 dataset/version/index/export manifest 体系
3. 明确 task state machine 与 scheduler contract
4. 定义 labeling / review / mining task 语义

### Phase 2：补中台消费与治理基础层
5. source connector / ingestion spec
6. query service / notebook-facing access
7. quality checks / validation rule / publish gate
8. audit / approval / access policy 抽象

### Phase 3：补企业化与模型闭环层
9. tenant / RBAC / org/project boundary
10. enterprise providers via adapter/profile
11. model registry / evaluation / feedback loop integration
12. simulation / synthetic data loop binding

## 影响

### 正面影响
- 保持当前骨架稳定，不推翻已有设计
- 明确从本地 MVP 到 AI 数据中台的演进主线
- 让后续实现围绕平台语义，而不是围绕零散 feature 堆叠
- 提前锁定 scheduler / governance / task system 的边界，减少后期返工
- 为企业版与 SaaS 版演进保留一致的抽象模型

### 代价与约束
- 需要先补领域模型，而不是立刻追求更多可见 UI 功能
- 会引入更多 domain objects、state machine 与 service boundary，短期复杂度上升
- 需要避免把“未来能力”过早全部实现，仍要坚持分阶段推进

## 不采纳的方案

### 方案 A：继续只扩展 local MVP，不补平台语义
不采纳原因：
- 会让项目长期停留在 demo data workbench
- 难以承载 AI 闭环真实语义
- 后续功能会逐渐失去一致的领域模型基础

### 方案 B：直接按企业版技术栈重构
不采纳原因：
- 过早引入重型基础设施会破坏 local-first 学习与验证目标
- 当前项目最缺的不是基础设施，而是平台语义与任务/治理/消费层

### 方案 C：把调度、治理、消费、任务系统全部继续塞进 `apps/api`
不采纳原因：
- 会破坏已建立的分层
- route handler 会吞下太多 orchestration 和 lifecycle 逻辑
- 不利于未来 service decomposition

## 后续文档

- 缺失能力总览见：`docs/architecture/ai-data-platform-gap-map.md`
- 现有架构总览见：`docs/architecture/overview.md`
- Python 分层说明见：`docs/architecture/core-adapters-profiles-workflows.md`
- FDL 融合边界见：`docs/architecture/fdl-integration.md`
