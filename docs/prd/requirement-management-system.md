# 数据闭环需求管理系统 PRD

> 本文档描述数据闭环需求管理模块的领域模型、页面流程、API 契约与三层架构设计。

## 1. 背景与目标

自动驾驶数据闭环的核心流程是：**需求定义 → 数据采集 → 数据标注 → 仿真重建 → 流水线运行 → 签收交付**。本模块为这一流程提供端到端的管理能力，覆盖需求拆解为数据任务、任务执行跟踪、以及质量签收闭环。

在当前 workbench 中，需求管理模块还承担跨页面编排职责：

- 从 Requirement 直接跳转到 Explorer/Search（携带 requirement、tags、query）
- 从 Search 结果继续下钻到 Clip Detail 完成样本核验
- 从 Clip Detail 上卷回 Requirement 或 Catalog 数据集分组

下图展示了模型训练从冷启动、主要场景构建，到持续 OTA 与 Corner Case 闭环的三阶段演进。需求管理系统的价值，正是在这个演进过程中，把“发现缺失场景”“针对性构建数据集”“持续迭代与签收交付”沉淀为可跟踪、可分派、可验收的标准化流程。

![模型训练三阶段示意图](../assets/three_phases_of_model_training.png)

从产品视角看，阶段一更强调自然分布数据采集与初始训练，阶段二开始围绕主场景和敏感场景进行针对性数据建设，阶段三则要求持续 OTA、构建细分场景与 Corner Case，并最终解决长尾问题。数据闭环需求管理模块需要支撑的，正是阶段二和阶段三中最核心的协同动作：需求提出、任务拆解、执行跟踪、质量签收和结果回流。

### 1.1 核心用户故事

| 角色         | 用户故事                                                                 |
| ------------ | ------------------------------------------------------------------------ |
| 算法工程师   | 提交数据需求，描述所需场景和优先级，跟踪需求进度                         |
| 数据工程师   | 查看待处理的数据任务，执行采集/标注/重建，更新任务状态                   |
| 数据分析师 DA | 按需求上下文检索 clip，验证场景覆盖并沉淀分析结论                         |
| 项目负责人   | 查看需求整体看板，按状态/优先级筛选，审核签收数据任务                     |
| 平台运维     | 查看流水线运行状态，关联需求与流水线执行记录                             |

## 2. 领域模型

```
Requirement (需求)
├── id, title, description, source, priority, status
├── scene_tags[], vehicle_tags[], created_at, updated_at
│
└── DataTask[] (数据任务)
    ├── id, task_type, title, description, status, assignee
    ├── sign_off_status, sign_off_by, sign_off_at
    │
    ├── CollectionJob (采集作业)
    │   ├── sensor_target, route_name, target_km, collected_km
    │   └── status, started_at, finished_at
    │
    ├── AnnotationTask (标注任务)
    │   ├── annotation_type, frame_count, annotated_count
    │   └── status, started_at, finished_at
    │
    └── PipelineRun (流水线运行)
        ├── stage, job_name, run_id
        └── status, started_at, finished_at
```

### 2.1 状态机

**Requirement Status**: `draft` → `approved` → `in_progress` → `completed` / `cancelled`

**DataTask Status**: `pending` → `in_progress` → `done` / `failed`

**SignOff Status**: `pending` → `approved` / `rejected`

## 3. 三层架构设计

### 3.1 API 层 (FastAPI)

负责领域逻辑与持久化，提供 RESTful 资源语义。

| Method | Path                                     | 说明             |
| ------ | ---------------------------------------- | ---------------- |
| POST   | /requirements                            | 创建需求         |
| GET    | /requirements                            | 需求列表(分页)   |
| GET    | /requirements/:id                        | 需求详情         |
| PATCH  | /requirements/:id                        | 更新需求         |
| GET    | /requirements/stats                      | 需求统计         |
| POST   | /requirements/:id/tasks                  | 创建数据任务     |
| GET    | /requirements/:id/tasks                  | 任务列表         |
| PATCH  | /data-tasks/:id                          | 更新任务         |
| POST   | /data-tasks/:id/sign-off                 | 签收任务         |
| GET    | /data-tasks/:id/collection-jobs          | 采集作业列表     |
| GET    | /data-tasks/:id/annotation-tasks         | 标注任务列表     |
| GET    | /data-tasks/:id/pipeline-runs            | 流水线运行列表   |

### 3.2 BFF 层 (Koa.js)

负责 ViewModel 聚合、分页/筛选/排序、以及对上游 API 的代理调用。

| BFF Path                     | 说明                                         |
| ---------------------------- | -------------------------------------------- |
| GET /api/requirements        | 需求列表 ViewModel (含统计卡片)              |
| GET /api/requirements/:id    | 需求详情 ViewModel (含任务列表、签收状态)    |
| GET /api/requirements/stats  | 需求统计聚合                                 |
| GET /api/clips               | Clip 列表（供 requirement drilldown 过滤）   |
| GET /api/clips/:clipId       | Clip 详情（供 requirement 验收跳转）         |
| POST /api/requirements       | 创建需求 (透传)                              |
| PATCH /api/requirements/:id  | 更新需求 (透传)                              |
| POST /api/requirements/:id/tasks  | 创建数据任务 (透传)                     |
| PATCH /api/data-tasks/:id    | 更新数据任务 (透传)                          |
| POST /api/data-tasks/:id/sign-off | 签收数据任务 (透传)                    |

### 3.3 Web 层 (React)

| 路由                        | 页面             | 说明                                   |
| --------------------------- | ---------------- | -------------------------------------- |
| /requirements               | RequirementList  | 需求列表 + 筛选 + 统计卡片            |
| /requirements/:id           | RequirementDetail| 需求详情 + 数据任务列表 + 签收操作     |
| /explorer/search            | SearchPage       | 从 requirement 预置参数进行 clip 检索 |
| /explorer/clips/:clipId     | ClipDetailPage   | 查看 clip 明细并上卷回 requirement    |

## 4. ViewModel 设计

### 4.1 RequirementListItem

```typescript
type RequirementListItem = {
  id: string
  title: string
  source: string
  priority: string
  status: string
  scene_tags: string[]
  task_count: number
  created_at: string
}
```

### 4.2 RequirementDetailView

```typescript
type RequirementDetailView = {
  id: string
  title: string
  description: string
  source: string
  priority: string
  status: string
  scene_tags: string[]
  vehicle_tags: string[]
  created_at: string
  updated_at: string
  data_tasks: DataTaskView[]
  explorer_context?: {
    requirement_id: string
    tags: string[]
    query: string
  }
}

type DataTaskView = {
  id: string
  task_type: string
  title: string
  status: string
  assignee: string | null
  sign_off_status: string
  sign_off_by: string | null
  sign_off_at: string | null
  collection_jobs: CollectionJobView[]
  annotation_tasks: AnnotationTaskView[]
  pipeline_runs: PipelineRunView[]
}
```

### 4.3 RequirementStats

```typescript
type RequirementStats = {
  total: number
  by_status: Record<string, number>
  by_priority: Record<string, number>
}
```

## 5. 页面交互设计

### 5.1 需求列表页

- **统计卡片区**：总数、各状态分布、各优先级分布
- **筛选栏**：状态下拉、优先级下拉、关键词搜索
- **列表表格**：ID、标题、来源、优先级（带颜色标签）、状态（StatusBadge）、任务数、创建时间
- **行点击**：导航到详情页
- **Find clips 按钮**：跳转 `/explorer/search`，带 `requirement`、`tags`、`q` 参数

### 5.2 需求详情页

- **面包屑**：需求列表 > 需求详情
- **需求信息卡**：标题、描述、来源、优先级、状态、场景标签、车型标签
- **数据任务列表**：表格展示任务，含签收状态 Badge
- **签收操作**：对 `pending` 签收状态的任务显示「通过」「驳回」按钮
- **Search matching clips 按钮**：跳转 `/explorer/search`，预置 `scene_tags` 与 `target_scene`

## 6. 跨页面下钻与上卷

### 6.1 下钻链路

```text
Requirement List/Detail
-> Explorer Search (预置 requirement + tags + query)
-> Clip result
-> Clip Detail
```

### 6.2 上卷链路

```text
Clip Detail
-> Back to requirement (若 URL 含 requirement)
-> Back to dataset (若 URL 含 dataset)
-> Back to clips (默认)
```

### 6.3 URL 上下文约定

- `requirement`: requirement id
- `dataset`: dataset id（场景聚合 bucket）
- `q`: 自然语言查询文本（语义检索占位）
- `tags`: 标签列表（`,` 分隔）
