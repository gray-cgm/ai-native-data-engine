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

### 4.0 交互可感知性（Interactive Affordance）—— 极简原则

> **干净 + 可用 + 可复制**。MVP 阶段不堆装饰：行 hover 才出现底色、id 带原位 copy、表格行高紧凑。

#### 4.0.1 可点区域的 3 状态

| 类型 | rest | hover | active / selected |
|---|---|---|---|
| **clickable-row** | 与普通行视觉一致；进入 row 区域显 cursor:pointer | 行底色 `--interactive-bg-hover` + 行内 link 下划线 | active 行底色 `--interactive-bg-active`；当前 drawer 打开的行加 `.clickable-row--selected` 显 `--interactive-bg-selected` |
| **clickable-card** | 普通边框 | bg + 边框 accent + `--interactive-shadow-hover` | bg 变深 / selected |
| **clickable-chip** | 普通 Tag | brightness(0.92) + accent 1px outline | — |

`:focus-visible` 一律 `outline: 2px solid accent` + `outline-offset: 2px`，键盘可达必给。

**故意不做**：
- ❌ 行左侧蓝色 / 灰色 accent 竖条（视觉噪音、表格已经够密）
- ❌ rest 状态加 bg-tint（"看起来像被选中了"的误报）
- ❌ hover 加阴影（行级元素只用底色变化，避免布局抖动）

#### 4.0.2 密度（高信息密度表格）

DataTable 默认 `size="small"` + 自定义 padding `6px 10px`（cell）/ `8px 10px`（th）。**不要在业务代码里再传 size**——用全局默认。

#### 4.0.3 Token（[`apps/web/src/styles/tokens.css`](../../apps/web/src/styles/tokens.css)）

```css
--interactive-bg-rest:      transparent;
--interactive-bg-hover:     rgba(22, 119, 255, 0.06);
--interactive-bg-active:    rgba(22, 119, 255, 0.12);
--interactive-bg-selected:  rgba(22, 119, 255, 0.10);
--interactive-border-hover: var(--color-accent);
--interactive-shadow-hover: 0 1px 6px rgba(22, 119, 255, 0.15);
--focus-outline:            2px solid var(--color-accent);
--focus-outline-offset:     2px;
--interactive-transition:   background 120ms, box-shadow 120ms, border-color 120ms;
```

**禁止内联 `style={{ cursor: 'pointer' }}`**——用 `.clickable-*` class 或 DataTable 的 `rowHref` / `onRowClick` props。

#### 4.0.4 ID 列：必须带原位复制

凡 id（UUID / `x_trace_id` / `dataset_id` / `clip_id` / `run_id` / artifact URI 等）出现在表格 cell 或 Description 里，**必须用 [`<IdCell>`](../../apps/web/src/shared/components/id-cell.tsx)**：

```tsx
<IdCell value={row.x_trace_id} />                           // short：8 字头 + …
<IdCell value={row.x_trace_id} head={12} />                 // 自定义截断长度
<IdCell value={row.clip_id} variant="mono-ellipsis" maxWidth={240} />  // 表格内：CSS ellipsis
<IdCell value={data.dataset_id} variant="full" />           // Description / 单卡：全显示
```

IdCell 自带：
- 截断显示（避免列宽爆炸）
- Tooltip 浮层显全（300ms 延迟，鼠标停留才出）
- antd `Typography.copyable` 复制按钮（始终可见）+ 复制完反馈
- `data-stop-row-click` 属性，避免触发外层行点击

**禁止做的事**：
- ❌ 在表格里写 `<Text code>{id}</Text>` / `<span style={{fontFamily:monospace}}>...slice(0,16)</span>`——用 IdCell
- ❌ 在 ID 旁边再额外写一遍"复制"按钮——IdCell 自带

#### 4.0.5 共享 API：[`<DataTable>`](../../apps/web/src/shared/components/data-table.tsx)

```tsx
<DataTable
  rowHref={(row) => `/catalog/v2/${row.id}`}      // 主导航：cmd/ctrl/middle-click 新标签自动支持
  // 或 onRowClick={(row) => openDrawer(row.id)}  // 抽屉打开类
  isRowSelected={(row) => row.id === selectedId}  // 当前选中态（可选）
  ...
/>
```

DataTable 自动加 `.clickable-row` + `tabIndex=0` + Enter/Space 键盘触发；click 落在 `<a>` / `<button>` / `[data-stop-row-click]` 上不冒泡。

| 目标 | 用 |
|---|---|
| 跳到另一个页面 | **`rowHref`** |
| 同页打开 Drawer / Modal | **`onRowClick`** |
| 行内有多个 link / button 各做不同事 | 都不传，保留只读表格 + 行内按钮各自带显式 affordance |

#### 4.0.6 button 等级（每页硬上限）

| 级别 | antd `type` | 用法 | 同页上限 |
|---|---|---|---|
| **Primary** | `primary` | 当前页唯一 main CTA（Create / Promote / Submit） | **1** |
| **Secondary** | `default` | 与 primary 平级但更次要（Reset / Export） | 3 |
| **Tertiary** | `link` | 行内反向跳转、breadcrumb、小动作 | 不限，不堆叠 |
| **Danger** | `primary` + `danger` | 不可逆破坏（Delete / Drop） | 1，必带二次确认 |
| **Icon-only** | 任意 + `icon=` | 必须 `<Tooltip>` 包裹 | 不限 |

**不要**：3 个并排同色 primary / icon-only 没 tooltip / 同一行又 link 又 button 又 link。

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
| `<DataTable>` | `shared/components/data-table` | 列表页表格薄壳：可传 `rowHref` / `onRowClick` / `isRowSelected`，自动套 `.clickable-row` + 键盘可达 + `size="small"` |
| `<IdCell>` | `shared/components/id-cell` | id 列原位 copy + tooltip 显全（variant: `short` / `mono-ellipsis` / `full`） |
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

- [ ] 把剩余直接用 antd `<Table>`（未走 `<DataTable>`）的页面也接 `clickable-row`：
      `runs-view`、`snapshots-view`、`requirements-detail` 各 Drawer 内表
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
