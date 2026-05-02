# 开发日志 · 2026-04-23 · 体验层升级

> 记录 Requirement / Operations / Pipeline / Docs Center 几个体验层主题在 2026-04 的改造内容。后续新增或未完成的待办项请勾选 `[ ]` 或 `[x]`。

本文档对应这一轮改造的完整脉络，按发生顺序分阶段记录。相关架构原则变更已回写到：

- `docs/architecture/domain-model.md`
- `docs/architecture/overview.md`
- `docs/architecture/mvp-scope.md`
- `docs/architecture/web-access-layer-bff-architecture.md`
- `docs/architecture/web-microfrontend-tools-platform.md`

---

## 0. 总览

本轮改造的主线是**「把业务沟通对象统一成可追踪的系统对象」**：

1. 概念正交化（Requirement / Case / Mining / Explorer）
2. 三层运营与执行模型（Operations Task / Pipeline Run / Requirement）
3. Operations 精简（移除 Privacy）
4. 真实关联字段落地（`requirement_id` / `operation_task_id` / `data_task_id`）
5. Requirement Report 聚合视图
6. DataTask ↔ OperationTask 衔接
7. 站内 Docs Center（含 Mermaid 渲染）

---

## 1. 概念正交化 · Requirement / Case / Mining / Explorer

**目标**：避免不同角色用同一个名词指代不同对象。

- **Requirement**：业务承诺与验收口径（"新增多少夜间路口 VRU 数据"）。
- **Case**：可复用的数据定义（dedup 策略、质量门槛、查询模板）。
- **MiningTask / OperationTask**：一次"从探索到落库"的运营执行过程。
- **Explorer**：交互式发现与验证入口；不落地业务承诺。

**变更文件**：
- `docs/architecture/domain-model.md`
- `docs/architecture/mvp-scope.md`
- `docs/api/overview.md`
- Web Explorer↔Mining / Requirements↔Mining 交互上加了上下文传递。

- [x] 写入正式文档
- [x] 在 Explorer / Requirements / Mining 间增加上下文传递链路
- [ ] 正式引入 `CaseTemplate` / `RequirementCaseLink` 资源类型（目前仅在文档里定义）

---

## 2. 三层模型 · Operations Task / Pipeline Run / Requirement

**问题**：早期文档中 "Operations Tasks" 与 "Pipeline Runs" 语义糊在一起。

**结论（三层）**：

| 层 | 对象 | 关心 |
|---|---|---|
| 业务承诺层 | Requirement | "为什么要做" |
| 人机协同运营层 | OperationsTask | "谁、按什么流程做" |
| 执行与成本层 | PipelineRun | "机器如何执行、花了多少成本" |

**UI 同步**：导航项从 "Operations" / "Runs" 更新为「Operations Tasks」与「Pipeline Runs」。

- [x] 文档中明确三层定位
- [x] Web 导航 / 页面标题统一称呼
- [x] PipelineRun 补 `trigger_source` / `reason_code` / 成本字段
- [ ] Pipeline Monitor 页面展示成本聚合（目前只有 list 级展示）

---

## 3. Operations 精简 · 移除 Privacy 模块

Privacy/PII 脱敏属于 Pipeline workflow 的**自动化**步骤，不是人工运营任务池的一类模块。

**变更**：
- 导航、路由、ops-modules-api、任务板 copy、overview 页全部下线 Privacy 模块
- 删除 `apps/web/src/modules/operations/pages/privacy.page.tsx`
- `docs/architecture/domain-model.md` 中补一条说明

- [x] 从前端导航 / 路由中移除 Privacy
- [x] 从 BFF ops-modules 注册表中移除 Privacy
- [x] 文档补充 Privacy 定位说明

---

## 4. 真实关联字段落地

文档上说关联对象没有用——需要落到 API / BFF / 前端表格里。

### 4.1 SQLite 元数据适配器

在 `job_runs` 和 `tasks` 表上新增可自动迁移的列（`_ensure_column`）：

- `requirement_id`
- `operation_task_id`
- `data_task_id`（OpsTask 上）
- `trigger_source`、`reason_code`
- 成本：`duration_seconds` / `cpu_seconds` / `gpu_seconds` / `input_bytes` / `output_bytes` / `estimated_cost`
- `derived_assets`（JSON）

### 4.2 Python services

scenario triage 在生成 run / task 时写入 linkage 和成本占位。`ScenarioTriageConfig` 增加 `requirement_id` / `requirement_title`，`infra/profiles/local-dev.yaml` 同步。

> 入口位置与命名后续有调整，详见 [2026-05-02 dev-log](./2026-05-02-tasktype-and-layering-cleanup.md)。本节描述的字段写入逻辑保持不变。

### 4.3 BFF / Web

- BFF `types`、`resource-schemas`、`operationsEngine`、路由层均支持按 `requirementId` 过滤
- Web `types`、任务板列、Pipeline Runs 列均展示 `requirementId` / `dataTaskId`

- [x] 数据库 schema 自动迁移
- [x] Services 写入 linkage / 成本
- [x] BFF 支持 requirementId 过滤
- [x] Web 表格展示
- [ ] 为列表页补 `requirementId` / `dataTaskId` 过滤控件（目前只能从需求详情反向跳转）

---

## 5. Requirement Report 聚合视图

**目标**：为需求方提供一张"我的需求现在怎么样了"的总览页。

- BFF 新增 `buildRequirementReport()` engine 与 `GET /requirements/:id/report` 路由，聚合关联 task / run、结果、成本。
- Web 新增 `requirement-report.page.tsx` 页面：统计卡片、结果 / 成本摘要、关联 tasks / runs 表格、Superset auto-BI 与 LLM 分析触发占位。
- 列表与详情页都增加了 "Open report" 入口。

- [x] BFF engine + 路由
- [x] Web Report 页面骨架
- [ ] 真正接入 Superset auto-BI（目前 `status: 'planned'`）
- [ ] 真正接入 LLM 分析触发
- [ ] 通过 IM / Webhook 自动回执需求方

---

## 6. DataTask ↔ OperationTask 衔接

通过 API (`ops_modules.py`) / BFF (`opsModulesEngine.ts`) / Web (`ops-modules-api.ts`、`ops-module-list-page.tsx`) 三端都加上 `data_task_id` 字段；在 Requirement 详情页提供**一键 "Create / Open Ops Task"**，按 `task_type` 自动路由到对应模块（labeling / tagging / checking / release / mining）。

- [x] API / BFF / Web 三端打通 `data_task_id`
- [x] Requirement 详情页一键 handoff
- [x] 文档更新（`domain-model.md` 新增 DataTask ↔ OperationTask 关系图）

---

## 7. Docs Center · 站内文档阅读器

**目标**：在 nav header 增加 Docs 入口，美观渲染 `/docs` 下所有 Markdown，方便开发者与用户阅读。

### 7.1 BFF

新增 `apps/bff/src/routes/docs-content.ts`：

- `GET /docs/tree`：递归构建 Markdown 文件树，过滤 `.ipynb_checkpoints` / `assets` / `node_modules` / `.git`，从首个 H1 读取标题。
- `GET /docs/file?path=...`：读取内容；路径穿越防护（`path.relative` 校验 + 仅允许 `.md` / `.markdown`）。
- `resolveDocsRoot()` 向上查找 `docs/` + `pnpm-workspace.yaml` 作为 root，可用 `DOCS_ROOT_DIR` 覆盖。

### 7.2 Web

- 安装 `react-markdown` + `remark-gfm` + `rehype-highlight` + `highlight.js`。
- 新增 `apps/web/src/modules/docs/`：
  - `api.ts` · 请求与 `buildCuratedView()`（manifest 映射）
  - `manifest.ts` · **任务导向**的文档分组清单（快速开始 / 产品 / 架构 / 决策 / API / 扩展阅读 + 自动回落的"其他"）
  - `components/mermaid-block.tsx` · 按需 `mermaid.initialize({ securityLevel: 'loose' })` + `mermaid.render()` 生成 SVG，错误时显示错误 + 源码
  - `pages/docs-viewer.page.tsx` · 左侧 section 树 + 右侧 GitHub 风格 markdown
  - `docs-viewer.css` · markdown-body / mermaid-block 样式
- 路由 `/docs` + `/docs/*` 注册在 `routes.tsx`；`layout-header.tsx` 增加 Docs 按钮（`ReadOutlined`）。

### 7.3 Mermaid 支持

在 ReactMarkdown 的 `components.code` 中拦截 `language-mermaid` 代码块，替换为 `<MermaidBlock>`，支持错误回退。

### 7.4 目录结构化（按读者任务组织）

旧问题：侧边栏只按文件夹罗列，不符合"我想先从哪读起"的心智。
新方案：引入 `DOC_SECTIONS` 清单（`manifest.ts`），按 section 展示：

1. 🚀 快速开始
2. 📘 产品与需求
3. 🏛 系统架构（总览 / 领域模型 / 分层与编排 / 数据与集成 / 前端与访问层 / 图表）
4. 🧭 决策 & 路线图
5. 🔌 API 参考
6. 📚 扩展阅读
7. 📝 开发日志（本目录）
8. 📂 其他文档（自动收录未在 manifest 中的孤儿文件）

每个 section 带图标、文件计数 Tag、缺失文件告警、搜索自动展开命中。

### 7.5 踩坑

- **BFF tsx watch 不发现新路由文件**：BFF dev 进程启动时还没有 `docs-content.ts`，路由通过运行时 `readdirSync` 扫描，tsx watch 不把它纳入 import 图。需要 `touch apps/bff/src/index.ts` 触发重启。
- **`type="link"` JSX 被错位的字符串替换毁掉**：Docs 按钮一次性补丁导致 11 个 TS parse error；用"带足够上下文的 replace"重新修复后干净。

- [x] BFF tree + file 接口
- [x] Web 侧边栏 + Markdown 渲染
- [x] Mermaid 渲染
- [x] 任务导向的 manifest 清单
- [x] nav header Docs 按钮
- [ ] 文章内目录（TOC / anchor 导航）
- [ ] 图片资源渲染（当前 `assets/` 目录被忽略）
- [ ] "Edit on GitHub" 外链
- [ ] 文档搜索内容级命中（当前仅标题 / 路径）

---

## 8. 本次验证

- `pnpm --filter web typecheck` · 通过
- `pnpm --filter bff typecheck` · 通过
- `curl http://localhost:3100/api/docs/tree` · 200（BFF 重启后）
- 浏览 `/docs/architecture/mermaid-diagrams.md` · Mermaid 图正确渲染

---

## 9. 整体未完成待办（汇总）

- [ ] `CaseTemplate` / `RequirementCaseLink` 正式落地为 API 资源
- [ ] Pipeline Monitor 成本聚合视图
- [ ] 列表页补 `requirementId` / `dataTaskId` 过滤控件
- [ ] Requirement Report 接入 Superset auto-BI
- [ ] Requirement Report 接入 LLM 分析触发
- [ ] Requirement Report 自动回执（IM / Webhook）
- [ ] Docs Center：文章级 TOC / anchor
- [ ] Docs Center：图片资源渲染
- [ ] Docs Center：Edit on GitHub 外链
- [ ] Docs Center：内容级搜索

---

## 附：下一次开发可以直接抄的套路

1. 新增 BFF 路由时，如果 `dev:bff` 已经在跑，**必须** `touch apps/bff/src/index.ts` 触发重启，否则 `readdirSync` 不会重新扫描。
2. 修改多行 JSX 片段时优先 `replace_string_in_file` 且包含 3–5 行上下文，避免 token 边界被拼错。
3. 需要在 Docs Center 里新增一篇文档时：
   - 丢进 `docs/<section>/xxx.md`
   - 在 `apps/web/src/modules/docs/manifest.ts` 的对应 section 下加一行；不加也会出现在「其他文档」里。
4. 本日志后续续写时，直接在本目录下以日期命名新增 md，并在 manifest 的 dev-logs section 下登记。
