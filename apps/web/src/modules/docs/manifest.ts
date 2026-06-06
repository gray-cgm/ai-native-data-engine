/**
 * Curated documentation manifest.
 *
 * 按读者画像组织（不是按目录结构）。维护时遵循 MECE 原则：
 * - 快速开始 → 入门教程 + E2E Demo
 * - 产品与需求 → 整体 PRD + 6 模块子 PRD + 用户指南 + UI/UX
 * - 系统架构 → 总览 / 领域模型 / 业务流程 / 系统分层与代码组织（四组互斥穷尽）
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
          {
            path: 'architecture/mvp-scope.md',
            title: 'MVP 范围',
            hint: '当前阶段做 / 不做的边界',
          },
        ],
      },
      {
        id: 'product-modules',
        label: '业务模块子 PRD',
        items: [
          {
            path: 'prd/module-overview.md',
            title: '① Overview · 综合首页 Dashboard',
            hint: 'Role-based 一屏（Manager / DE / MLE 三段 + 北极星）—— 平台综合入口，非业务领域模块',
          },
          {
            path: 'prd/module-requirement.md',
            title: '② Requirement · 需求起点',
            hint: '需求 + Sign-off → 拆 6 类 DataTask（4 层闭环对象的入口）',
            children: [
              {
                path: 'prd/requirement-management-system.md',
                title: '需求管理系统 PRD（详版）',
                hint: '字段级详细规格',
              },
            ],
          },
          {
            path: 'prd/module-explorer.md',
            title: '③ Explorer · 数据挖掘',
            hint: 'Clip 检索 / 详情 / 灵活切割（Lance ns 时间轴）',
          },
          {
            path: 'prd/module-operations.md',
            title: '④ Operations · 人机协同执行(human in the loop)',
            hint: 'Mining / Tagging / Labeling / Checking / Privacy / Release 6 子域',
          },
          {
            path: 'prd/module-pipelines.md',
            title: '⑤ Pipelines · 机器执行观测',
            hint: 'PipelineRun 5 Tab：运行 / 血缘 / 质量 / 成本 / 总览',
          },
          {
            path: 'prd/module-catalog.md',
            title: '⑥ Catalog · 数据集沉淀',
            hint: 'customized → official Promote · 双 Tab 目录',
          },
          {
            path: 'prd/module-exports.md',
            title: '⑦ Exports · 数据交付与训练反馈',
            hint: '出仓 + dlkit SDK + Hard Sample / ROI 闭环回流',
          },
          {
            path: 'prd/module-tools.md',
            title: '⑧ Tools · 工具平台',
            hint: '微前端 + iframe 网关嵌入第三方/内部子工具',
          },
        ],
      },
      {
        id: 'product-usage-design',
        label: '使用与设计',
        items: [
          { path: 'prd/user-guide.md', title: '产品使用说明', hint: '按角色（算法 / DRE / 标注 / 运维 / 管理员）的操作路径' },
          { path: 'prd/ui-ux-design.md', title: 'UI / UX 设计', hint: '信息架构 / 状态机 / 设计 token / 复用组件' },
          {
            path: 'prd/logo-design.md',
            title: 'Logo 设计',
            hint: '铲子 + 飞轮 + AI 节点：数据闭环的视觉叙事',
          },
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
    description: 'MECE 四组：总览 / 领域模型 / 业务流程 / 系统分层与代码组织',
    groups: [
      {
        id: 'arch-overview',
        label: '① 架构总览',
        items: [
          { path: 'architecture/overview.md', title: '架构总览', hint: '核心抽象 + 业务流程 + 系统分层入口' },
          { path: 'architecture/mermaid-diagrams.md', title: 'Mermaid 架构图', hint: '关键拓扑可视化' },
        ],
      },
      {
        id: 'arch-domain',
        label: '② 领域模型',
        items: [
          {
            path: 'architecture/glossary-dataset-scenario-cornercase-tag-label.md',
            title: '术语澄清',
            hint: 'Dataset / Scenario / Cornercase / Tag / Label 五个易混名词 + 全部域对象索引',
          },
          { path: 'architecture/domain-model.md', title: '领域模型与语义', hint: '对象 / 字段 / 关系矩阵' },
          {
            path: 'architecture/dataset-design.md',
            title: 'Dataset + Snowflake 设计',
            hint: 'customized / official 提级 / Asset / LineageEvent',
          },
          {
            path: 'architecture/tags-design.md',
            title: 'Tags 设计',
            hint: '人工 + 自动 + 算法版本；clip_tags 关系表',
          },
        ],
      },
      {
        id: 'arch-flows',
        label: '③ 业务流程',
        items: [
          {
            path: 'architecture/business-flows.md',
            title: '业务流程总览',
            hint: '5 阶段：需求 / 数据筹备 / 加工 / 数据集生产 / 交付与回流',
          },
          {
            path: 'architecture/local-first-streaming-evolution.md',
            title: 'Local-First 流式演进',
            hint: '本地 demo → 团队 → 企业三阶段',
          },
          {
            path: 'architecture/build-phisical-dataset-manager-system.md',
            title: '物理数据集管理系统',
            hint: '物理资产生命周期',
          },
        ],
      },
      {
        id: 'arch-layers',
        label: '④ 系统分层与代码组织',
        items: [
          {
            path: 'architecture/system-layers.md',
            title: '系统分层总览',
            hint: '六层模型：文件 / 存储 / 湖表 / 计算 / 查询 / 应用 + 元数据正交',
          },
          {
            path: 'architecture/clip-lance-data-model.md',
            title: 'Clip + Lance 数据模型',
            hint: '① 文件格式层落位',
          },
          {
            path: 'architecture/fdl-integration.md',
            title: 'FDL 集成',
            hint: '③ 湖表格式层与服务分解的对照',
          },
          {
            path: 'architecture/core-adapters-profiles-workflows.md',
            title: 'Core / Adapters / Profiles / Workflows',
            hint: 'python/ 四层职责与判定标准',
          },
          {
            path: 'architecture/layering-and-orchestrator-boundaries.md',
            title: '分层与编排边界',
            hint: 'python/workflows ⇄ apps/orchestrator 边界 + PR checklist',
          },
          {
            path: 'architecture/system-directory-and-domain-design.md',
            title: '系统目录与代码蓝图',
            hint: 'monorepo 目录树 + 领域对象建议落位',
          },
          {
            path: 'architecture/monorepo-modules.md',
            title: 'Monorepo 模块划分',
            hint: 'apps / packages / python / sdk / infra 模块清单',
          },
          {
            path: 'architecture/web-access-layer-bff-architecture.md',
            title: 'Web 访问层 / BFF 架构',
            hint: '⑥ 应用层：浏览器接入与 ViewModel 聚合',
          },
          {
            path: 'architecture/web-microfrontend-tools-platform.md',
            title: '微前端工具平台',
            hint: '⑥ 应用层：iframe 网关 + 工具子应用',
          },
        ],
      },
    ],
  },
  {
    id: 'adr',
    label: '🧭 决策 & 路线图',
    icon: 'adr',
    description: '架构决策、能力差距、技术选型、实施 backlog',
    items: [
      { path: 'adr/ai-data-platform-roadmap.md', title: 'AI 数据平台路线图', hint: '阶段目标 / 优先级 / 演进策略' },
      {
        path: 'architecture/ai-data-platform-gap-map.md',
        title: '能力 Gap Map',
        hint: 'P0 / P1 / P2 能力清单与缺口（与路线图配套）',
      },
      {
        path: 'architecture/personal-vs-enterprise.md',
        title: '个人版 vs 企业版',
        hint: '从本地 MVP 演进到团队 / 企业版的路径',
      },
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
        path: 'dev-logs/2026-06-07-ci-test-coverage-gates.md',
        title: '2026-06-07 · CI 接入三层测试 + 覆盖率门禁 + 报告 artifact',
        hint: 'GitHub Actions 4 job (api/bff/web/integration) / pytest --cov-fail-under + vitest thresholds 80% / pnpm 8 匹配 lockfile v6.0 / MinIO service container',
      },
      {
        path: 'dev-logs/2026-06-06-web-bff-api-test-coverage.md',
        title: '2026-06-06 · web / bff / api 三层测试补齐至 ≥80% 覆盖率',
        hint: 'api 92% (pytest+TestClient 21 路由) / bff 96.1% (vitest+supertest) / web 80.83% (vitest+RTL) / 三 subagent 并行 / 零改生产代码 / 查出 4 处问题',
      },
      {
        path: 'dev-logs/2026-06-06-opendal-usecases-and-test-baseline.md',
        title: '2026-06-06 · OpenDAL 三大用例落地 + 测试基线建立',
        hint: 'clips 视频 range read 走 storage / dataset 导出 publish_export / docker minio + team-dev opendal-s3 / pytest unit+integration+报告 / test-expert subagent / CLAUDE.md 测试规范',
      },
      {
        path: 'dev-logs/2026-06-06-opendal-storage-adapter.md',
        title: '2026-06-06 · OpenDAL 接管 StorageAdapter（Phase 1：新增 + 共存）',
        hint: 'OpenDALStorageAdapter 实装 / 与 local_fs·s3 共存 / profile provider:opendal 装配 / fs contract parity / 一套配置切 s3·oss·gcs',
      },
      {
        path: 'dev-logs/2026-05-04-exports-impl-and-ui-overhaul.md',
        title: '2026-05-04 · Exports MVP P0~P2 全实装 / UI 交互拉直 / Overview 重写 / 场景多样化',
        hint: 'dlkit SDK + Hard Sample / ROI / Contributions / clickable-row + IdCell / Role-based Dashboard 配色分段 / 9 类真实 ADAS 场景',
      },
      {
        path: 'dev-logs/2026-05-04-exports-sample-contribution-design.md',
        title: '2026-05-04 · 数据 ROI 价值链条 · Exports 模块 + Sample Contribution 设计稿',
        hint: '设计稿（PRD + Architecture）：分层边界 / 编排能力 / 算法贡献样本回流平台',
      },
      {
        path: 'dev-logs/2026-05-03-docs-manifest-and-logo.md',
        title: '2026-05-03 · 文档目录重排 + Logo 上线 + 待办框样式修复',
        hint: '架构 4 组 MECE 重排 / mvp-scope 跨节迁 / Logo 设计 + favicon / GFM checkbox CSS',
      },
      {
        path: 'dev-logs/2026-05-02-tasktype-and-layering-cleanup.md',
        title: '2026-05-02 · TaskType 重构 + 分层边界落地 + Mermaid 升级',
        hint: 'TaskType 加 MINING / 删 PIPELINE → RELEASE；删除 python/services；Mermaid pan-zoom',
      },
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
