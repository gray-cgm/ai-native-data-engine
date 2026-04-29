# 2026-04-29 · 文档与 Web Docs Center 整体梳理

## 背景

之前 `docs/` 目录树是按"内部目录组织"沉淀下来的，导致：

- 入门有两份高度重叠的"beginner guide"（`docs/beginner-guide.md` + `docs/tutorials/beginner-guide.md`），新人 confused
- "Local-First 流式演示"作为快速开始入口已落伍——E2E Demo 才是真正的 Hello World
- 整体 PRD 偏文字，缺少图表
- 6 大产品模块没有独立 PRD，全堆在大 PRD 里
- 没有面向最终用户的"产品使用说明"
- 「UI 页面流与平台交互」混合了 UI/UX + BFF 数据契约，前端工程师读起来不聚焦
- 系统架构按目录散布，缺少 MECE 顶层骨架
- 「DataFusion / OpenDAL 技术选型」错放在 architecture 下，应归 ADR
- API 文档单页，未区分内部 vs 外部消费
- Dataset 设计文档保留大量"重构 / v1 v2 v3 / 二次三次修订"演进语，对新读者不友好
- Web Docs Center 还有几个交互问题：mermaid 框内截断、待办列表错位、点击文章触发 tree 折叠、folder 切换图标小

## 本次改动

### 1. 文档结构整体梳理

**快速开始**

- 删除：`docs/beginner-guide.md`（与 tutorials/beginner-guide 重复）
- 新增：`docs/tutorials/e2e-demo.md`（9 步全链路教程：环境 → 跑 demo → 算法工程师消费命令 → trace 验证 → FAQ）
- 删除：`docs/tutorials/local-first-streaming-demo.md`（落伍）
- 重写 `docs/README.md` 为完整索引（按读者画像组织，54 条文档全收录）

**产品与需求**

- 在整体 PRD `prd/ai-data-loop-infra-prd.md` 顶部加 §0 全景图：4 张 Mermaid（产品定位、数据闭环、演进路线、六大模块）+ 子文档导航
- 新增 6 个模块子 PRD：
  - `prd/module-catalog.md`
  - `prd/module-requirement.md`
  - `prd/module-explorer.md`
  - `prd/module-operations.md`
  - `prd/module-pipelines.md`
  - `prd/module-tools.md`
- 新增 `prd/user-guide.md`：按角色（算法 / DRE / 标注 / 运维 / 管理员）分场景操作路径
- 新增 `prd/ui-ux-design.md`：信息架构 / 路由表 / 状态机 / 设计 token / 复用组件清单（前端工程师向）
- 旧 `prd/ui-page-flows-and-platform-interactions.md` 标"历史详版"保留

**系统架构（MECE 四组）**

- `architecture/overview.md` 顶部插入「三视角看清架构」
- 新增 `architecture/business-flows.md`：5 阶段水平分段（需求 / 数据筹备 / 加工 / 数据集生产 / 交付与回流）+ 横切关注点
- 新增 `architecture/system-layers.md`：六层（文件 / 存储 / 湖表 / 计算 / 查询 / 应用）+ 元数据正交层
- manifest 把 architecture 重组为 4 组：① 架构总览 / ② 领域模型 / ③ 业务流程 / ④ 系统分层
- 删除 `architecture/dataset-domain-model.md`（v1 历史快照）
- 重命名 `architecture/dataset-snowflake-redesign.md` → `architecture/dataset-design.md`，全文清理"v3 / 重构 / 二次/三次修订 / 新增"等演进语
- 把 `architecture/tech-selection-datafusion-opendal.md` 物理移到 `adr/`

**API 参考**

- 重写 `api/overview.md`：三类 API 边界 + 端口 + 通用约定
- 新增 `api/internal-api.md`：BFF 路由清单（按 8 业务域分组）+ ViewModel 职责 + Web 调用约定
- 新增 `api/external-api-sdk.md`：算法工程师消费 Dataset 标准 4 路径 + 资源 CRUD 完整端点 + 兼容性 + 实战示例

### 2. Web Docs Center 交互优化

**Mermaid 框**（`apps/web/src/modules/docs/components/mermaid-block.tsx` + css）

- mermaid 配置 `flowchart.useMaxWidth: false`，输出原始尺寸 SVG，避免被父容器强压
- viewport 改 `max-height: 70vh; overflow: auto`，超长图横向 / 纵向滚动
- 右上角加全屏按钮（hover 显现），点击弹 92vw / 85vh Modal 全屏查看
- 每次 render 用独立随机 id，避免 mermaid 缓存导致空白

**任务列表错位**（`docs-viewer.css`）

- 给 `.contains-task-list` + `.task-list-item` 加 flex 对齐
- `<input type=checkbox>` 改 `margin: 5px 0 0 0` + `flex-shrink: 0`，与文字 baseline 对齐
- 嵌套 `<p>` 去 margin，`flex: 1` 撑开

**树折叠 / 切换交互**（前次迭代已修，本次复述）

- 路由 `/docs/*` 单 splat，组件不 remount
- `expandedKeys` 持久化到 sessionStorage（key `docs-viewer:expanded-keys:v1`）
- chevron switcher（24px 点击区） + `expandAction="click"` 整行可点
- item 双行布局（标题 + hint），ellipsis + tooltip 兜底

**manifest 嵌套支持**

- `DocManifestItem` 增加 `children?: DocManifestItem[]`
- `CuratedItem` 同步增加 `children?`
- `mapItem` / `filterItems` / `countFiles` 全部递归 children
- `itemNode` 在有 children 时返回非 leaf 节点（仍 selectable，可点击打开自身）

### 3. 子项收纳

`prd/requirement-management-system.md`（详版）从「六大模块子 PRD」顶层移到 `module-requirement.md` 的 children 下；六大模块顶层节点固定 6 个，详版作为可展开子项。

### 4. v3 表述清理（应你要求）

读者不需要知道演进历史。清理以下文件中的版本演进语：

- `docs/architecture/dataset-design.md`：删除 §一 "为什么要重构"，改为 §一 核心设计原则；删除 §"迁移/实施顺序"；§7 删除 "(2026-04-28 三次修订补丁)" 注脚；§4.4 时间戳来源说明删除 "(v3, 三次修订)"
- `docs/architecture/glossary-...md`：Dataset (v3) → Dataset；"v3 Snowflake 设计的核心结论" → "Snowflake 设计的核心结论"。模型版本相关示例（`hard_case_v1` / `v3 模型攻克 v2 cornercase`）保留——那是领域语义，不是设计版本
- `docs/prd/module-pipelines.md`：删除 (v3) (v3 新增) 注脚
- `docs/prd/module-catalog.md` / `docs/api/external-api-sdk.md` / `docs/tutorials/e2e-demo.md` / `docs/architecture/business-flows.md` / `docs/api/internal-api.md` / `docs/README.md`：链接 / 标题里的 "重构 v3" 全部去掉

## 验证

- 文档完整性：磁盘 54 条 md ↔ manifest 54 条引用，零游离零缺失
- Web `tsc --noEmit` 通过
- mermaid block 在桌面 Chrome / Firefox / Safari 视窗 1280px / 1920px 下正常展开 / 全屏

## 待办

- [ ] mermaid 全屏 modal 内加滚轮缩放（pinch-zoom 或 button + transform: scale）
- [ ] 文档左侧 tree 加层级折叠记忆 ttl 策略（防止 sessionStorage 累积）
- [ ] 把 ddia 笔记按章节链跳转到对应架构文档（互相引用）

## 已知约束

- mermaid `useMaxWidth: false` 让大图原始输出，部分极宽流程图在 sidebar 收起后才好看；建议作者画图时控制节点数 ≤ 12 / 行
- requirement-management-system.md 详版字段表保留，但模块 PRD 是新一代，遇冲突以模块 PRD 为准
