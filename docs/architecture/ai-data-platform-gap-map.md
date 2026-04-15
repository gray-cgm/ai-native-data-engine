# AI 数据中台缺失能力地图

## 目的

这份文档用于回答一个更具体的问题：

> 从当前 `ai-data-loop-engine` 的本地 MVP 架构出发，如果目标是演进为真正的 AI 数据中台，还缺哪些关键能力？

这里的“缺失”并不表示当前设计错误。相反，当前仓库已经具备比较清晰的分层主线：

- Web -> BFF -> Platform API 的访问分层
- `core / adapters / profiles / workflows` 的 Python 抽象边界
- local-first 的 lakehouse MVP 路线
- profile 驱动的演进空间

当前真正缺的是：如何把“数据平台骨架”补成“AI 闭环中台”。

## 当前架构已经具备的底座

从当前仓库状态看，以下能力已经成立，可视为后续演进的稳定基础：

1. **平台访问分层已明确**
   - `apps/web` 负责工作台 UI
   - `apps/bff` 负责 app-facing 聚合层
   - `apps/api` 负责 Platform API / control plane

2. **运行时装配边界已明确**
   - `python/core` 定义领域模型与 contracts
   - `python/adapters` 实现 provider
   - `python/profiles` 负责 profile 解析与 container 装配
   - `python/workflows` 负责流程编排

3. **本地 MVP 主链路已存在**
   - local fs 存储 + Lance 主文件格式 + DuckDB 查询 + SQLite metadata
   - ingestion -> materialization -> query/search/export 基础链路已跑通

4. **个人版 -> 企业版 -> SaaS 版的演进方向已经写清**
   - 当前缺的是分阶段补齐能力，而不是推翻重做

## 总体判断

当前项目更准确的定位是：

- **AI 数据中台的架构骨架 + 本地 MVP**

而不是：

- **完整的 AI 数据中台**

要补的重点不只是更多技术组件，而是四类平台能力：

1. 闭环业务对象
2. 平台级任务与治理系统
3. 分析消费与数据服务层
4. 面向企业化的运行与控制平面

---

## P0：必须优先补齐的能力

这些能力决定系统能否从“本地数据工作台”升级为“AI 闭环平台”。

### P0-1. 闭环领域模型扩展

#### 当前已有
- `SampleRecord`
- `DatasetSummary`
- `ComputeRun`
- `LineageEvent`
- `RuntimeProfile`
- `ProfileCapabilities`

#### 当前缺失
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

#### 为什么重要
当前领域模型更偏“通用数据平台”。
但 AI 数据中台真正要支撑的是：

```text
线上/离线反馈
-> 场景归档
-> 挖掘任务
-> 标注/审核任务
-> 数据集版本晋升
-> 训练/评测绑定
-> badcase 回流
-> 下一轮闭环
```

如果没有这些对象，系统只能管理 dataset 和 export，无法真正承载 AI 闭环语义。

#### 建议目录落位
- `python/core/src/core/domain/models.py`
- 未来可拆分：`python/core/src/core/domain/closed_loop.py`
- TS 对应契约：`packages/contracts` / `packages/schemas`

---

### P0-2. 数据版本一致性与可复现性系统

#### 当前已有
- `Dataset`
- `DatasetVersion`
- `ExportJob`
- `LineageEvent`

#### 当前缺失
- dataset snapshot manifest
- dataset version 与 table snapshot 的强绑定
- dataset version 与 search index version 的绑定
- export artifact manifest
- diff / compare / rollback 语义
- materialization provenance
- reproducible build metadata

#### 为什么重要
AI 数据中台必须能够回答：

- 这个训练集到底由哪些样本构成？
- 这次导出对应哪个 dataset version？
- 这个 search index 对应哪个版本的样本？
- 当前 UI 看见的数据，和训练/评测使用的数据是否一致？

现在的版本对象更像 catalog 记录，还不是严格的版本治理系统。

#### 建议目录落位
- `python/core`：版本对象与 manifest 模型
- `python/workflows`：materialization / publish 流程
- `python/adapters/metadata/*`：manifest 持久化
- `apps/api`：compare / publish / promote endpoints

---

### P0-3. 平台级异步任务与调度系统

#### 当前已有
- `ComputeAdapter` 抽象
- `JobRun` / `Task` 概念
- `apps/scheduler` 与 `python/services` 占位

#### 当前缺失
- 真正的 scheduler service
- async job queue
- retry / backoff / dead-letter
- callback / webhook / completion event
- priority / resource quota / concurrency control
- 长任务状态机
- orchestration API 与 worker boundary

#### 为什么重要
一旦系统进入真实平台阶段，以下能力都不会是同步请求：

- 大规模导入
- 索引重建
- 数据导出
- 数据质量扫描
- mining job
- 批量标注任务生成
- 评测回放

如果没有独立调度系统，FastAPI route handler 和 workflow 很快会承担过多生命周期职责。

#### 建议目录落位
- `apps/scheduler`
- `python/services/scheduler`
- `python/workflows/scheduler`
- `python/core/interfaces/contracts.py` 中补 scheduler / task orchestration contract

---

### P0-4. 标注 / 审核 / 任务运营中台层

#### 当前已有
- demo task 概念
- workspaces / tasks / exports 的最小视图

#### 当前缺失
- labeling task model
- review / QA task model
- assignment / queue / SLA
- annotation payload schema
- task state machine
- consensus / dispute handling
- 人工反馈回流
- dataset promotion gate

#### 为什么重要
AI 数据闭环里，“任务运营系统”不是附属品，而是中台核心能力之一。
如果任务系统只停留在 demo 记录层，那么平台只能“看数据”，无法“推动数据闭环流转”。

#### 建议目录落位
- `python/core/domain`
- `python/workflows/task_ops`
- `apps/api` 新增 task operations endpoints
- `apps/bff` 聚合 task board / review queue
- `apps/web` 承接运营视图

---

### P0-5. 数据接入标准化前门

#### 当前已有
- night intersection VRU scenario triage workflow
- local directory ingestion

#### 当前缺失
- source connector registry
- ingest spec / manifest
- batch import / incremental import 模型
- connection config / credential boundary
- raw landing zone 规范
- source schema discovery
- ingest idempotency / replay semantics

#### 为什么重要
如果没有标准化 ingestion front door，系统只能消费 examples 目录，不能成为真正的平台入口。
AI 数据中台至少要能表达：

- 本地目录
- 对象存储
- HTTP/API 回流
- 标注结果回流
- 模型评测结果回流
- 设备/日志/事件流回流

#### 建议目录落位
- `python/core/interfaces/contracts.py`
- `python/adapters/storage/*`
- `python/workflows/ingestion/*`
- `apps/api` 新增 source / ingestion endpoints

---

## P1：中期应补齐的能力

这些能力决定平台是否真正具备“中台消费面”和“团队使用价值”。

### P1-1. 自助分析与 notebook / BI 消费层

#### 当前已有
- DuckDB query adapter
- Web dashboard
- search preview

#### 当前缺失
- ad hoc SQL query service
- notebook-facing access layer
- saved query / query history
- notebook / BI / dashboard integration
- 分析角色友好的消费面

#### 为什么重要
`practical-data-engineering` 的一个启发是：一个数据平台不仅要能 ingest 和 orchestration，还要有清晰的分析消费层。
当前项目更偏“平台控制台”，还不够像“数据中台”。

#### 建议目录落位
- `apps/api`：query endpoints
- `python/services/query`
- `apps/web`：query console / analysis page
- 后续可加 `notebooks/` 或 `examples/notebooks/`

---

### P1-2. 数据质量与规则系统

#### 当前已有
- 最小 lineage
- 最小 metadata plane

#### 当前缺失
- quality check
- validation rule
- schema enforcement
- freshness / completeness / uniqueness / anomaly rules
- check result persistence
- publish gate / quality gate

#### 为什么重要
AI 数据中台里的数据问题，常常不是“有没有数据”，而是：

- 样本字段是否齐全
- 元数据是否漂移
- 标签是否异常
- 某类场景占比是否失衡
- 导出前是否满足质量门槛

没有数据质量层，后续很多闭环动作都不可控。

#### 建议目录落位
- `python/core/domain/quality.py`
- `python/services/quality`
- `python/workflows/quality`
- `apps/api` 暴露 check/report endpoints

---

### P1-3. 治理与审计基础层

#### 当前已有
- `ProfileCapabilities` 中的 governance flag 雏形

#### 当前缺失
- audit log
- approval record
- access policy
- export approval
- retention policy
- sensitive data tagging
- masking / watermark / redaction rule

#### 为什么重要
AI 数据通常涉及图像、视频、位置、人员、车牌、人脸等敏感信息。
治理不是企业版锦上添花，而是应尽早设计抽象边界。

#### 建议目录落位
- `python/core/domain/governance.py`
- `python/services/governance`
- `apps/api` 暴露 audit / approval endpoints
- `apps/bff` 增加治理视图聚合

---

### P1-4. 路径布局与数据资产 layout abstraction

#### 当前已有
- 文档里已有明确方向
- export / data path 已存在基础约定

#### 当前缺失
- 统一 layout service
- raw / bronze / silver / gold / export / index / artifact 目录规范
- task artifact path abstraction
- scenario / mining / labeling artifact path 规范

#### 为什么重要
当前路径规则还容易散落在 workflow、adapter 和 route 里。
如果未来要引入更多资产类型，没有统一 layout abstraction 会迅速失控。

#### 建议目录落位
- `python/core/interfaces`
- `python/services/layout`
- `python/adapters/storage/*`

---

## P2：企业化 / SaaS 化阶段补齐的能力

这些能力不是当前最急，但要尽早为它们预留模型边界。

### P2-1. 多租户与组织级权限系统

#### 当前已有
- profile capability 中的 multi-tenant / sso flag
- BFF 作为会话边界的方向正确

#### 当前缺失
- tenant model
- org / project / workspace boundary
- RBAC / ABAC
- tenant-aware metadata model
- tenant-scoped scheduling / quota

#### 建议目录落位
- `python/core/domain/authz.py`
- `python/services/authz`
- `apps/bff` 承接 session / tenant context
- `apps/api` 保持平台资源语义稳定

---

### P2-2. 企业化 lakehouse 与分布式执行

#### 当前已有
- adapter/profile 设计已经预留替换空间
- 文档里已明确湖表、查询、计算、对象存储分层演进方向

#### 当前缺失
- provider-ready service orchestration
- table catalog abstraction 的强化
- distributed query / compute coordination
- production object storage operational model

这里的关键不是简单说“Parquet 升级成 Iceberg”，而是把企业化补齐为：

- 对象存储层：S3 / OSS / HDFS
- 湖表格式层：Iceberg / Paimon / Hudi
- 计算层：Flink / Spark / Fluss
- 查询层：StarRocks / Trino / DuckDB
- 文件格式层：Parquet / Lance

#### 建议目录落位
- `python/adapters/table/*`
- `python/adapters/query/*`
- `python/adapters/compute/*`
- `python/services/query`
- `python/services/scheduler`

---

### P2-3. 模型闭环集成层

#### 当前已有
- README 中已有 training / planning / simulation / VLM / world model 的认知路线

#### 当前缺失
- model registry integration
- experiment run binding
- evaluation suite model
- badcase ingestion
- active learning loop
- synthetic data / simulation job binding

#### 为什么重要
没有这一层，系统仍然是“面向数据资产的平台”，而不是“面向模型闭环优化的平台”。

#### 建议目录落位
- `python/core/domain/mlops.py`
- `python/services/evaluation`
- `python/services/feedback`
- `python/workflows/evaluation`

---

## 建议的演进顺序

### 第一阶段：先补平台语义，不急着补所有 UI
1. 扩展闭环领域模型
2. 建立 dataset/version/index/export manifest 体系
3. 建立 async task/scheduler 抽象
4. 建立 labeling/review/mining task 语义

### 第二阶段：补任务运营与分析消费层
5. source connector / ingestion spec
6. data quality / governance 基础层
7. query service / notebook / analysis access

### 第三阶段：补企业化运行能力
8. multi-tenant / RBAC / approval
9. enterprise lakehouse providers
10. model / evaluation / simulation feedback loop

---

## 一句话总结

当前 `ai-data-loop-engine`：

- **不缺架构主线**
- **缺 AI 闭环专属业务层、中台级任务层、治理层、分析消费层与调度层**

因此它现在最准确的定位是：

- **AI 数据中台的架构骨架 + 本地 MVP**

接下来真正要做的，不是简单继续堆技术组件，而是围绕“闭环对象、平台任务、版本治理、分析消费、企业控制面”把平台补完整。
