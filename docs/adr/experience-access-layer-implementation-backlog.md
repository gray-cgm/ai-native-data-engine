# Experience Access Layer Implementation Backlog

> 目标：把 Experience Access Layer 从当前设计文档拆成 Claude Code 可连续执行的实施 backlog。
>
> 节奏约束：
> - **Phase 1 / P0：2 周内做出个人开发版 MVP**
> - **Phase 2 / P1-P2：后续 4~8 周演进到团队版**
>
> 拆分规则：
> - 按 **Epic -> Story -> Task** 组织
> - 每个 Task 都给出 **输入 / 输出 / 验收标准**
> - 输出形式为 **markdown checklist**

---

## Phase 1 - 2 周个人开发版 MVP

### Epic 1 - Workbench Shell 与导航骨架

#### Story 1.1 - 固化 Experience Access Layer 的工作台骨架

- [ ] **P0 Task 1.1.1 - 对齐工作台导航真值与文档命名**
  **输入：** [docs/prd/ui-page-flows-and-platform-interactions.md](../prd/ui-page-flows-and-platform-interactions.md)、[apps/web/src/routes.tsx](../../apps/web/src/routes.tsx)、[apps/web/src/shared/layouts/nav-config.ts](../../apps/web/src/shared/layouts/nav-config.ts)
  **输出：** 模块、子页面、路由、导航分组的一致化清单；必要时修正文档或前端命名不一致项
  **验收标准：** Overview / Catalog / Explorer / Operations / Pipelines 五个模块与 `/`、`/catalog`、`/catalog/:datasetId`、`/explorer`、`/explorer/search`、`/ops`、`/ops/exports`、`/pipelines` 八个路由在代码和文档中完全一致

- [ ] **P0 Task 1.1.2 - 固化 MainLayout 的 Header / Micro Menu / Sidebar 交互壳**
  **输入：** [apps/web/src/shared/layouts/main-layout.tsx](../../apps/web/src/shared/layouts/main-layout.tsx)、PRD 中的导航层级说明
  **输出：** 稳定可复用的工作台布局壳，明确 collapse / fullscreen / active module 行为
  **验收标准：** 切换模块时能自动跳到该模块首个页面；Header、Micro Menu、Sidebar 的展开/折叠行为稳定；刷新页面后能恢复本地折叠状态

- [ ] **P0 Task 1.1.3 - 统一页面容器模式**
  **输入：** [apps/web/src/shared/components/page-container.tsx](../../apps/web/src/shared/components/page-container.tsx)、PRD 页面字段级 item 设计表
  **输出：** 所有一级页面统一采用 Page Container 承载标题、描述、actions、内容区域
  **验收标准：** Overview、Catalog、Explorer、Operations、Pipelines 下页面都使用统一容器结构，页面标题与描述可从代码中清晰识别

#### Story 1.2 - 建立页面基础状态反馈能力

- [ ] **P0 Task 1.2.1 - 给各页面补齐 loading / empty / error 基础态**
  **输入：** PRD 中页面状态机章节、现有页面组件
  **输出：** 页面级状态反馈最小实现
  **验收标准：** Overview、Dataset List、Dataset Detail、Distribution、Search、Task Board、Export List、Run History 均能显式区分 loading / empty / error / ready

- [ ] **P0 Task 1.2.2 - 统一列表空态与错误态文案规范**
  **输入：** DataTable 组件、各页面 emptyText / error 呈现方式
  **输出：** 一组统一的空态与错误态文案/组件使用约定
  **验收标准：** DataTable 类页面不再各自随意定义空态；空态文本与错误提示不互相冲突，能被后续 Claude Code 连续复用

---

### Epic 2 - Dashboard 聚合读模型打通

#### Story 2.1 - 稳定 DashboardPayload 作为 MVP 统一读模型

- [ ] **P0 Task 2.1.1 - 审核并冻结 DashboardPayload 字段边界**
  **输入：** [apps/web/src/shared/types/common.ts](../../apps/web/src/shared/types/common.ts)、[apps/bff/src/services/dashboard.ts](../../apps/bff/src/services/dashboard.ts)、PRD 的 BFF ViewModel 章节
  **输出：** 当前 MVP 的 `DashboardPayload` 字段边界说明与必要的类型修正
  **验收标准：** `distribution`、`datasets`、`datasetVersions`、`tasks`、`workspaces`、`exports`、`searchRows` 七类字段都能在 BFF 聚合逻辑和前端类型中一一对应

- [ ] **P0 Task 2.1.2 - 稳定 BFF `/api/dashboard` 聚合链路**
  **输入：** [apps/bff/src/routes/dashboard.ts](../../apps/bff/src/routes/dashboard.ts)、[apps/bff/src/services/dashboard.ts](../../apps/bff/src/services/dashboard.ts)、Platform API 上游接口
  **输出：** 可稳定返回真实聚合结果的 dashboard route
  **验收标准：** `GET /api/dashboard` 成功时能同时返回 distribution、datasets、tasks、workspaces、exports、searchRows、datasetVersions；任一上游失败时有可调试的错误信息

- [ ] **P0 Task 2.1.3 - 将前端页面统一改为基于 dashboard payload 切片消费**
  **输入：** 现有 Web 页面、`DashboardPayload` 类型、PRD 页面切片规则
  **输出：** 统一的数据读取模式
  **验收标准：** Overview、Catalog、Explorer、Operations、Pipelines 页面都优先通过同一聚合 payload 渲染，不再出现页面各自绕过 BFF 重复取数的路径

#### Story 2.2 - 把 Overview 做成 MVP 首页

- [ ] **P0 Task 2.2.1 - 实现 PlatformStats 区块**
  **输入：** `datasets`、`tasks`、`exports`、`distribution`，PRD 中 Overview 字段设计
  **输出：** 展示 datasetCount / taskCount / sampleCount / exportCount 的首页统计区
  **验收标准：** 样本数由 `distribution.sample_count` 聚合得出；四类统计展示与真实 payload 对齐；无数据时能回落到 empty state

- [ ] **P0 Task 2.2.2 - 实现 QuickActions 区块**
  **输入：** Overview 目标跳转路径、PRD QuickActions 设计
  **输出：** 跳转到 Catalog / Distribution / Search / Exports 的快捷入口
  **验收标准：** 四个入口都能导航到对应页面；路径与路由真值一致；入口语义为页面跳转而不是直接触发重命令

- [ ] **P0 Task 2.2.3 - 实现 RecentActivity 区块**
  **输入：** `tasks`、`exports`、PRD 中 recentActivities ViewModel 建议
  **输出：** 合并 task/export 的近期活动摘要视图
  **验收标准：** 每条 activity 至少显示类型、标题/标识、状态、目标页面；无活动时显示空态

---

### Epic 3 - Catalog 与 Export 主链路

#### Story 3.1 - 实现数据集列表与详情浏览

- [ ] **P0 Task 3.1.1 - 完成 Dataset List 表格字段与跳转行为**
  **输入：** `datasets`、PRD 中 Dataset Table 字段表、[apps/web/src/shared/components/data-table.tsx](../../apps/web/src/shared/components/data-table.tsx)
  **输出：** 包含 `dataset_id`、`name`、`workspace_id`、`profile`、`exportAction` 的数据集列表
  **验收标准：** 用户能从 `/catalog` 看到真实 datasets；点击 `dataset_id` 可进入 `/catalog/:datasetId`；空列表显示统一空态

- [ ] **P0 Task 3.1.2 - 完成 Dataset Detail 的摘要区与版本表**
  **输入：** 路由参数 `datasetId`、`datasets`、`datasetVersions`
  **输出：** Dataset metadata summary + versions table
  **验收标准：** 详情页能正确匹配当前 dataset；版本表能展示 `version_id`、`sample_count`、`table_name`；dataset 不存在时显示 empty/not found 态

- [ ] **P0 Task 3.1.3 - 增加详情页返回列表与页面状态切换**
  **输入：** Dataset List / Detail 页面状态机定义
  **输出：** 返回动作与详情页状态管理
  **验收标准：** 从列表进入详情后可稳定返回；详情页至少具备 loading / ready / empty / error 四态

#### Story 3.2 - 打通 Export 命令链路

- [ ] **P0 Task 3.2.1 - 稳定 BFF Export route 的参数校验与默认格式**
  **输入：** [apps/bff/src/routes/exports.ts](../../apps/bff/src/routes/exports.ts)、PRD 中 Export Command 字段表
  **输出：** 支持 `datasetId + format` 的稳定导出命令入口
  **验收标准：** `POST /api/datasets/{datasetId}/exports` 默认格式为 `parquet`；仅允许 `parquet / csv / jsonl`；参数错误时返回明确错误

- [ ] **P0 Task 3.2.2 - 在 Dataset List 和 Dataset Detail 页面接入 Export Action**
  **输入：** BFF export route、Catalog 页面 UI、PRD 命令型 item 设计
  **输出：** 两个入口的一致导出交互
  **验收标准：** 用户可在列表页和详情页触发导出；提交中有 submitting 态；成功后有 success feedback 或跳转到 `/ops/exports`

- [ ] **P0 Task 3.2.3 - 在 Export List 中可见化导出结果**
  **输入：** `exports`、PRD Export Table 字段表、状态 badge 组件
  **输出：** 展示 `export_id`、`dataset_id`、`format`、`status`、`output_path` 的导出记录表
  **验收标准：** `/ops/exports` 能展示真实导出结果；状态用统一 badge 渲染；输出路径可见

---

### Epic 4 - Explorer 与 Search Preview 主链路

#### Story 4.1 - 实现 Distribution 页面

- [ ] **P0 Task 4.1.1 - 完成 Distribution 表格/图表读模型接线**
  **输入：** `distribution`、PRD Distribution 字段表
  **输出：** 场景分布视图，至少包含 scene、sample_count、share
  **验收标准：** `/explorer` 能展示真实 distribution 数据；share 由前端派生；无分布数据时显示 empty state

- [ ] **P0 Task 4.1.2 - 增加从 Distribution 跳转到 Search 的入口**
  **输入：** Explorer 路由、PRD 页面流转设计
  **输出：** 从 Distribution 到 Search 的明确导航入口
  **验收标准：** 用户可从 `/explorer` 直接进入 `/explorer/search`；入口名称与 PRD 文档一致

#### Story 4.2 - 实现 Search Preview 页面

- [ ] **P0 Task 4.2.1 - 基于 `searchRows` 搭建本地过滤型 Search 页面**
  **输入：** `searchRows`、PRD Search 页面字段表
  **输出：** 包含 query input 和 result table 的 Search 页面
  **验收标准：** 输入关键词后能在前端本地过滤 rows；至少展示 `id`、`scene`、`dataset_version_id`；过滤无结果时显示 empty state

- [ ] **P0 Task 4.2.2 - 在文档和页面中明确 Search 仅为 preview-based MVP**
  **输入：** PRD 当前约束章节、Search 页面文案
  **输出：** Search 能力边界提示
  **验收标准：** 页面或说明文字不会把当前能力表述成完整检索系统；开发者从代码和文档都能看出这是 preview/local filter 模式

---

### Epic 5 - Operations / Pipelines 运行可见性

#### Story 5.1 - 实现 Task Board 与 Export List

- [ ] **P0 Task 5.1.1 - 完成 Task Board 表格与状态 badge 接线**
  **输入：** `tasks`、[apps/web/src/shared/components/status-badge.tsx](../../apps/web/src/shared/components/status-badge.tsx)、PRD Task Table 字段表
  **输出：** 任务看板表格
  **验收标准：** `/ops` 页面至少展示 `task_id`、`title`、`status`、`task_type`；状态统一使用 StatusBadge；空列表与错误态可识别

- [ ] **P0 Task 5.1.2 - 让 Export List 与 Catalog Export 行为形成闭环**
  **输入：** Export action、`exports` 列表、Export List 页面
  **输出：** 从发起导出到查看导出记录的闭环体验
  **验收标准：** 成功发起导出后，用户能在 `/ops/exports` 中看到对应记录；至少支持手动刷新或重新进入页面查看最新状态

#### Story 5.2 - 提供最小 Run History 视图

- [ ] **P0 Task 5.2.1 - 以 task/run 风格数据实现 Pipelines MVP 页面**
  **输入：** `tasks`、PRD Run History 字段表
  **输出：** `/pipelines` 最小运行历史视图
  **验收标准：** 页面能显示 run-like 列表；文案明确其为运行历史视图而非完整 pipeline studio

- [ ] **P0 Task 5.2.2 - 在页面和文档中固化 Pipelines 的 MVP 边界**
  **输入：** PRD 当前实现约束章节、Pipelines 页面标题/描述
  **输出：** 明确的范围说明
  **验收标准：** 页面和文档都不会暗示 DAG 编辑器、调度控制台、多阶段 orchestration UI 已经存在

---

### Epic 6 - Bootstrap 与本地 Demo 启动体验

#### Story 6.1 - 打通个人开发版 MVP 的启动动作

- [ ] **P0 Task 6.1.1 - 稳定 `/api/bootstrap` 到 Platform API 的转发**
  **输入：** [apps/bff/src/routes/bootstrap.ts](../../apps/bff/src/routes/bootstrap.ts)、Platform API `/samples/ingest-demo`
  **输出：** 可在应用加载时调用的 bootstrap route
  **验收标准：** `POST /api/bootstrap` 能真实触发 demo ingest；失败时不会导致前端壳整体崩溃；成功后数据能进入 dashboard 可见范围

- [ ] **P0 Task 6.1.2 - 在 Web App 中固化 BootstrapGuard 的 best-effort 行为**
  **输入：** Web app mount 流程、bootstrap 交互时序图
  **输出：** 应用启动时自动尝试初始化 demo 数据的行为
  **验收标准：** 首次进入应用时能够 best-effort 触发 bootstrap；即便 bootstrap 已执行过或失败，用户仍能进入 workbench

- [ ] **P0 Task 6.1.3 - 补齐个人开发版 MVP 的启动说明与验收脚本**
  **输入：** 实际启动命令、需要启动的 Web/BFF/Platform API 进程、核心验收路径
  **输出：** 面向开发者的 quickstart / smoke checklist
  **验收标准：** 新开发者按文档启动后，能在本地完成 bootstrap、浏览 catalog、查看 explorer、触发 export、查看 ops 五条核心路径

---

## Phase 2 - 后续 4~8 周演进到团队版

### Epic 7 - 从共享 DashboardPayload 演进到 page-specific ViewModel

#### Story 7.1 - 让 BFF 的页面边界显式化

- [ ] **P1 Task 7.1.1 - 在 BFF 中增加 page selector / mapper 层**
  **输入：** 当前 `DashboardPayload`、PRD 中推荐的 page-specific ViewModel
  **输出：** Overview / Catalog / Explorer / Operations / Pipelines 的显式 mapper
  **验收标准：** BFF 内部能以函数或模块方式把平台聚合结果映射为页面 ViewModel；前端不再承担过多二次派生逻辑

- [ ] **P1 Task 7.1.2 - 拆分 page-specific read endpoints**
  **输入：** `/api/dashboard`、PRD 推荐演进路径
  **输出：** `GET /api/overview`、`/api/catalog/datasets`、`/api/catalog/datasets/:id`、`/api/explorer/distribution`、`/api/explorer/search-preview`、`/api/ops/tasks`、`/api/ops/exports`、`/api/pipelines/runs`
  **验收标准：** 新接口不破坏现有 MVP；页面可逐步切换到更清晰的 page-specific contracts

- [ ] **P1 Task 7.1.3 - 增加统一 CommandFeedback 响应模型**
  **输入：** bootstrap/export 命令返回结构、PRD 中 CommandFeedback 建议
  **输出：** BFF 层统一 action feedback contract
  **验收标准：** 页面能一致处理 success / error message；不再依赖各命令返回结构的隐式差异

---

### Epic 8 - 团队版上下文、权限与协作可见性

#### Story 8.1 - 给 Experience Access Layer 增加团队上下文

- [ ] **P1 Task 8.1.1 - 在 BFF 引入 workspace / project / tenant request context**
  **输入：** `workspaces` 数据、团队版边界需求、BFF request lifecycle
  **输出：** 最小上下文模型与上下文注入点
  **验收标准：** BFF 能在不污染 Platform API 资源语义的前提下，承接 workspace/project/tenant 维度上下文

- [ ] **P1 Task 8.1.2 - 在导航与页面层显性化 workspace 维度**
  **输入：** `workspaces`、Overview/Catalog 页面设计
  **输出：** workspace-aware 的页面入口或筛选表达
  **验收标准：** 团队版用户能明确看到当前 workspace 语义，而不只是 payload 中隐藏存在该字段

- [ ] **P2 Task 8.1.3 - 增加角色/权限占位能力**
  **输入：** 团队版访问控制需求、BFF auth context
  **输出：** 基于角色的页面动作占位控制
  **验收标准：** 至少能表达“只读浏览”和“可执行 export/bootstrap”等动作权限差异；未授权动作在页面上有明确禁用或隐藏策略

#### Story 8.2 - 增加团队协作所需的可观测性与状态刷新能力

- [ ] **P1 Task 8.2.1 - 为 tasks / exports / runs 增加显式刷新机制**
  **输入：** Operations / Pipelines 页面、团队协作下的状态更新需求
  **输出：** 手动刷新或轮询刷新机制
  **验收标准：** 团队成员无需重载整个应用即可看到任务、导出、运行状态变化

- [ ] **P1 Task 8.2.2 - 补齐页面级错误与上游失败诊断信息**
  **输入：** BFF 调用上游失败场景、页面 error state
  **输出：** 面向开发者/团队用户的最小错误诊断信息
  **验收标准：** 上游失败时页面能提示失败模块或接口类别；日志与页面提示可帮助开发者定位问题

---

### Epic 9 - 团队版体验增强与扩展点

#### Story 9.1 - 让命令与视图边界更清晰

- [ ] **P1 Task 9.1.1 - 分离只读页模型与命令入口组件**
  **输入：** 当前页面组件、PRD 中 read model / command model 的建议
  **输出：** 可复用的 command entry 模式，例如 ExportAction、BootstrapAction
  **验收标准：** 页面结构中能清楚区分只读区块与命令入口；命令组件在多个页面中行为一致

- [ ] **P1 Task 9.1.2 - 给关键命令增加二次确认/完成反馈设计**
  **输入：** export/bootstrap 行为、团队版交互需求
  **输出：** 更明确的提交中、成功、失败反馈模式
  **验收标准：** 用户执行关键命令时不会出现“已点击但无反馈”的状态；完成后能看到明确结果

#### Story 9.2 - 为未来领域扩展保留 Experience Access Layer 插槽

- [ ] **P2 Task 9.2.1 - 设计 domain-specific 页面注入点**
  **输入：** Core workbench 五模块结构、Domain Solution Layer 目标
  **输出：** 页面扩展/导航扩展方案说明或实现骨架
  **验收标准：** 后续新增领域页面时不需要污染 core navigation；扩展方式在代码结构或 ADR 中被清晰记录

- [ ] **P2 Task 9.2.2 - 为更强的 Search / Pipeline 能力预留升级路径**
  **输入：** 当前 preview-based Search、run history MVP 页面、PRD 演进建议
  **输出：** Search 控制台与 Pipeline studio 的后续演进说明
  **验收标准：** 团队版 backlog 能清楚区分“当前已实现能力”和“后续增强方向”，避免在 MVP 中提前实现过重功能

---

## 里程碑验收建议

### 里程碑 A - 个人开发版 MVP（2 周内）

完成以下最小闭环：

- [ ] 应用启动后可进入统一 workbench shell
- [ ] Bootstrap 能 best-effort 初始化 demo 数据
- [ ] Overview 能展示统计、快捷入口、近期活动
- [ ] Catalog 能浏览 dataset 列表与详情
- [ ] Explorer 能展示 distribution 并支持 preview search
- [ ] Operations 能查看 tasks 与 exports
- [ ] Pipelines 能展示最小 run history
- [ ] Export 能从 Catalog 触发并在 Exports 中可见

### 里程碑 B - 团队版（后续 4~8 周）

完成以下增强目标：

- [ ] BFF 从共享 payload 演进到 page-specific ViewModel
- [ ] 页面具备更稳定的错误诊断与刷新能力
- [ ] 引入 workspace / tenant / role 等团队上下文
- [ ] 命令与只读视图边界更清晰
- [ ] 为 domain extensions、Search 升级、Pipeline 升级保留明确扩展点

---

## Claude Code 连续执行建议顺序

建议按以下顺序逐个让 Claude Code 执行，避免一次改动过大：

1. Epic 1 - Workbench Shell 与导航骨架
2. Epic 2 - Dashboard 聚合读模型打通
3. Epic 3 - Catalog 与 Export 主链路
4. Epic 4 - Explorer 与 Search Preview 主链路
5. Epic 5 - Operations / Pipelines 运行可见性
6. Epic 6 - Bootstrap 与本地 Demo 启动体验
7. Epic 7 - page-specific ViewModel 演进
8. Epic 8 - 团队上下文与协作能力
9. Epic 9 - 体验增强与扩展点
