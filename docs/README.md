# 文档目录

## 架构设计
- [总体架构说明](./architecture/overview.md) - 包含 Web -> BFF -> Platform API 的总体分层
- [个人版 vs 企业版分层对比](./architecture/personal-vs-enterprise.md)
- [Monorepo 模块划分](./architecture/monorepo-modules.md) - 包含 `apps/bff` 的职责与目录结构
- [FDL 融合设计说明](./architecture/fdl-integration.md) - 说明 management / query / scheduler 如何映射到当前仓库
- [core / adapters / profiles / workflows 分层说明](./architecture/core-adapters-profiles-workflows.md) - 补充解释 Python 分层与领域模型作用
- [领域模型草图](./architecture/domain-model.md)
- [首版 MVP 范围](./architecture/mvp-scope.md) - 包含 BFF 的首版范围边界
- [Mermaid 架构图](./architecture/mermaid-diagrams.md) - 包含 BFF / Platform API 调用拓扑

## API
- [API 概览](./api/overview.md) - 区分 Web Access API（BFF）与 Platform API（FastAPI）

## ADR / 规划
- [Claude Code 实施 Backlog](./adr/implementation-backlog.md)

## 教程
- [Beginner Guide 入门文档](./tutorials/beginner-guide.md)
