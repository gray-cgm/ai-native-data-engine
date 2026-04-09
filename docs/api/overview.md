# API 概览

当前本地 MVP API 基于 FastAPI 实现，目标是作为工作台与 SDK 的统一控制面和数据访问出口。

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

## 运行时行为

API 通过 `RuntimeContainer` 和 `infra/profiles/local-dev.yaml` 装配当前运行时。
这意味着路由处理逻辑不直接依赖 DuckDB、SQLite、Parquet、Lance 或 local filesystem，而是依赖已经解析好的 container capabilities。

## 当前 API 在平台中的角色

API 不只是 demo 包装层，它实际上已经是平台控制面与统一数据出口的起点：

- Web workbench 通过 API 读取平台数据
- Python SDK 通过 API 访问系统
- 导出请求通过 API 发起
- dataset 与 operations 的可见性通过 API 暴露

## 后续方向

随着系统演进，API 应保持资源语义稳定，同时允许底层 provider 在 runtime container 之下切换。换句话说，即使 metadata、query、storage、compute provider 未来企业化，API 本身也应尽量保持稳定。
