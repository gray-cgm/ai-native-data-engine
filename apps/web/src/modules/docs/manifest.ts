/**
 * Curated documentation manifest.
 *
 * 按读者画像组织（不是按目录结构）。维护时遵循 MECE 原则：
 * - 快速开始 → 入门教程 + E2E Demo
 * - 产品与需求 → 整体 PRD + 6 模块子 PRD + 用户指南 + UI/UX
 * - 系统架构 → 总览 / 领域模型 / 业务流程 / 系统分层（四组互斥穷尽）
 * - 决策 & 路线图 → ADR + tech selection
 * - API 参考 → 总览 + 内部 + 外部
 * - 扩展阅读 / 开发日志（保持原状）
 */

export type DocManifestItem = {
  /** POSIX-style path relative to the /docs root. */
  path: string
  /** Override title. If omitted, the file's first H1 is used. */
  title?: string
  /** Short hint shown under the title. */
  hint?: string
  /** Optional sub-items (e.g. detailed sub-PRD nested under a module PRD). */
  children?: DocManifestItem[]
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
    description: '新人 / PM / 工程师入门',
    items: [
      { path: 'README.md', title: '项目总览', hint: '所有文档的入口索引' },
      { path: 'tutorials/beginner-guide.md', title: '入门教程', hint: '1 小时跑通本地环境' },
      {
        path: 'tutorials/onboarding.md',
        title: '新手指南',
        hint: '7步demo，按系统分层从下到上，每步独立可跑、注释密集、便于调试',
      },
      {
        path: 'tutorials/e2e-demo.md',
        title: 'E2E Demo 演示',
        hint: '从 Requirement 到 official Dataset 的 9 步全链路',
      },
    ],
  },
  {
    id: 'product',
    label: '📘 产品与需求',
    icon: 'product',
    description: '产品定位、模块需求、用户指南、UI/UX',
    groups: [
      {
        id: 'product-overall',
        label: '整体 PRD',
        items: [
          {
            path: 'prd/ai-data-loop-infra-prd.md',
            title: '整体产品 PRD',
            hint: '产品全景图 / 定位 / 路线图',
          },
        ],
      },
      {
        id: 'product-modules',
        label: '六大模块子 PRD',
        items: [
          { path: 'prd/module-catalog.md', title: 'Catalog', hint: '数据集目录 + customized/official Tab + Promote' },
          {
            path: 'prd/module-requirement.md',
            title: 'Requirement',
            hint: '需求 + Sign-off + 4 层闭环',
            children: [
              {
                path: 'prd/requirement-management-system.md',
                title: '需求管理系统 PRD（详版）',
                hint: '字段级详细规格',
              },
            ],
          },
          { path: 'prd/module-explorer.md', title: 'Explorer', hint: 'Clip 检索 / 详情 / 灵活切割（Lance ns 时间轴）' },
          { path: 'prd/module-operations.md', title: 'Operations', hint: 'Mining / Labeling / Tagging / Checking / Release' },
          { path: 'prd/module-pipelines.md', title: 'Pipelines', hint: '运行 / 血缘 / 质量 / 成本 5 Tab' },
          { path: 'prd/module-tools.md', title: 'Tools', hint: '微前端工具平台 + iframe 网关' },
        ],
      },
      {
        id: 'product-usage-design',
        label: '使用与设计',
        items: [
          { path: 'prd/user-guide.md', title: '产品使用说明', hint: '按角色（算法 / DRE / 标注 / 运维 / 管理员）的操作路径' },
          { path: 'prd/ui-ux-design.md', title: 'UI / UX 设计', hint: '信息架构 / 状态机 / 设计 token / 复用组件' },
          {
            path: 'prd/ui-page-flows-and-platform-interactions.md',
            title: 'UI 页面流与平台交互（历史详版）',
            hint: '字段级 item 设计 + 时序图，与 UI/UX 互补',
          },
        ],
      },
    ],
  },
  {
    id: 'architecture',
    label: '🏛 系统架构',
    icon: 'architecture',
    description: 'MECE 四组：总览 / 领域模型 / 业务流程 / 系统分层',
    groups: [
      {
        id: 'arch-overview',
        label: '① 架构总览',
        items: [
          { path: 'architecture/overview.md', title: '架构总览', hint: '核心抽象 + 业务流程 + 系统分层入口' },
          { path: 'architecture/mermaid-diagrams.md', title: 'Mermaid 架构图' },
          { path: 'architecture/mvp-scope.md', title: 'MVP 范围' },
          { path: 'architecture/personal-vs-enterprise.md', title: '个人版 vs 企业版' },
          { path: 'architecture/ai-data-platform-gap-map.md', title: '能力 Gap Map' },
        ],
      },
      {
        id: 'arch-domain',
        label: '② 领域模型',
        items: [
          {
            path: 'architecture/glossary-dataset-scenario-cornercase-tag-label.md',
            title: '术语澄清',
            hint: 'Dataset / Scenario / Cornercase / Tag / Label 五个易混名词',
          },
          { path: 'architecture/domain-model.md', title: '领域模型与语义' },
          {
            path: 'architecture/dataset-design.md',
            title: 'Dataset + Snowflake 设计',
            hint: 'customized / official 提级 / Asset / LineageEvent',
          },
          { path: 'architecture/core-adapters-profiles-workflows.md', title: 'Core / Adapters / Profiles / Workflows 分层' },
          { path: 'architecture/system-directory-and-domain-design.md', title: '系统目录与领域设计' },
        ],
      },
      {
        id: 'arch-flows',
        label: '③ 业务流程（水平分段）',
        items: [
          {
            path: 'architecture/business-flows.md',
            title: '业务流程总览',
            hint: '5 阶段：需求 / 数据筹备 / 加工 / 数据集生产 / 交付与回流',
          },
          { path: 'architecture/layering-and-orchestrator-boundaries.md', title: '分层与编排边界' },
          { path: 'architecture/local-first-streaming-evolution.md', title: 'Local-First 流式演进' },
          { path: 'architecture/build-phisical-dataset-manager-system.md', title: '物理数据集管理系统' },
        ],
      },
      {
        id: 'arch-layers',
        label: '④ 系统分层（六层 + 一正交）',
        items: [
          {
            path: 'architecture/system-layers.md',
            title: '系统分层总览',
            hint: '文件 / 存储 / 湖表 / 计算 / 查询 / 应用 + 元数据',
          },
          { path: 'architecture/clip-lance-data-model.md', title: 'Clip + Lance 数据模型', hint: '① 文件格式层' },
          { path: 'architecture/fdl-integration.md', title: 'FDL 集成', hint: '③ 湖表格式层' },
          { path: 'architecture/monorepo-modules.md', title: 'Monorepo 模块划分', hint: '⑥ 应用层' },
          { path: 'architecture/web-access-layer-bff-architecture.md', title: 'Web 访问层 / BFF 架构', hint: '⑥ 应用层' },
          { path: 'architecture/web-microfrontend-tools-platform.md', title: '微前端工具平台', hint: '⑥ 应用层' },
        ],
      },
    ],
  },
  {
    id: 'adr',
    label: '🧭 决策 & 路线图',
    icon: 'adr',
    description: '架构决策、技术选型、实施 backlog',
    items: [
      { path: 'adr/ai-data-platform-roadmap.md', title: 'AI 数据平台路线图' },
      {
        path: 'adr/tech-selection-datafusion-opendal.md',
        title: '技术选型：DataFusion / OpenDAL',
        hint: '查询引擎 + 存储抽象层升级评审',
      },
      {
        path: 'adr/adr-pipelinerun-unified-fact-model.md',
        title: 'ADR · PipelineRun 统一事实模型',
        hint: 'x_trace_id 串通四层闭环',
      },
      { path: 'adr/implement_blacklog.md', title: '实施 Backlog（统一规划）' },
      { path: 'adr/implementation-backlog.md', title: '实施 Backlog（历史 v1）', hint: 'Claude Code 实施计划早期版本' },
      { path: 'adr/experience-access-layer-implementation-backlog.md', title: '体验 / 访问层 Backlog' },
    ],
  },
  {
    id: 'api',
    label: '🔌 API 参考',
    icon: 'api',
    description: '内部 web/bff/api + 外部 API/SDK',
    items: [
      { path: 'api/overview.md', title: 'API 总览', hint: '三类 API 边界 + 端口 + 通用约定' },
      {
        path: 'api/internal-api.md',
        title: '内部 API：Web ↔ BFF ↔ Platform API',
        hint: '路由清单 + ViewModel + 中间件',
      },
      {
        path: 'api/external-api-sdk.md',
        title: '外部 API & SDK 使用说明',
        hint: '算法工程师消费 dataset / sample / asset 的标准路径',
      },
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
      { path: 'ddia2_reading_notes/chapter12_streaming_processing.md', title: '第 12 章 · 流处理' },
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
        path: 'dev-logs/2026-04-29-docs-reorganization.md',
        title: '2026-04-29 · 文档与 Web Docs Center 整体梳理',
        hint: '快速开始 / PRD 模块化 / 架构 MECE / API 拆分 / Mermaid 全屏 / task list 对齐',
      },
      {
        path: 'dev-logs/2026-04-28-snowflake-event-and-flexible-cut.md',
        title: '2026-04-28 · Snowflake + Catalog/Release 工作流 + Asset',
        hint: 'customized→official 提级 / Catalog 双视图 / VideoTimeline 改 ns / Asset',
      },
      {
        path: 'dev-logs/2026-04-28-e2e-demo-and-snapshot-manifest.md',
        title: '2026-04-28 · E2E Demo and Snapshot Manifest',
      },
      {
        path: 'dev-logs/2026-04-23-experience-layer-upgrades.md',
        title: '2026-04-23 · 体验层升级',
      },
    ],
  },
]
