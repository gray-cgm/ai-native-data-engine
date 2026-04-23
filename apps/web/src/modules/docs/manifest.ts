/**
 * Curated documentation manifest.
 *
 * The raw filesystem tree under /docs is organized by folder, which does not
 * necessarily reflect the best reading order for users/developers. This
 * manifest provides an audience-oriented, hierarchical structure used by the
 * docs viewer sidebar. Files not listed here are shown under "其他 / Other".
 */

export type DocManifestItem = {
  /** POSIX-style path relative to the /docs root. */
  path: string
  /** Override title. If omitted, the file's first H1 is used. */
  title?: string
  /** Short hint shown under the title. */
  hint?: string
}

export type DocManifestGroup = {
  id: string
  label: string
  items?: DocManifestItem[]
  groups?: DocManifestGroup[]
}

export type DocManifestSection = {
  id: string
  label: string
  icon: 'rocket' | 'product' | 'architecture' | 'adr' | 'api' | 'reading' | 'devlog' | 'other'
  description?: string
  items?: DocManifestItem[]
  groups?: DocManifestGroup[]
}

export const DOC_SECTIONS: DocManifestSection[] = [
  {
    id: 'getting-started',
    label: '🚀 快速开始',
    icon: 'rocket',
    description: '新用户与开发者的入门指南',
    items: [
      { path: 'README.md', title: '项目总览' },
      { path: 'beginner-guide.md', title: '平台入门指南' },
      { path: 'tutorials/beginner-guide.md', title: '入门教程' },
      { path: 'tutorials/local-first-streaming-demo.md', title: 'Local-First 流式演示' },
    ],
  },
  {
    id: 'product',
    label: '📘 产品与需求',
    icon: 'product',
    description: '产品目标、需求管理与页面流',
    items: [
      { path: 'prd/ai-data-loop-infra-prd.md', title: 'AI Data Loop Infra PRD', hint: '整体产品 PRD' },
      { path: 'prd/requirement-management-system.md', title: '需求管理系统 PRD' },
      { path: 'prd/ui-page-flows-and-platform-interactions.md', title: 'UI 页面流与平台交互' },
    ],
  },
  {
    id: 'architecture',
    label: '🏛 系统架构',
    icon: 'architecture',
    description: '分层、模块、数据与访问层',
    groups: [
      {
        id: 'arch-overview',
        label: '总览与范围',
        items: [
          { path: 'architecture/overview.md', title: '架构总览' },
          { path: 'architecture/mermaid-diagrams.md', title: 'Mermaid 架构图' },
          { path: 'architecture/mvp-scope.md', title: 'MVP 范围' },
          { path: 'architecture/personal-vs-enterprise.md', title: '个人版 vs 企业版' },
          { path: 'architecture/ai-data-platform-gap-map.md', title: '能力 Gap Map' },
        ],
      },
      {
        id: 'arch-domain',
        label: '领域模型',
        items: [
          { path: 'architecture/domain-model.md', title: '领域模型与语义' },
          { path: 'architecture/core-adapters-profiles-workflows.md', title: 'Core · Adapters · Profiles · Workflows' },
          { path: 'architecture/system-directory-and-domain-design.md', title: '系统目录与领域设计' },
        ],
      },
      {
        id: 'arch-layering',
        label: '分层与编排',
        items: [
          { path: 'architecture/layering-and-orchestrator-boundaries.md', title: '分层与编排边界' },
          { path: 'architecture/local-first-streaming-evolution.md', title: 'Local-First 流式演进' },
          { path: 'architecture/build-phisical-dataset-manager-system.md', title: '物理数据集管理系统' },
        ],
      },
      {
        id: 'arch-data',
        label: '数据与集成',
        items: [
          { path: 'architecture/clip-lance-data-model.md', title: 'Clip + Lance 数据模型' },
          { path: 'architecture/fdl-integration.md', title: 'FDL 集成' },
          { path: 'architecture/monorepo-modules.md', title: 'Monorepo 模块划分' },
        ],
      },
      {
        id: 'arch-web',
        label: '前端与访问层',
        items: [
          { path: 'architecture/web-access-layer-bff-architecture.md', title: 'Web 访问层 / BFF 架构' },
          { path: 'architecture/web-microfrontend-tools-platform.md', title: '微前端工具平台' },
        ],
      }
    ],
  },
  {
    id: 'adr',
    label: '🧭 决策 & 路线图',
    icon: 'adr',
    description: '架构决策记录与实施计划',
    items: [
      { path: 'adr/ai-data-platform-roadmap.md', title: 'AI 数据平台路线图' },
      { path: 'adr/implementation-backlog.md', title: '实施 Backlog' },
      { path: 'adr/experience-access-layer-implementation-backlog.md', title: '体验 / 访问层 Backlog' },
    ],
  },
  {
    id: 'api',
    label: '🔌 API 参考',
    icon: 'api',
    description: 'BFF 与 API 契约',
    items: [
      { path: 'api/overview.md', title: 'API 总览' },
    ],
  },
  {
    id: 'reading',
    label: '📚 扩展阅读',
    icon: 'reading',
    description: 'DDIA 读书笔记与延伸思考',
    items: [
      { path: 'ddia2-cognitive-map.md', title: 'DDIA 认知地图' },
      { path: 'ddia2_reading_notes/chapter1_trade_offs.md', title: '第 1 章 · Trade-offs' },
      { path: 'ddia2_reading_notes/chapter2_nonfunctional_requirements.md', title: '第 2 章 · 非功能性需求' },
      { path: 'ddia2_reading_notes/chapter3_data_models_and_query_languages.md', title: '第 3 章 · 数据模型与查询语言' },
      { path: 'ddia2_reading_notes/chapter11_batch_processing.md', title: '第 11 章 · 批处理' },
    ],
  },
  {
    id: 'dev-logs',
    label: '📝 开发日志',
    icon: 'devlog',
    description: '按日期记录每次迭代的改造内容与待办项',
    items: [
      { path: 'dev-logs/README.md', title: '开发日志说明' },
      {
        path: 'dev-logs/2026-04-23-experience-layer-upgrades.md',
        title: '2026-04-23 · 体验层升级',
        hint: 'Requirement / Ops / Pipeline / Docs Center',
      },
    ],
  },
]
