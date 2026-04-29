# 模块 PRD · Requirement（需求管理）

> 父文档：[整体产品 PRD](./ai-data-loop-infra-prd.md)
> 路由：`/requirements` · `/requirements/:id` · `/requirements/:id/report`

## 1. 模块定位

Requirement 是**业务需求与数据交付承诺的入口**——所有数据相关的工作都从这里发起，最终通过 PipelineRun + Snapshot 在 Catalog 落地为 official Dataset。

> 简单记忆：**业务起点 = Requirement，业务终点 = official Dataset，中间用 x_trace_id 串起来**。

## 2. 用户故事

| 角色 | 场景 | 主操作 |
|---|---|---|
| Dre / 产品 | 提出「夜间 VRU 召回率从 88% 提到 95%」诉求 | 新建 Requirement，关联飞书需求文档 |
| 大数据团队 | 评审需求，决定是否进入排程 | 在 DataTask 上 Sign-off |
| PM | 跟踪一个需求的整体进度 | Requirements 列表筛选 / 详情页看四层闭环对象 |
| 算法 | 验收数据交付 | Requirements/:id/report 看产出的 official dataset + 关键指标 |

## 3. 主要功能

### 3.1 Requirement 列表

- 字段：title · priority · source（dre/product/algorithm/test）· status · dre_owner · target_scene · scene_tags · vehicle_tags · estimated_data_volume · due_date
- 筛选：status / priority / source / 关键字
- 状态机：`DRAFT → PENDING_REVIEW → APPROVED → IN_PROGRESS → COMPLETED / REJECTED`

### 3.2 Requirement 详情页（4 层闭环）

```
Requirement
  ├─ DataTasks (4 类：collection / annotation / quality_check / pipeline)
  │    └─ 每条带 sign_off_status (PENDING / APPROVED / REJECTED) + sign_off_by + at + comment
  ├─ OperationsTasks（Mining / Labeling / Tagging / Checking / Release）
  ├─ PipelineRuns（按 step：collect / clip-extract / feature-compute / release）
  └─ Snapshot Manifest（可点跳 official dataset）
```

### 3.3 Requirement Report 报表（`/requirements/:id/report`）

- 关键指标卡：交付 dataset 数 / 样本数 / Pipeline 总成本 / 通过率
- 链路 Mermaid（Requirement → DataTask → OpsTask → PipelineRun → Dataset → Artifact）
- 各 ops 模块产出的 OpsItem 状态分布

## 4. 与其他模块的关系

| 上游 | 描述 |
|---|---|
| 飞书 / Jira | `feishu_doc_id` 字段做软关联 |

| 下游 | 描述 |
|---|---|
| DataTasks | 由 Requirement 拆出的业务里程碑（默认 4 条） |
| OperationsTasks / PipelineRuns | 通过 `requirement_id` 反向关联 |
| Catalog Dataset | `Dataset.requirement_id` 把 dataset 挂回需求 |

## 5. 关键设计决策

- **DataTask 的 4 类是固定枚举**：`collection / annotation / pipeline / quality_check`。Requirement 拆解时自动生成 4 条占位 DataTask，每条独立 sign-off。
- **Sign-off 内嵌在 DataTask**，不开独立审批表——简单、可审计；如需多轮审批历史可后续扩展。
- **`x_trace_id` 在 Requirement 创建时不生成，在 OperationsTask 第一次执行时由 Mining 触发并向上回填**——保证一条 trace 横跨四层对象。

## 6. 待办与扩展

- [ ] CaseTemplate / RequirementCaseLink 资源化（验收用例的版本化）
- [ ] LLM 自动从飞书文档抽取 scene_tags / estimated_data_volume
- [ ] Requirement 看板视图（按 priority 看 backlog）
- [ ] 跨 Requirement 的样本去重检测
