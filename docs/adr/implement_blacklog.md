# Unified Implementation Plan

> 目标：一份可连续执行的统一规划。
>
> - `implementation-backlog.md`（平台基础与工程主链）
> - `experience-access-layer-implementation-backlog.md`（Web/BFF 体验访问层）
> - `implement_blacklog.md`（human/simulation/model 三环闭环）

---

## 1. 统一原则（合并后的执行共识）

- [ ] **原则 1 - 不推翻骨架，只补能力**
  **输入：** `apps/web -> apps/bff -> apps/api` 与 `core/adapters/profiles/workflows` 现有分层
  **输出：** 保持边界稳定的实施策略
  **验收标准：** 新能力通过领域对象、服务层、页面层增量落地，不出现跨层硬耦合

- [ ] **原则 2 - 先打通端到端，再做纵深优化**
  **输入：** 现有 MVP 路由、DashboardPayload、任务/导出/搜索主流程
  **输出：** 以闭环可用优先的排期顺序
  **验收标准：** 每个阶段都有可演示、可验收的业务闭环

- [ ] **原则 3 - 读模型与命令模型分治**
  **输入：** Dashboard 聚合读模型、Export/Bootstrap 等命令入口
  **输出：** Read Model 与 Command Feedback 分离规范
  **验收标准：** 页面可读数据与触发动作具备稳定且可测试的契约

---

## 2. 分阶段统一规划

## Phase A（P0，2 周）- 最小闭环可运行

### Epic A1 - 平台主链稳定（来自 implementation-backlog）

- [ ] **P0 Task A1.1 - Runtime profile 与 container 装配固化**
  **输入：** `infra/profiles`、runtime wiring
  **输出：** `local-dev` 运行时装配基线
  **验收标准：** API/workflow 能稳定从 profile 构建 container 并执行业务流程

- [ ] **P0 Task A1.2 - DataLake MVP provider 主链验收**
  **输入：** storage/query/metadata/table/search adapters
  **输出：** ingestion -> materialization -> query/search -> export 贯通
  **验收标准：** demo 数据链路能真实运行并回写 metadata

### Epic A2 - 体验访问层闭环（来自 experience backlog）

- [ ] **P0 Task A2.1 - Workbench 路由与导航真值统一**
  **输入：** `routes.tsx`、`nav-config.ts`、PRD 页面流
  **输出：** 页面、路由、导航一致性基线
  **验收标准：** 五大模块与核心路由在文档和代码中一致

- [ ] **P0 Task A2.2 - Dashboard 聚合读模型稳定**
  **输入：** `/api/dashboard`、`DashboardPayload`
  **输出：** 前端统一切片消费方案
  **验收标准：** Overview/Catalog/Explorer/Operations/Pipelines 均走统一聚合入口

- [ ] **P0 Task A2.3 - Catalog/Explorer/Ops/Pipelines 最小页面四态齐全**
  **输入：** 页面组件与统一表格组件
  **输出：** loading/empty/error/ready 状态体系
  **验收标准：** 核心页面均可稳定处理无数据与失败场景

### Epic A3 - 三环最小语义落地（来自 implement backlog）

- [ ] **P0 Task A3.1 - 增加 SimulationRun/ModelEval/ErrorBucket 基础对象**
  **输入：** Requirement、Task、Run、DatasetVersion 现有语义
  **输出：** 三环核心对象及状态定义
  **验收标准：** 可表达需求、仿真、模型评测、失败样本的追溯关系

- [ ] **P0 Task A3.2 - Requirement -> Simulation -> OpsTask 最小回路**
  **输入：** requirement_id、simulation result、ops task model
  **输出：** 自动派单规则与回写机制
  **验收标准：** 仿真失败样本可自动创建运营任务并可追踪来源

---

## Phase B（P1，4-8 周）- 团队版核心能力

### Epic B1 - BFF page-specific ViewModel 演进

- [ ] **P1 Task B1.1 - 增加 page mapper 层**
  **输入：** 共享 DashboardPayload
  **输出：** Overview/Catalog/Explorer/Ops/Pipelines 显式 mapper
  **验收标准：** 前端二次派生逻辑明显收敛，接口语义更清晰

- [ ] **P1 Task B1.2 - 拆分页面读接口**
  **输入：** 现有 `/api/dashboard`
  **输出：** page-specific read endpoints
  **验收标准：** 新老接口可并行过渡且不破坏现有页面

### Epic B2 - 团队上下文与协作能力

- [ ] **P1 Task B2.1 - BFF 引入 workspace/project/tenant context**
  **输入：** workspace 语义与请求生命周期
  **输出：** request context 注入能力
  **验收标准：** 页面能显式感知上下文，且不污染 Platform API 资源语义

- [ ] **P1 Task B2.2 - tasks/exports/runs 刷新与诊断能力**
  **输入：** Operations/Pipelines 页面
  **输出：** 刷新机制 + 上游失败诊断提示
  **验收标准：** 无需整页刷新即可观察状态变化并定位失败模块

### Epic B3 - Simulation/Model 深化

- [ ] **P1 Task B3.1 - ScenarioTemplate + EvalSuite**
  **输入：** 场景模板需求、评测指标体系
  **输出：** 批量仿真模板与统一评测套件
  **验收标准：** 多次仿真可按统一指标横向比较

- [ ] **P1 Task B3.2 - HardCaseList + RetrainProposal**
  **输入：** ModelEval、ErrorBucket、DatasetVersion
  **输出：** 主动学习样本集与再训练提案流程
  **验收标准：** 可追踪从误差发现到再训练发布的链路

---

## Phase C（P2）- 治理与企业化预留

### Epic C1 - 发布门禁与审计治理

- [ ] **P2 Task C1.1 - PolicyGate 落地**
  **输入：** 安全/质量/成本阈值
  **输出：** 发布门禁规则与配置入口
  **验收标准：** 不满足阈值的模型/数据版本无法进入发布流程

- [ ] **P2 Task C1.2 - 审计与回滚机制**
  **输入：** run/task/eval/release 记录
  **输出：** 审计日志规范与回滚 SOP
  **验收标准：** 发布决策可追溯、可解释、可回滚

### Epic C2 - 企业版扩展点

- [ ] **P2 Task C2.1 - team/enterprise profile wiring**
  **输入：** provider map、adapter 占位实现
  **输出：** 团队版/企业版可切换拓扑
  **验收标准：** provider 替换不影响上层业务主干

- [ ] **P2 Task C2.2 - auth/permission 占位到可用**
  **输入：** 角色模型、动作权限边界
  **输出：** 最小 RBAC 行为控制
  **验收标准：** 可区分只读与命令执行权限

---

## 3. 统一依赖顺序（必须遵守）

- [ ] A1 -> A2：先稳定底层运行链，再扩展体验层页面
- [ ] A2 -> A3：先有稳定读模型与页面壳，再接入三环对象与流程
- [ ] A3 -> B3：先做最小三环语义，再做模板化仿真与再训练深化
- [ ] B1/B2 -> C1：先完成团队上下文与接口分层，再引入门禁治理
- [ ] C1 -> C2：治理规则先行，企业化 provider 和权限能力后置

---

## 4. 统一里程碑验收

### Milestone M1（2 周）

- [ ] 本地 demo 可完成 bootstrap -> catalog -> explorer -> export -> ops 闭环
- [ ] Workbench 五模块稳定可用，核心页面四态完整
- [ ] Requirement -> Simulation -> OpsTask 最小回路可跑通

### Milestone M2（4-8 周）

- [ ] BFF page-specific read model 可用
- [ ] workspace/tenant context 与协作刷新能力可用
- [ ] ScenarioTemplate、EvalSuite、HardCaseList、RetrainProposal 可用

### Milestone M3（后续）

- [ ] PolicyGate + Audit + Rollback 可用
- [ ] 团队版/企业版 profile 与权限扩展点可用

---

## 5. 执行建议（Claude Code 连续实施顺序）

1. 完成 Phase A 的 A1、A2，并在每个任务后补充最小 smoke 测试。
2. 完成 A3，先落对象与接口，再接页面链路，避免先做 UI 再补语义。
3. 进入 Phase B 时优先做 B1（接口分层），再做 B2/B3（协作与三环深化）。
4. Phase C 只做“可运行骨架 + 明确契约”，避免提前实现重型企业能力。

---

## 6. 关联文档

- 总体路线：`docs/adr/ai-data-platform-roadmap.md`
- 基础 backlog：`docs/adr/implementation-backlog.md`
- 体验层 backlog：`docs/adr/experience-access-layer-implementation-backlog.md`

本文件作为统一执行入口，后续新增任务优先追加到这里，再按专题回写各子 backlog，避免三份计划继续分叉。