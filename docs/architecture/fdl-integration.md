# FDL 融合设计说明

> 父：[架构总览](./overview.md)
>
> `file_data_lake`（FDL）的价值在于对 management / query / scheduler 三类服务的清晰分层，以及对共享 layout / data access 基础层的重视。本文回答：FDL 的设计在本项目中如何映射？

---

## 一、三个核心服务的映射

### 管理后台 → `apps/web` + `apps/bff`

FDL 的 management service 同时承担管理 API、前端静态资源、操作入口三类职责。本项目采用前后端分离：

- `apps/web`：React 管理后台前端
- `apps/bff`：浏览器接入 + 页面聚合 + ViewModel

不要把 app-facing 逻辑塞进 `apps/api`，那是面向 SDK / 自动化的 Platform API 层。

### 查询引擎 → `apps/api` + Python 后端

query service 不是单纯的 HTTP 壳，背后还有 query coordinator / 请求解析 / 多 adapter 协调 / 输出组织。映射如下：

| 层 | 职责 |
|---|---|
| `apps/api` | Platform API 外部入口、参数校验、响应协议、SDK 访问 |
| `python/core` | query / search / export / task 领域接口与 capability contracts |
| `python/adapters` | DuckDB / Lance / SQLite / filesystem 等 provider |
| `python/workflows` | query / search / export 等编排逻辑（框架中立） |
| `apps/<app>/src/services/` | 进程内事务型服务（与 SQLAlchemy session 绑定） |

详细边界见 [分层与编排边界](./layering-and-orchestrator-boundaries.md)。

### 调度服务 → 独立 app + workflow，不进 core

scheduler 有明显的独立服务特征（server 入口 / 后台循环 / callback API / resource manager），不适合放进 `python/core`：

- `python/core`：领域模型、接口、contracts、capabilities
- `python/workflows/scheduler`：框架中立的调度编排
- `apps/scheduler`：独立进程入口（按需引入）

---

## 二、值得吸收的设计点

### 统一 layout / path abstraction

FDL 把路径与目录布局集中管理，避免规则散落在 API route / workflow / adapter / export 各处。本项目对应位置：`python/core/interfaces/layout.py`（接口）+ `python/adapters/layout/`（实现）+ `python/workflows/layout/`（编排）。统一管辖：

- raw dataset path
- dataset version table path
- search index path
- export output path
- task artifact path / mining result / labeling artifact

### 共享 metadata / data access 基础层

`apps/api` / `apps/orchestrator` / `apps/scheduler` / BFF 间接依赖的平台能力，都通过统一 `RuntimeContainer` 访问，不绕过抽象层直接操作 SQLite / DuckDB / filesystem。

### service 与 core 的边界清晰

- service 是 service，shared library 是 shared library
- 常驻服务生命周期不进 core

未来增加 app-facing service 时共享 `python/{core, adapters, profiles}` + `packages/{contracts, profiles}`，而不是把 entrypoint 和后台循环挤进同一个 core 包。

---

## 三、目录落位

```text
apps/
  web/            管理后台前端
  bff/            BFF / app-facing 聚合
  api/            Platform API / query-control plane entry
  orchestrator/   Dagster code location
  scheduler/      独立批任务调度服务（按需引入）

python/
  core/           领域模型、接口、contracts、capabilities
  adapters/       provider 实现
  workflows/      ingestion / query / index / export / scheduler 等流程库
  profiles/       runtime / profile / capability resolution

sdk/python/       外部 SDK
```

---

## 四、参考

- [架构总览](./overview.md)
- [分层与编排边界](./layering-and-orchestrator-boundaries.md)
- [系统目录与领域模型设计](./system-directory-and-domain-design.md)
