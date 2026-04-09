# AI Native Data Engine MVP

本项目是一个面向自动驾驶/机器人数据闭环的本地可跑 monorepo MVP。

## 技术选型

- Monorepo: pnpm workspace + turborepo
- Python workspace: uv
- Web: React + Vite
- API: FastAPI
- Orchestration: Dagster
- Local Lakehouse: DuckDB + Parquet + Lance

## 快速开始

### 1. 准备环境

- Node.js 20+
- pnpm 10+
- Python 3.11+
- uv

安装 uv：

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### 2. 安装依赖

```bash
cp .env.example .env
make install
```

### 3. 启动方式

#### Web

```bash
make dev-web
```

#### API

```bash
make dev-api
```

#### Dagster

```bash
make dev-dagster
```

如果你要同时分别启动多个服务，建议开 3 个终端分别执行上面三个命令。

默认端口：

- Web: http://localhost:3000
- API: http://localhost:8000/docs
- Dagster: http://localhost:3001

### 4. 运行本地 MVP 数据链路

#### 导入 demo 数据并物化资产

```bash
make ingest
```

#### 查询 DuckDB 分布结果

```bash
make query
```

#### 查看 Lance 检索样本索引

```bash
make lance
```

#### API 触发 demo ingestion / asset materialization

```bash
curl -X POST http://localhost:8000/samples/ingest-demo
```

#### API 查看样本分布

```bash
curl http://localhost:8000/samples/distribution
```

#### API 查看基础检索预览

```bash
curl http://localhost:8000/samples/search-preview
```

#### API 查看数据集、任务、工作空间、导出

```bash
curl http://localhost:8000/datasets
curl http://localhost:8000/datasets/demo-dataset
curl http://localhost:8000/datasets/demo-dataset/versions
curl http://localhost:8000/tasks
curl http://localhost:8000/workspaces
curl http://localhost:8000/exports
```

#### API 触发真实导出文件

```bash
curl -X POST "http://localhost:8000/exports/dataset/demo-dataset?format=parquet"
curl -X POST "http://localhost:8000/exports/dataset/demo-dataset?format=csv"
curl -X POST "http://localhost:8000/exports/dataset/demo-dataset?format=jsonl"
```

导出文件默认写入：

```bash
./data/exports/demo-dataset-v1.parquet
./data/exports/demo-dataset-v1.csv
./data/exports/demo-dataset-v1.jsonl
```

## MVP 功能

- 本地目录 ingestion：导入图像和 JSON 元数据
- 统一数据资产模型驱动的样本物化
- Dagster asset-oriented pipeline
- Parquet 落盘
- DuckDB 查询 demo
- Lance 基础检索 demo
- 数据导出 demo（支持 Parquet / CSV / JSONL）
- Python SDK demo（统一访问 datasets / exports / search）
- React 工作台：搜索、数据集、任务、工作空间、导出视图
- Labeling domain 保留最小 demo，不实现完整标注系统
- FastAPI API
- SQLite 元数据存储（local-dev）
- local-dev profile 驱动 RuntimeContainer

## 目录

- `apps/web`: React workbench
- `apps/api`: FastAPI API
- `apps/orchestrator`: Dagster project
- `packages/schemas`: shared schema
- `packages/config`: shared TS config
- `python/core`: domain + interfaces
- `python/adapters`: local adapters
- `python/workflows`: ingestion/query/index workflows
- `python/profiles`: adapter/provider/profile resolver
- `packages/contracts`: TS-side adapter contracts
- `packages/profiles`: TS-side runtime profile + capability model
- `infra/profiles`: local-dev / team-dev / enterprise-saas 示例配置
- `sdk/python`: 最小 Python SDK

## 当前说明

这是首版本地 MVP 骨架，重点验证：

1. ingestion -> lakehouse -> platform 闭环打通
2. 个人版 profile 可跑
3. 企业版扩展点已预留在 Python adapters / profiles 中
4. local-dev 已采用 SQLite metadata + Parquet table + DuckDB query + Lance search 的轻量 DataLake 组合
5. 已提供最小 Python SDK 与多格式导出能力，作为统一数据出口的起点
