# AI Data Loop Engine · 文档总览

> **项目定位**：面向自动驾驶 / 机器人 AI 数据闭环的本地优先（local-first）数据平台。
> 目标不是行业专用门户，而是**可迁移的通用 AI Data Infra**——从一台笔记本到团队、再到 SaaS。

本目录是项目所有文档的索引。每个章节按**读者画像**组织，进入对应区域即可找到所需内容。

---

## 🚀 快速开始（新人 / PM / 工程）

| 文档 | 适用读者 |
|---|---|
| [入门教程](./tutorials/beginner-guide.md) | 第一次接触本项目的所有读者：1 小时跑通本地环境 |
| [E2E Demo 演示](./tutorials/e2e-demo.md) | 想看完整数据闭环的读者：从 Requirement → 落地 official Dataset 的 9 步流程 |

---

## 📘 产品与需求

| 文档 | 内容 |
|---|---|
| [整体产品 PRD](./prd/ai-data-loop-infra-prd.md) | AI Data Loop Infra 的产品定位与全景图 |
| [模块 PRD · Catalog](./prd/module-catalog.md) | 数据集目录与浏览 |
| [模块 PRD · Requirement](./prd/module-requirement.md) | 需求管理 + Sign-off 流程 |
| [模块 PRD · Explorer](./prd/module-explorer.md) | Clip 检索 / 详情 / 灵活切割 |
| [模块 PRD · Operations](./prd/module-operations.md) | Mining / Labeling / Tagging / Checking / Release 六大子域 |
| [模块 PRD · Pipelines](./prd/module-pipelines.md) | 流水线运行 / 血缘 / 质量 / 成本 |
| [模块 PRD · Tools](./prd/module-tools.md) | 工具平台与微前端集成 |
| [产品使用说明](./prd/user-guide.md) | 端到端工作流：算法工程师 / DRE / 标注供应商 / 运维各自怎么用 |
| [UI / UX 设计](./prd/ui-ux-design.md) | 信息架构、页面状态机、交互细节（前端工程师向） |

---

## 🏛 系统架构

| 章节 | 关键文档 |
|---|---|
| [架构总览](./architecture/overview.md) | 核心抽象 + 业务流程 + 系统分层一图打通 |
| [Mermaid 架构图](./architecture/mermaid-diagrams.md) | BFF / Platform API / Dagster 调用拓扑 |
| [MVP 范围](./architecture/mvp-scope.md) ｜ [个人版 vs 企业版](./architecture/personal-vs-enterprise.md) ｜ [能力 Gap Map](./architecture/ai-data-platform-gap-map.md) | 边界与演进 |
| **领域模型（一组）** | [术语澄清](./architecture/glossary-dataset-scenario-cornercase-tag-label.md) ｜ [领域模型与语义](./architecture/domain-model.md) ｜ [Dataset + Snowflake 设计](./architecture/dataset-design.md) ｜ [Core / Adapters / Profiles / Workflows 分层](./architecture/core-adapters-profiles-workflows.md) ｜ [系统目录与领域设计](./architecture/system-directory-and-domain-design.md) |
| **业务流程（一组）** | [业务流程总览](./architecture/business-flows.md) ｜ [分层与编排边界](./architecture/layering-and-orchestrator-boundaries.md) ｜ [Local-First 流式演进](./architecture/local-first-streaming-evolution.md) ｜ [物理数据集管理系统](./architecture/build-phisical-dataset-manager-system.md) |
| **系统分层（一组）** | [系统分层总览（六层）](./architecture/system-layers.md) ｜ [Clip + Lance 数据模型](./architecture/clip-lance-data-model.md) ｜ [FDL 集成](./architecture/fdl-integration.md) ｜ [Monorepo 模块划分](./architecture/monorepo-modules.md) ｜ [Web 访问层 / BFF 架构](./architecture/web-access-layer-bff-architecture.md) ｜ [微前端工具平台](./architecture/web-microfrontend-tools-platform.md) |

---

## 🧭 决策 & 路线图

| 文档 | 内容 |
|---|---|
| [AI 数据平台路线图](./adr/ai-data-platform-roadmap.md) | 个人 → 团队 → SaaS 的演进路线 |
| [实施 Backlog](./adr/implement_blacklog.md) | Claude Code 实施任务流水 |
| [体验 / 访问层 Backlog](./adr/experience-access-layer-implementation-backlog.md) | Epic → Story → Task 的连续清单 |
| [PipelineRun 统一事实模型 ADR](./adr/adr-pipelinerun-unified-fact-model.md) | x_trace_id 串通四层闭环对象的设计决策 |
| [技术选型：DataFusion / OpenDAL](./adr/tech-selection-datafusion-opendal.md) | 查询引擎 + 存储抽象层升级评审 |

---

## 🔌 API 参考

| 文档 | 内容 |
|---|---|
| [API 总览](./api/overview.md) | 三类 API 的边界（Web BFF / Platform API / 外部 SDK） |
| [内部 API：Web ↔ BFF ↔ Platform API](./api/internal-api.md) | 内部调用契约、ViewModel、X-Trace-Id 透传 |
| [外部 API & SDK 使用说明](./api/external-api-sdk.md) | 算法工程师消费 dataset / sample / asset 的方式 |

---

## 📚 扩展阅读

| 文档 | 内容 |
|---|---|
| [DDIA 认知地图](./ddia2-cognitive-map.md) | 从数据密集型系统视角理解本项目 |
| `ddia2_reading_notes/chapter*.md` | 章节读书笔记（Trade-offs / 非功能性需求 / 数据模型 / 批处理 / 流处理） |

---

## 📝 开发日志

按日期组织的迭代记录（`dev-logs/`）。新读者可跳过；维护者按时间倒序回看变更与待办。

---

## 文档组织原则

- **按读者画像分章节**，不是按目录结构。新人从「快速开始」入；PM 看「产品与需求」；工程看「系统架构」；算法 / 外部消费方看「API 参考」。
- **MECE（互斥穷尽）**：架构章节按"总览 → 领域模型 → 业务流程 → 系统分层"四组划分，互不重叠也不漏。
- **每文一个职责**：避免同一主题分散在多篇。冲突时以本目录里的标准设计文档为准。

> 文档维护由 [Web Docs Center](http://localhost:5173/docs) 在线渲染，左侧目录由 `apps/web/src/modules/docs/manifest.ts` 驱动。
