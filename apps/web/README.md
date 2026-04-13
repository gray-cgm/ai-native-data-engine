# AI Native Data Engine — Web Frontend

> 🏗️ 基于 React + Vite + TypeScript 的自动驾驶数据闭环工作台前端

## 目录

- [技术栈](#技术栈)
- [快速启动](#快速启动)
- [项目结构](#项目结构)
- [架构总览](#架构总览)
- [路由与页面](#路由与页面)
- [模块详解](#模块详解)
- [布局系统](#布局系统)
- [共享组件库](#共享组件库)
- [数据获取与状态管理](#数据获取与状态管理)
- [样式系统](#样式系统)
- [API 契约](#api-契约)
- [开发约定](#开发约定)

---

## 技术栈

| 类别 | 选型 | 版本 |
|------|------|------|
| UI 框架 | React | ^18.3 |
| 路由 | React Router DOM | ^7.14 |
| 构建工具 | Vite | ^5.4 |
| 语言 | TypeScript (strict) | ^5.8 |
| 内部包 | @ad-engine/schemas | workspace:* |

> 无 Redux/Zustand 等外部状态库，使用纯 React Hooks 管理状态。

---

## 快速启动

```bash
# 安装依赖（在 monorepo 根目录）
pnpm install

# 启动开发服务器 (http://localhost:3000)
pnpm --filter @ad-engine/web dev

# 类型检查
pnpm --filter @ad-engine/web typecheck

# 生产构建
pnpm --filter @ad-engine/web build
```

---

## 项目结构

```
apps/web/
├── index.html                        # HTML 入口
├── package.json                      # 依赖与脚本
├── tsconfig.json                     # TypeScript 配置 (strict, ESNext)
├── vite.config.ts                    # Vite 配置 (@ → src/ 别名)
└── src/
    ├── main.tsx                      # 应用挂载入口
    ├── app.tsx                       # 顶层组件 (Router, ErrorBoundary, Bootstrap)
    ├── routes.tsx                    # 路由定义 (lazy loading)
    │
    ├── modules/                      # ★ 业务模块（按领域划分）
    │   ├── overview/                 #   总览仪表盘
    │   │   ├── pages/
    │   │   ├── components/
    │   │   └── index.ts
    │   ├── catalog/                  #   数据集目录
    │   │   ├── pages/
    │   │   ├── api.ts
    │   │   └── index.ts
    │   ├── explorer/                 #   数据探索
    │   │   ├── pages/
    │   │   ├── components/
    │   │   ├── api.ts
    │   │   └── index.ts
    │   ├── operations/               #   运维任务
    │   │   ├── pages/
    │   │   ├── api.ts
    │   │   └── index.ts
    │   └── pipelines/                #   流水线
    │       ├── pages/
    │       ├── api.ts
    │       └── index.ts
    │
    ├── shared/                       # ★ 共享层
    │   ├── api/client.ts             #   HTTP 客户端
    │   ├── components/               #   通用 UI 组件
    │   ├── hooks/                    #   自定义 Hooks
    │   ├── layouts/                  #   布局组件
    │   │   ├── main-layout.tsx
    │   │   ├── nav-config.ts
    │   │   └── components/
    │   └── types/common.ts           #   共享类型定义
    │
    ├── pages/                        # 旧版页面 (已迁移到 modules)
    └── styles/                       # ★ 全局样式
        ├── tokens.css                #   设计令牌
        ├── reset.css                 #   全局重置
        ├── main-layout.css           #   主布局样式
        ├── layout-header.css
        ├── layout-sidebar.css
        ├── layout-micro-menu.css
        ├── layout.css
        └── styles.css
```

---

## 架构总览

```
┌──────────────────────────────────────────────────────────────┐
│                        index.html                            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  main.tsx  →  App  →  BrowserRouter                    │  │
│  │                        ├── ErrorBoundary               │  │
│  │                        ├── BootstrapGuard (/bootstrap) │  │
│  │                        └── Suspense                    │  │
│  │                            └── routes.tsx (lazy)       │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ MainLayout ──────────────────────────────────────────┐  │
│  │ ┌──────────── Header (60px) ──────────────────────┐   │  │
│  │ │  Logo  │  Module Label  │  Actions  │  UserMenu  │   │  │
│  │ └────────────────────────────────────────────────────┘  │  │
│  │ ┌─────┐ ┌──────────┐ ┌──────────────────────────┐   │  │
│  │ │Micro│ │ Sidebar  │ │                          │   │  │
│  │ │Menu │ │          │ │     Page Content          │   │  │
│  │ │     │ │ - Item 1 │ │     (<Outlet />)         │   │  │
│  │ │ 🏠  │ │ - Item 2 │ │                          │   │  │
│  │ │ 📦  │ │ - Item 3 │ │                          │   │  │
│  │ │ 🔍  │ │          │ │                          │   │  │
│  │ │ ⚙️  │ │          │ │                          │   │  │
│  │ │ 🔄  │ │          │ │                          │   │  │
│  │ │80px │ │  220px   │ │       flex: 1            │   │  │
│  │ └─────┘ └──────────┘ └──────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**核心分层：**

```
Routes (路由) → Modules (业务模块) → Shared (共享层) → API (后端交互)
                    ↓
          pages / components / api.ts
```

每个模块自成一体，包含页面、组件和 API 封装；跨模块复用的能力下沉到 `shared/`。

---

## 路由与页面

所有路由均使用 `React.lazy()` 按需加载，包裹在 `MainLayout` 内。

| 路径 | 页面组件 | 模块 | 说明 |
|------|---------|------|------|
| `/` | `OverviewPage` | overview | 仪表盘总览 |
| `/catalog` | `DatasetListPage` | catalog | 数据集列表 |
| `/catalog/:datasetId` | `DatasetDetailPage` | catalog | 数据集详情 & 版本 |
| `/explorer` | `DistributionPage` | explorer | 场景分布可视化 |
| `/explorer/search` | `SearchPage` | explorer | 样本搜索 |
| `/ops` | `TaskBoardPage` | operations | 任务看板 |
| `/ops/exports` | `ExportListPage` | operations | 导出记录 |
| `/pipelines` | `RunHistoryPage` | pipelines | 流水线运行历史 |

---

## 模块详解

### 🏠 Overview — 总览仪表盘

**路径：** `/`

展示平台全局数据概览，是用户进入系统的首页。

| 组件 | 职责 |
|------|------|
| `PlatformStats` | 4 个统计卡片（数据集、任务、样本、导出数量） |
| `QuickActions` | 快捷入口链接（浏览数据集、查看分布、搜索样本、查看导出） |
| `RecentActivity` | 最近 3 条任务 + 3 条导出记录 |

数据源：`GET /dashboard`

---

### 📦 Catalog — 数据集目录

**路径：** `/catalog`, `/catalog/:datasetId`

管理和浏览所有数据集及其版本。

| 页面 | 功能 |
|------|------|
| `DatasetListPage` | 数据集表格（ID、名称、工作空间、Profile），支持触发导出 |
| `DatasetDetailPage` | 数据集详情 + 版本列表（版本号、样本数、表名） |

API 封装：
- `fetchDatasets()` → 获取数据集列表
- `fetchDatasetDetail(id)` → 获取单个数据集及其版本
- `exportDataset(id)` → 触发导出（`POST /datasets/:id/exports`）

---

### 🔍 Explorer — 数据探索

**路径：** `/explorer`, `/explorer/search`

可视化数据分布并提供样本级搜索。

| 页面 | 功能 |
|------|------|
| `DistributionPage` | 场景分布水平柱状图 + 数据表格 |
| `SearchPage` | 按 ID 或场景名称实时过滤样本 |

组件：
- `DistributionChart` — 自定义 CSS 水平柱状图，基于最大值归一化

---

### 🏭 Operations — 数据加工

**路径：** `/ops`, `/ops/exports`

跟踪数据采集、标注、审核任务以及导出作业。

| 页面 | 功能 |
|------|------|
| `TaskBoardPage` | 任务列表（ID、标题、类型、状态徽章） |
| `ExportListPage` | 导出列表（ID、数据集、格式、状态、输出路径） |

---

### 🔄 Pipelines — 流水线

**路径：** `/pipelines`

展示数据摄入、物化、导出等流水线的运行历史。

| 页面 | 功能 |
|------|------|
| `RunHistoryPage` | 运行记录表格（Run ID、标题、类型、状态） |

> MVP 阶段复用任务数据作为流水线运行记录。

---

## 布局系统

### MainLayout（主布局）

采用嵌套 Flexbox 实现三栏式布局：

```
Header (固定 60px)
├── MicroMenu (左侧模块图标栏, 80px / 折叠 0px)
├── Sidebar (当前模块子菜单, 220px / 折叠 60px)
└── Outlet (页面内容区, flex: 1)
```

**功能特性：**
- 根据 URL 自动高亮对应模块和菜单项
- 侧边栏折叠/展开状态持久化到 `localStorage`
- 全屏模式（隐藏 Header + MicroMenu + Sidebar）
- 响应式：窗口 ≤1024px 自动折叠侧边栏

### 导航配置（nav-config.ts）

```typescript
interface NavGroup {
  label: string    // 模块名称
  icon: string     // 图标 emoji
  items: NavItem[] // 子菜单项 { label, path }
}
```

当前配置了 5 个模块，所有导航项均在此集中管理。新增模块只需：
1. 在 `navGroups` 数组中添加条目
2. 在 `routes.tsx` 中注册路由
3. 在 `modules/` 下创建模块目录

---

## 共享组件库

### UI 组件（shared/components/）

| 组件 | Props | 用途 |
|------|-------|------|
| `PageContainer` | `title`, `description?`, `actions?` | 页面容器，统一标题和操作区 |
| `DataTable<T>` | `columns[]`, `data[]`, `rowKey()` | 通用数据表格，支持自定义列渲染 |
| `StatCard` | `label`, `value` | 数据统计卡片 |
| `StatusBadge` | `status` | 状态徽章（pending/running/done/failed/canceled） |
| `EmptyState` | `message?` | 空状态占位 |
| `ErrorBoundary` | `children`, `fallback?` | React 错误边界 |

### 自定义 Hooks（shared/hooks/）

```typescript
// 数据查询 — 挂载时自动 fetch，提供刷新能力
useQuery<T>(fetcher: () => Promise<T>)
→ { data, loading, error, refetch }

// 手动触发异步操作
useMutation<T>(action: () => Promise<T>)
→ { data, loading, error, mutate }
```

### API 客户端（shared/api/client.ts）

```typescript
const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3100/api'

apiGet<T>(path: string): Promise<T>
apiPost<T>(path: string, body?: unknown): Promise<T>
```

- 统一的 JSON 请求/响应处理
- 自定义 `ApiError` 类携带 HTTP 状态码
- 所有模块的 `api.ts` 基于此封装

---

## 数据获取与状态管理

**策略：** 无全局状态库，依赖组件级 `useQuery` + `useMutation` 组合。

```
Page Component
  └─ useQuery(fetchSomething)
       └─ api.ts (模块级封装)
            └─ client.ts → apiGet / apiPost
                 └─ Backend API
```

**典型流程：**

```tsx
function DatasetListPage() {
  const { data, loading, refetch } = useQuery(() => fetchDatasets())

  async function handleExport(id: string) {
    await exportDataset(id)  // useMutation 或直接调用
    await refetch()           // 重新获取数据
  }

  if (loading) return <div>Loading...</div>
  return <DataTable data={data} ... />
}
```

---

## 样式系统

### 设计令牌（tokens.css）

使用 CSS Custom Properties 定义全局设计变量：

| 类别 | 示例 |
|------|------|
| **主题色** | `--color-bg: #0b1020`（深色主题）, `--color-text: #e7ecf3` |
| **状态色** | `--color-success`, `--color-warning`, `--color-danger` |
| **间距** | `--space-xs` (4px) → `--space-4xl` (48px) |
| **字号** | `--font-xs` (12px) → `--font-3xl` (28px) |
| **圆角** | `--radius-md` (8px), `--radius-lg` (12px) |
| **阴影** | `--shadow-card` |

### CSS 文件组织

| 文件 | 职责 |
|------|------|
| `tokens.css` | 设计令牌变量定义 |
| `reset.css` | 全局样式重置 |
| `main-layout.css` | MainLayout Flexbox 布局 |
| `layout-header.css` | Header 组件样式 |
| `layout-sidebar.css` | Sidebar 组件样式 |
| `layout-micro-menu.css` | MicroMenu 组件样式 |
| `layout.css` | 旧版 AppShell + 通用页面布局、网格、卡片 |
| `styles.css` | 辅助工具类 |

> 采用纯 CSS 方案，无 CSS-in-JS 或 CSS Modules，通过 BEM-like 类名约定避免冲突。

---

## API 契约

前端与后端 BFF（`http://localhost:3100/api`）通信：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/bootstrap` | POST | 应用初始化（best-effort，失败不阻塞） |
| `/dashboard` | GET | 获取仪表盘全量数据 |
| `/datasets/:id/exports` | POST | 触发数据集导出 |

### Dashboard 响应体

```typescript
interface DashboardPayload {
  distribution: { scene: string; sample_count: number }[]
  datasets: { dataset_id: string; name: string; workspace_id: string; profile: string }[]
  datasetVersions: Record<string, { version_id: string; sample_count: number; table_name: string }[]>
  tasks: { task_id: string; title: string; status: StatusEnum; task_type: string }[]
  workspaces: { workspace_id: string; name: string }[]
  exports: { export_id: string; dataset_id: string; format: string; status: StatusEnum; output_path: string }[]
  searchRows: { id: string; scene: string; dataset_version_id?: string }[]
}

type StatusEnum = 'pending' | 'running' | 'done' | 'failed' | 'canceled'
```

---

## 开发约定

| 约定 | 说明 |
|------|------|
| **模块自治** | 每个模块包含 `pages/`、`components/`、`api.ts`、`index.ts` |
| **页面命名** | `*.page.tsx` 后缀标识路由级组件 |
| **懒加载** | 所有页面通过 `React.lazy()` 按需加载 |
| **路径别名** | `@/` 映射到 `src/`（Vite + TSConfig 双重配置） |
| **Index 导出** | 模块通过 `index.ts` 暴露公共 API |
| **API 分层** | 模块级 `api.ts` → 共享 `client.ts`，禁止页面直接调用 `fetch` |
| **类型集中** | 共享类型定义在 `shared/types/common.ts` |
| **状态持久化** | 布局折叠状态使用 `localStorage` |

### 新增模块清单

1. 在 `src/modules/<name>/` 下创建 `pages/`、`api.ts`、`index.ts`
2. 在 `src/shared/layouts/nav-config.ts` 的 `navGroups` 中添加条目
3. 在 `src/routes.tsx` 中注册 lazy 路由
4. （可选）在 `shared/types/common.ts` 中添加类型定义
