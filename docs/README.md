# 文档目录

## 架构设计
- [总体架构说明](./architecture/overview.md) - 包含 Web -> BFF -> Platform API 的总体分层
- [个人版 vs 企业版分层对比](./architecture/personal-vs-enterprise.md)
- [Monorepo 模块划分](./architecture/monorepo-modules.md) - 包含 `apps/bff` 的职责与目录结构
- [Web Access Layer BFF Architecture](./architecture/web-access-layer-bff-architecture.md) - 说明 `apps/bff` 在 Web Access Layer 中的目录职责、分层边界与后续演进方向
- [FDL 融合设计说明](./architecture/fdl-integration.md) - 说明 management / query / scheduler 如何映射到当前仓库
- [core / adapters / profiles / workflows 分层说明](./architecture/core-adapters-profiles-workflows.md) - 补充解释 Python 分层与领域模型作用
- [领域模型草图](./architecture/domain-model.md)
- [AI 数据中台缺失能力地图](./architecture/ai-data-platform-gap-map.md) - 说明从当前 MVP 到 AI 数据中台还缺哪些关键能力
- [系统目录与领域模型设计](./architecture/system-directory-and-domain-design.md) - 基于 P0 / P1 roadmap 的目标目录与 domain model 设计
- [首版 MVP 范围](./architecture/mvp-scope.md) - 包含 BFF 的首版范围边界
- [Mermaid 架构图](./architecture/mermaid-diagrams.md) - 包含 BFF / Platform API 调用拓扑
- [界面 Item 设计、页面流转与平台交互细节](./architecture/ui-page-flows-and-platform-interactions.md) - 说明 workbench 信息架构、页面 item、页面流转与 Web/BFF/Platform API 交互边界

## API
- [API 概览](./api/overview.md) - 区分 Web Access API（BFF）与 Platform API（FastAPI）

## PRD
- [AI Data Loop Infra PRD](./prd/ai-data-loop-infra-prd.md) - 从产品定义层说明项目应定位为可迁移的通用 AI Data Infra，而不是行业专用门户
- [界面 Item 设计、页面流转与平台交互细节](./prd/ui-page-flows-and-platform-interactions.md) - 细化字段级 item 设计表、页面状态机、BFF ViewModel 与 Mermaid 时序图

## ADR / 规划
- [Claude Code 实施 Backlog](./adr/implementation-backlog.md)
- [Experience Access Layer Implementation Backlog](./adr/experience-access-layer-implementation-backlog.md) - 将体验访问层拆成 Epic -> Story -> Task 的连续实施清单
- [AI 数据中台演进路线 ADR](./adr/ai-data-platform-roadmap.md) - 说明如何从当前本地 MVP 演进到 AI 数据中台

## 教程
- [Beginner Guide 入门文档](./tutorials/beginner-guide.md)
- [DDIA2 × 项目认知地图](./ddia2-cognitive-map.md) - 帮助开发者从数据密集型系统视角理解本项目整体架构
