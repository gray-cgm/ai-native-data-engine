# UI / UX 设计

> 父文档：[整体产品 PRD](./ai-data-loop-infra-prd.md)
> 目标读者：前端工程师 + 设计师。本文聚焦**信息架构、页面状态机、组件交互细节、设计 token**。
>
> 旧文档 `ui-page-flows-and-platform-interactions.md` 信息密集但混合了设计 + BFF 数据契约；本次拆分后此处只留 UI/UX 视角，BFF/API 契约见 [API 参考](../api/internal-api.md)。

---

## 1. 信息架构

```
MainLayout
├── 顶栏
│   └── 全局：trace_id 输入 / 当前 profile / 用户菜单
├── 侧边栏 (NavMenu)
│   ├── 🏠 Overview
│   ├── 📋 Requirements
│   ├── 📦 Catalog
│   ├── 🔍 Explorer
│   ├── ⚙️ Operations
│   │     ├─ Mining / Labeling / Tagging / Checking / Release / Exports
│   ├── 🔁 Pipelines
│   ├── 🧰 Tools
│   ├── 📚 Docs
│   └── ⚙️ Settings
└── 主区
    └── PageContainer (title + description? + actions + breadcrumb)
        └── 业务内容（Card / Tabs / Drawer / Modal）
```

## 2. 路由 → 页面对照

| 路由 | 页面 | 主要状态 |
|---|---|---|
| `/` | OverviewPage | 单页：activity feed + KPI |
| `/catalog` | DatasetListPage | tab=Datasets/Scenario · sub-tab=customized/official |
| `/catalog/v2/:datasetId` | DatasetV2DetailPage | metadata + samples 列表 |
| `/catalog/:datasetId` | DatasetDetailPage（旧 scenario 视图） | clip 列表 |
| `/requirements` ｜ `/:id` ｜ `/:id/report` | List / Detail / Report | 列表 / 详情 / 报表 |
| `/data-tasks/:taskId` | DataTaskDetailPage | DataTask 单页 |
| `/explorer` | DistributionPage | 分布看板 |
| `/explorer/search` | SearchPage | 多维过滤 + Table/Wall |
| `/explorer/clips/:clipId` | ClipDetailPage | metadata + Tabs（Video / Topic / Schema） |
| `/ops` | TaskBoardPage | 5 子域综合 |
| `/ops/{module}` | 各模块 List + Drawer | OpsItem CRUD |
| `/ops/exports` | ExportListPage | 导出历史 |
| `/pipelines` | PipelinesPage | 5 Tab |
| `/tools` ｜ `/:toolId` | ToolsHomePage / ToolWorkspacePage | 工具门户 |
| `/docs/*` | DocsViewerPage | 文档中心（splat 单 route） |
| `/settings` | SettingsPage | 用户偏好 |

## 3. 页面状态机（PageState）

所有列表 / 详情统一使用：

```ts
type PageState = 'idle' | 'loading' | 'ready' | 'empty' | 'error'
```

| 状态 | UI 表现 |
|---|---|
| loading | `<PageLoading message="...">` 骨架屏 + 文案 |
| ready | 主内容 |
| empty | `<Empty>` 空态卡 + 创建 CTA |
| error | `<PageError message=... onRetry={...}>` 红条 + 重试 |
| idle | 仅在初始化时短暂出现，立即转 loading |

`useQuery` Hook 自动维护 state，组件按 `state` 分支渲染。

## 4. 关键交互模式

### 4.1 链路上下文穿透（X-Trace-Id）

- URL `?trace=trace_e2e_xxx` → 顶栏显示该 trace 的 Tag
- 任意列表页过滤 `x_trace_id`：当前页的 React Router URL 带这个查询参数
- 列表行的 trace tag 可点击 → 单击仅显示同 trace 条目

### 4.2 Drawer vs Modal 选择

| 场景 | 控件 |
|---|---|
| 行内编辑（多字段、可关闭立即继续） | **Drawer**（右侧 540px） |
| 单一动作（确认 / 一次性输入） | **Modal**（460-640px） |
| 提示 / 警告 | **Alert**（页内） / **message**（toast） |

例：
- 编辑 OpsItem → Drawer
- Save Cut（保存切片）→ Modal
- Promote-to-Official → Modal

### 4.3 时间戳显示

- **clip ts** 一律 ns，UI 显示时同时给 `1763354223671148337` + 格式化日期 + ms 偏移
- **created_at / updated_at** 用 `new Date(...).toLocaleString()`

### 4.4 链路反向跳转

行级 tag（req / dt / trace / scenario / dataset）支持点击跳转：
- `req:xxx` → `/requirements/<id>`
- `dt:xxx` → `/data-tasks/<id>`
- `trace:xxx` → 当前页 URL 加 `?trace=...`（同页过滤）
- `scenario:xxx` → 同页过滤
- `dataset:xxx` → `/catalog/v2/<id>`

## 5. 组件库与设计 token

### 5.1 基础组件库

- **Ant Design 5.x**：所有基础组件（Button / Input / Select / Tabs / Tree / Drawer / Modal / Tag / Alert / Statistic / Card / Table / Descriptions / Empty）
- **自研壳层**：`PageContainer / PageLoading / PageError / DataTable / StatusBadge`
- **图表**：Ant Design Charts（次频）+ 自定义 React 组件（如 ClipProgressBar / VideoTimeline）

### 5.2 颜色 token（与 antd 默认尽量复用）

| 用途 | 颜色 |
|---|---|
| 链路 tag (trace) | `geekblue` |
| 需求 tag (req) | `blue` |
| DataTask tag (dt) | `purple` |
| Scenario tag | `green` |
| Cornercase / hard_case | `orange` |
| 系统 tag | 默认灰 |
| 人工 da_tags | `gold` |
| Status: success / passed | `success` (绿) |
| Status: warning / waived | `warning` (黄) |
| Status: error / failed | `error` (红) |
| 选中行背景 | `#e6f4ff` |
| Hover 行背景 | `#f5f7fa` |

### 5.3 字号

| 用途 | 字号 |
|---|---|
| 页面 H1 | 24px / 600 |
| 卡 title | 16px / 600 |
| 表头 | 13px / 600 |
| 正文 | 13px / 400 |
| 二级说明 | 12px / 400 / `#8b949e` |
| 三级标签 | 11px / 400 / `#8b949e` |

### 5.4 间距

- 卡间距：16px（Row gutter 16）
- 表单 label-control：8px
- 行内 tag：4px gap
- 主区 padding：32px / 48px（左右）

## 6. 复用组件清单

| 组件 | 位置 | 用途 |
|---|---|---|
| `<PageContainer>` | `shared/components/page-container` | 统一页头：title + description + actions + breadcrumb |
| `<PageLoading>` | `shared/components/page-loading` | 加载骨架 |
| `<PageError>` | `shared/components/page-error` | 错误兜底 + 重试 |
| `<DataTable>` | `shared/components/data-table` | 列表页表格薄壳，统一空态 / hover |
| `<StatusBadge>` | `shared/components/status-badge` | 状态颜色映射 |
| `<DatasetPicker>` | `modules/datasets/dataset-picker` | dataset 选择器 + 一键 New |
| `<NewDatasetModal>` | `modules/datasets/new-dataset-modal` | 创建 customized/official |
| `<SaveCutModal>` | `modules/explorer/components/save-cut-modal` | Mark in/out 后保存 |
| `<VideoTimeline>` | `modules/explorer/components/video-timeline` | 富交互时间轴（关键帧 tick + 双手柄） |
| `<ClipProgressBar>` | `modules/explorer/components/clip-progress-bar` | 只读极简进度条（wall + metadata） |
| `<PromoteToOfficialButton>` | `modules/operations/components/promote-to-official-button` | release 行内 promote |
| `<DocsViewerPage>` 内树组件 | `modules/docs/pages/docs-viewer.page` | 文档中心两栏布局 |

## 7. 文档中心交互细节（专项）

- 单 route `/docs/*`，组件不 remount
- 展开态持久化到 `sessionStorage`（key `docs-viewer:expanded-keys:v1`）
- chevron switcher（`RightOutlined` / `DownOutlined`），24px 点击区
- `expandAction="click"`：整行可点
- 文档 item 双行布局：标题 + hint（小字、灰、ellipsis）
- 选中态蓝色背景 + 标题加粗

## 8. 待优化清单

- [ ] 统一 Sidebar / 顶栏 design token，目前各页面字号轻微漂移
- [ ] Empty 状态 illustration 库（图形 vs 纯文字）
- [ ] 暗色模式（antd ConfigProvider）
- [ ] 国际化（目前 zh-CN 硬编码 + 少量英文混合）
- [ ] Mobile 适配（次频，本工作台默认桌面）
- [ ] 键盘快捷键（如 `g+c` 跳 Catalog）
- [ ] toast 集中：当前散布 message.error / message.success / message.info，规范化场景

## 9. 参考

- [Operations 5 子域 PRD](./module-operations.md)
- [Explorer 切割详情](./module-explorer.md)
- [Pipelines 视图](./module-pipelines.md)
- [API 内部契约](../api/internal-api.md)
