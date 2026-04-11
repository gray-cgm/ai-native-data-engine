# API 概览

当前本地 MVP 存在两层 API 面：

- Web Access API：由 `apps/bff` 提供，面向 React workbench 的页面场景聚合与浏览器友好接口
- Platform API：由 `apps/api` 中的 FastAPI 提供，面向平台资源、控制面能力、SDK 与自动化访问

## BFF 首版最小接口

当前 `apps/bff` 首版真实提供以下最小接口：

- `GET /health`
  - 返回 BFF 服务状态与 upstream Platform API 地址
- `POST /api/bootstrap`
  - 触发 demo ingestion bootstrap
- `GET /api/dashboard`
  - 聚合 dashboard 所需的 distribution、datasets、dataset versions、tasks、workspaces、exports、search preview
- `POST /api/datasets/{datasetId}/exports`
  - 转发 dataset export 请求到 Platform API

这些 BFF 接口建立在现有 FastAPI Platform API 之上，负责页面聚合与场景编排，而不是重写平台资源语义。

## 主要路由分组

### Health
- `GET /health`
  - 返回基础服务健康状态

### Sample Operations
- `POST /samples/ingest-demo`
  - 触发 demo ingestion 与资产物化
- `GET /samples/distribution`
  - 从本地 query 层读取 distribution / 统计结果
- `GET /samples/search-preview`
  - 从本地 search 层返回基础检索预览

### Catalog
- `GET /workspaces`
  - 列出 workspaces
- `GET /datasets`
  - 列出 datasets
- `GET /datasets/{dataset_id}`
  - 获取 dataset 详情
- `GET /datasets/{dataset_id}/versions`
  - 列出 dataset versions

### Operations
- `GET /tasks`
  - 列出平台 tasks
- `GET /runs`
  - 列出 job runs
- `GET /exports`
  - 列出 export jobs

### Export
- `POST /exports/dataset/{dataset_id}?format=parquet`
- `POST /exports/dataset/{dataset_id}?format=csv`
- `POST /exports/dataset/{dataset_id}?format=jsonl`

这些接口会在 `data/exports/` 下生成真实导出文件。

当前下面列出的 `/samples/*`、`/datasets/*`、`/workspaces`、`/tasks`、`/exports/*` 等路由，指的都是 FastAPI Platform API 路由。BFF 会在其上进行页面聚合和场景编排，但不会重新定义底层资源语义。

## 运行时行为

API 通过 `RuntimeContainer` 和 `infra/profiles/local-dev.yaml` 装配当前运行时。
这意味着路由处理逻辑不直接依赖 DuckDB、SQLite、Parquet、Lance 或 local filesystem，而是依赖已经解析好的 container capabilities。

## 当前 API 在平台中的角色

FastAPI Platform API 不只是 demo 包装层，它实际上已经是平台控制面与统一数据出口的起点：

- React workbench 优先通过 BFF 间接访问平台数据
- BFF 通过调用 Platform API 聚合多个平台能力，返回页面友好的结果
- Python SDK 通过 Platform API 访问系统
- 导出请求通过 Platform API 发起
- dataset 与 operations 的可见性通过 Platform API 暴露

## 后续方向

随着系统演进，Platform API 应保持资源语义稳定，同时允许底层 provider 在 runtime container 之下切换。换句话说，即使 metadata、query、storage、compute provider 未来企业化，Platform API 本身也应尽量保持稳定；BFF 则聚焦 app-facing 场景编排，而不是复制平台事实层。
