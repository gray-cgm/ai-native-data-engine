# AI Native Data Closed Loop Engine

Build a local-first data closed-loop engine for autonomous driving and robotics, while learning to design data-intensive applications systematically.

本项目是一个面向自动驾驶/机器人数据闭环的本地可跑 monorepo MVP，目标不仅是搭建一条可运行的数据闭环链路，也希望帮助开发者系统性地学习如何设计数据密集型应用。

当前文档采用统一的六层模型来描述系统底座：

## 统一架构表

| 层级 | 核心职责 | 代表技术 | 当前 local-first MVP |
|---|---|---|---|
| 文件格式层 | 定义数据如何编码、落盘与索引表达 | Parquet / Lance / Mcap / Lerobot | 当前主格式 Lance |
| 存储层 | 保存原始文件、导出文件与对象数据 | local fs / S3 / MinIO / OSS / HDFS | local fs |
| 湖表格式层 | 管理表快照、schema 演进、分区与事务语义 | Iceberg / Paimon / Hudi | 预留演进方向，当前仍是裸文件集 |
| 计算层 | 执行 ingestion、物化、编排、批流处理 | local Python / Dagster / Spark / Flink / Fluss | local Python + Dagster |
| 查询层 | 提供 SQL 查询、聚合、交互式分析读取能力 | DuckDB / Trino / StarRocks | DuckDB |
| 应用层 | 组织面向角色的产品入口与工作流体验 | BI / 挖掘检索 / 标注 / 需求管理 / 工作台 | Web + BFF + FastAPI + SDK |

补充说明：SQLite / Postgres 更接近元数据与事务控制层，用来承载数据集、版本、任务、导出、血缘、权限、审计等控制信息，不直接并入上述六层中的某一层。

### 技术归属速查表

| 技术 / 组件 | 所属层 | 说明 |
|---|---|---|
| local fs / S3 / MinIO / OSS / HDFS | 存储层 | 保存原始文件、导出文件与对象数据 |
| Iceberg / Paimon / Hudi | 湖表格式层 | 管理表快照、schema 演进、分区与事务语义 |
| Parquet | 文件格式层 | 与 Lance 同类的列式文件格式，可作为兼容/历史格式理解 |
| Lance | 文件格式层 | 当前主结构化与检索文件格式 |
| local Python / Dagster / Spark / Flink / Fluss | 计算层 | 执行 ingestion、物化、编排与批流处理 |
| DuckDB / Trino / StarRocks | 查询层 | 提供 SQL 查询、聚合和分析读取能力 |
| SQLite / Postgres | 元数据与事务控制层 | 记录数据集、版本、任务、导出、血缘、权限、审计等状态 |
| Web / BFF / FastAPI / SDK / BI / 标注工作台 | 应用层 | 面向角色提供工作流入口与产品体验 |

## 技术选型

- Monorepo: pnpm workspace + turborepo
- Python workspace: uv
- Web: React + Vite
- BFF: Node.js + TypeScript
- Platform API: FastAPI
- Orchestration: Dagster
- Local runtime today: local fs storage + Lance-first files + DuckDB query + Dagster orchestration + SQLite metadata + Web/BFF/API application access

## 快速开始

### 1. 准备环境

- Node.js 20+
- pnpm 10+
- Python 3.11+
- uv
- Docker Desktop / Docker Engine

安装 uv：

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### 2. 首次启动

```bash
make setup
make up
```

`make setup` 会自动：
- 检查 `node` / `pnpm` / `python3` / `uv` / `docker` / `docker compose`
- 若 `.env` 不存在则自动从 `.env.example` 创建
- 安装前端与 Python 依赖

`make up` 会自动：
- 启动 `postgres`
- 启动 `dagster-user-code`
- 启动 `dagster-webserver`
- 启动 `dagster-daemon`
- 启动 `jupyter`
- 启动 `superset`
- 启动宿主机开发进程：`web` / `bff` / `api`
- 启动前检查 Docker、`.env`、关键端口和 Colima 挂载

默认访问地址：

- Web: http://localhost:3000
- BFF: http://localhost:3100
- Platform API: http://localhost:8000/docs
- Dagster: http://localhost:3001
- Jupyter: http://localhost:8888
- Superset: http://localhost:8088

### 3. 日常开发

```bash
make up
```

停止容器和本地 apps：

```bash
make down
```

仅停止本地 apps：

```bash
make down-apps
```

查看容器日志：

```bash
make logs
```

查看服务地址和诊断：

```bash
make status
make doctor
```

### 4. 单独调试某个服务

#### Web

```bash
make dev-web
```

#### BFF

```bash
make dev-bff
```

#### API

```bash
make dev-api
```

#### Dagster（本地单进程开发）

```bash
make dev-dagster
```

#### Dagster OSS Docker Compose 部署

```bash
make compose-dagster
```

#### 仅启动分析相关容器

```bash
make compose-analytics
```

#### 仅启动全部容器依赖

```bash
make up-deps
```

## 常见问题

### Docker / Colima 未启动

执行 `make setup` 或 `make up` 时如果提示 Docker 不可用，先启动 Docker Desktop 或 Colima。

### Colima 看不到项目目录

如果 `make up` 提示 Colima 无法访问项目目录，请检查 `~/.colima/default/colima.yaml` 的 `mounts` 配置，并确保包含：

```yaml
mounts:
  - location: /Volumes/xdisk
    writable: true
```

修改后执行：

```bash
colima stop
colima start
```

### 端口冲突

`make up` 会检查容器端口：
- 5432
- 3001
- 8888
- 8088

`make up-apps` 会检查本地 app 端口：
- 3000
- 3100
- 8000

若提示端口占用，请先执行：

```bash
make down-apps
```

### `.env` 缺失

首次执行 `make setup` 会自动创建 `.env`。如果你手动删除了 `.env`，重新执行 `make setup` 即可。

### 4. 运行本地 MVP 数据链路

当前默认主链路是一个真实自动驾驶场景：`Night Intersection VRU Hard-Case Triage`。
它会从本地样本里筛出夜间、路口、行人、斑马线、交通灯、遮挡相关样本，生成一个最小 scenario package，用于 review/export/search 的闭环验证。

#### 触发夜间路口弱势交通参与者场景筛选

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

#### 运行本地 streaming demo

```bash
make stream-demo
```

这条 demo 会模拟本地事件流接入，并以 micro-batch 方式完成：
- `data/raw/streaming/local-events.jsonl` 原始事件日志
- `data/bronze/streaming/normalized-events.jsonl` 归一化事件日志
- `data/silver/streaming_samples.lance` 当前流式样本快照
- `data/lance/streaming_samples.lance` 本地检索索引
- `data/exports/local-streaming-summary.json` demo 汇总结果

完整说明见 `docs/tutorials/local-first-streaming-demo.md`。

#### Platform API 触发场景筛选 / asset materialization

```bash
curl -X POST http://localhost:8000/samples/ingest-demo
```

返回结果中的 `scenario` 字段会包含：
- `scenario_id`: `night-intersection-vru-triage`
- `focus_scenes`: `urban-night`, `intersection`
- `focus_tags`: `night`, `pedestrian`, `crosswalk`, `junction`, `traffic-light`, `occlusion`
- `priority_sample_ids`: 当前最小 hard-case 样本包

#### Platform API 查看样本分布

```bash
curl http://localhost:8000/samples/distribution
```

#### Platform API 查看基础检索预览

```bash
curl http://localhost:8000/samples/search-preview
```

这两个接口现在也会返回 `scenario` 字段，用于描述当前场景包的目标、候选样本和优先样本。

#### Platform API 触发 / 查看 streaming 资源

```bash
curl -X POST http://localhost:8000/streaming/bootstrap
curl http://localhost:8000/streaming/summary
```

其中：
- `/streaming/bootstrap` 用于触发 local-first streaming demo
- `/streaming/summary` 用于读取最新的 streaming 物化摘要

#### Platform API 查看数据集、任务、工作空间、导出

```bash
curl http://localhost:8000/datasets
curl http://localhost:8000/datasets/demo-dataset
curl http://localhost:8000/datasets/demo-dataset/versions
curl http://localhost:8000/tasks
curl http://localhost:8000/workspaces
curl http://localhost:8000/exports
```

#### Platform API 触发真实导出文件

```bash
curl -X POST "http://localhost:8000/exports/dataset/demo-dataset?format=lance"
curl -X POST "http://localhost:8000/exports/dataset/demo-dataset?format=csv"
curl -X POST "http://localhost:8000/exports/dataset/demo-dataset?format=jsonl"
```

导出文件默认写入：

```bash
./data/exports/demo-dataset-v1.lance
./data/exports/demo-dataset-v1.csv
./data/exports/demo-dataset-v1.jsonl
```

## MVP 功能

- 本地目录 ingestion：导入图像和 JSON 元数据
- 统一数据资产模型驱动的样本物化
- 真实自动驾驶场景 demo：夜间路口弱势交通参与者 hard-case triage
- Dagster asset-oriented pipeline
- Lance 落盘
- DuckDB 查询 demo
- Lance 基础检索 demo
- streaming demo（本地 JSONL event log + micro-batch 物化）
- 数据导出 demo（支持 Lance / CSV / JSONL）
- Python SDK demo（统一访问 Platform API 上的 datasets / exports / search）
- React 工作台：搜索、数据集、任务、工作空间、导出视图
- Node.js TypeScript BFF：面向 Web 的页面聚合与场景编排层
- Labeling domain 保留最小 demo，不实现完整标注系统
- FastAPI Platform API：面向平台资源、控制面能力与 SDK/自动化访问
- SQLite 元数据存储（local-dev）
- local-dev profile 驱动 RuntimeContainer

## 目录

- `apps/web`: React workbench
- `apps/bff`: Node.js TypeScript BFF
- `apps/api`: FastAPI Platform API
- `apps/orchestrator`: Dagster OSS user code project / code location
- `apps/scheduler`: future scheduler service placeholder
- `packages/schemas`: shared schema
- `packages/config`: shared TS config
- `python/core`: domain + interfaces
- `python/adapters`: local adapters
- `python/workflows`: ingestion/query/index workflows
- `python/profiles`: adapter/provider/profile resolver
- `python/services`: future Python application service layer placeholder
- `packages/contracts`: TS-side adapter contracts
- `packages/profiles`: TS-side runtime profile + capability model
- `infra/profiles`: local-dev / team-dev / enterprise-saas 示例配置
- `sdk/python`: 最小 Python SDK

## 访问拓扑

当前推荐的访问路径是：

```text
Browser / Web App
-> BFF (Node.js + TypeScript)
-> Platform API (FastAPI)
-> RuntimeContainer / adapters / lakehouse
```

其中：

- `apps/web` 面向前端 UI
- `apps/bff` 面向页面场景聚合、前端友好接口、会话与权限边界
- `apps/api` 面向平台资源、控制面能力、SDK 与自动化访问

当前首版 BFF 已真实提供以下最小接口：

- `GET /health`
- `POST /api/bootstrap`
- `GET /api/dashboard`
- `POST /api/datasets/{datasetId}/exports`

这些接口会在 BFF 内部聚合或转发到 FastAPI Platform API。

其中 `POST /api/bootstrap` 当前会触发 `Night Intersection VRU Hard-Case Triage` 场景链路，而不是 generic mock demo。

下面的 `curl` 示例仍然以 FastAPI Platform API 为准，主要用于验证平台能力与本地 MVP 主链路，而不是要求未来 Web 继续直连 FastAPI。

## 学习资料 / Learning Resources

如果你想系统理解 AI Native Data Engine 与自动驾驶数据闭环学习，这里给出一条适合开源项目 README 的学习路线。  
If you want to systematically understand AI Native Data Engine and data-closed-loop learning for autonomous driving, the following roadmap is a practical starting point.

### 推荐阅读顺序 / Recommended Reading Order

1. **先补数据密集型系统基础 / Start with data-intensive systems fundamentals**  
   先建立对 storage、replication、partitioning、stream processing、batch processing 与 system design trade-off 的整体认知，这会直接影响你如何设计数据闭环平台。  
   First build a mental model of storage, replication, partitioning, stream processing, batch processing, and system-design trade-offs, because these directly shape how you design a data closed-loop platform.
2. **再看一个端到端数据工程项目 / Then study an end-to-end data engineering project**  
   通过一个可快速浏览的真实项目，理解 ingestion、object storage、lakehouse、orchestration、analytics dashboard 如何串成完整链路。  
   Use a compact real-world project to see how ingestion, object storage, lakehouse, orchestration, and analytics dashboards connect into one end-to-end system.
3. **再看总览综述 / Then read the survey**  
   建立对 data-centric autonomous driving、big data system、data mining、closed-loop technology 的整体认知。  
   Build a high-level mental model of data-centric autonomous driving, big-data systems, data mining, and closed-loop technologies.
4. **再看感知与表示基础 / Then study perception and representation foundations**  
   重点理解 BEV、multi-sensor fusion 等核心表示方法，因为它们是后续规划与闭环优化的重要输入。  
   Focus on BEV and multi-sensor fusion, since they are core inputs for downstream planning and closed-loop optimization.
5. **再进入闭环规划与端到端 / Move into closed-loop planning and end-to-end driving**  
   理解自动驾驶模型如何围绕 planning objective 进行训练与评估。  
   Understand how driving systems are trained and evaluated around planning objectives.
6. **再看 LLM / VLM 驱动的新范式 / Then explore LLM/VLM-driven paradigms**  
   重点关注 reasoning、interpretability、language-guided planning。  
   Pay attention to reasoning, interpretability, and language-guided planning.
7. **最后补世界模型、仿真与数据生成 / Finally study world models, simulation, and data generation**  
   这些方向直接对应数据闭环中的 synthetic data、simulation、scenario editing 与 active iteration。  
   These topics map directly to synthetic data, simulation, scenario editing, and active iteration in a data loop.

### 学习路线图 / Study Roadmap

#### 1) 数据密集型系统基础 / Data-Intensive Systems Foundation

- **[1] [Designing Data-Intensive Applications（DDIA）](https://ddia.vonng.com/)**  
  **中文**：如果希望通过本项目学会系统性地设计数据密集型应用，这本书应作为优先阅读材料。它覆盖数据系统设计中的核心问题，如数据模型、存储引擎、复制、分区、一致性、流处理与批处理，非常适合作为整个项目的方法论基础。  
  **EN**: If the goal of this project is to help readers learn how to systematically design data-intensive applications, DDIA should be treated as a foundational reading. It covers core topics such as data models, storage engines, replication, partitioning, consistency, stream processing, and batch processing.

#### 2) 端到端数据工程实践 / End-to-End Data Engineering Practice

- **[2] [Building a Data Engineering Project in 20 Minutes](https://www.ssp.sh/blog/data-engineering-project-in-twenty-minutes/)**  
  **中文**：这是一个很适合与本项目互补阅读的端到端数据工程案例，串起了 web scraping、object storage、CDC、Delta Lake、Jupyter、Druid、Superset、Dagster 与 Kubernetes。它能帮助学习者快速理解一个数据密集型应用是如何从原始数据采集一路走到编排、分析与可视化交付的。  
  **EN**: This is a practical end-to-end data engineering example that complements this project well. It connects web scraping, object storage, CDC, Delta Lake, Jupyter, Druid, Superset, Dagster, and Kubernetes into one coherent pipeline.

#### 3) 总览与路线建立 / Survey and Big Picture

- **[3] [Data-Centric Evolution in Autonomous Driving: A Comprehensive Survey of Big Data System, Data Mining, and Closed-Loop Technologies](https://arxiv.org/abs/2401.12888)** (2024)  
  **中文**：系统梳理自动驾驶中的大数据系统、数据挖掘与闭环技术，最适合作为整个方向的总览入口。  
  **EN**: A comprehensive overview of big-data systems, data mining, and closed-loop technologies in autonomous driving; the best entry point for this topic.

#### 4) 感知基础与数据表示 / Perception Foundations and Data Representation

- **[4] [BEVFormer](https://link.springer.com/chapter/10.1007/978-3-031-20077-9_1)** (ECCV 2022)  
  **中文**：BEV 感知经典工作，是理解鸟瞰表示、时空建模与下游任务接口的重要起点。  
  **EN**: A landmark BEV perception paper and a good starting point for understanding bird’s-eye-view representations and spatiotemporal modeling.
- **[5] [BEVFusion: Multi-Task Multi-Sensor Fusion with Unified Bird's-Eye View Representation](https://ieeexplore.ieee.org/abstract/document/10160968)** (ICRA 2023)  
  **中文**：多传感器融合代表工作，适合从数据融合视角理解自动驾驶感知栈。  
  **EN**: A representative multi-sensor fusion work that helps build intuition for unified BEV-based perception.
- **[6] [Delving Into the Devils of Bird's-Eye-View Perception: A Review, Evaluation and Recipe](https://ieeexplore.ieee.org/abstract/document/10321736)** (TPAMI)  
  **中文**：对 BEV 感知进行综述、评估与经验总结，适合系统补课。  
  **EN**: A review-and-evaluation style paper for consolidating your understanding of BEV perception.

#### 5) 闭环规划与端到端驾驶 / Closed-Loop Planning and End-to-End Driving

- **[7] [Planning-Oriented Autonomous Driving](https://openaccess.thecvf.com/content/CVPR2023/html/Hu_Planning-Oriented_Autonomous_Driving_CVPR_2023_paper.html)** (CVPR 2023)  
  **中文**：强调以 planning 为中心的自动驾驶建模，是理解闭环优化目标的重要论文。  
  **EN**: Centers autonomous driving around planning objectives, making it highly relevant for closed-loop learning.
- **[8] [DriveAdapter: Breaking the Coupling Barrier of Perception and Planning in End-to-End Autonomous Driving](https://openaccess.thecvf.com/content/ICCV2023/html/Jia_DriveAdapter_Breaking_the_Coupling_Barrier_of_Perception_and_Planning_in_ICCV_2023_paper.html)** (ICCV 2023)  
  **中文**：讨论端到端驾驶中感知与规划解耦问题，对理解训练结构与模块边界很有帮助。  
  **EN**: Explores how to decouple perception and planning in end-to-end driving, which is useful for understanding architecture design.
- **[9] [LMDrive: Closed-Loop End-to-End Driving with Large Language Models](https://arxiv.org/abs/2312.07488)** (CVPR 2024)  
  **中文**：关注 LLM 在闭环端到端驾驶中的应用，适合了解语言模型如何进入驾驶决策环节。  
  **EN**: Shows how large language models can be brought into closed-loop end-to-end driving.

#### 6) LLM / VLM 驱动的自动驾驶 / LLM- and VLM-Driven Driving

- **[10] [DriveGPT4: Interpretable End-to-end Autonomous Driving via Large Language Model](https://arxiv.org/abs/2310.01412)** (2023)  
  **中文**：探索用大语言模型提升端到端驾驶的可解释性与决策表达。  
  **EN**: Investigates how LLMs can improve interpretability in end-to-end autonomous driving.
- **[11] [DriveLM: Driving with Graph Visual Question Answering](https://arxiv.org/abs/2312.14150)** (2023)  
  **中文**：通过图结构 VQA 增强驾驶场景理解，是视觉语言任务进入驾驶的重要代表。  
  **EN**: Uses graph-based visual question answering to structure driving scene understanding.
- **[12] [Dilu: A Knowledge-Driven Approach to Autonomous Driving with Large Language Models](https://arxiv.org/abs/2309.16292)** (ICLR 2024)  
  **中文**：从知识驱动角度使用 LLM 进行驾驶决策，适合关注 reasoning 路线的读者。  
  **EN**: A reasoning-oriented LLM approach for autonomous driving with an explicit knowledge-driven flavor.
- **[13] [LLM-Assist: Enhancing Closed-Loop Planning with Language-Based Reasoning](https://arxiv.org/abs/2401.00125)** (2024)  
  **中文**：聚焦语言推理增强闭环规划，适合与传统感知-控制方法对照阅读。  
  **EN**: Enhances closed-loop planning with language-based reasoning and is useful for comparing against pure perception-control methods.
- **[14] [VLP: Vision Language Planning for Autonomous Driving](https://arxiv.org/abs/2401.05577)** (2024)  
  **中文**：结合视觉与语言进行规划，适合了解多模态 planning 的代表范式。  
  **EN**: A representative multimodal planning work that combines vision and language.

#### 7) 世界模型、仿真与数据生成 / World Models, Simulation, and Data Generation

- **[15] [World Models](https://arxiv.org/abs/1803.10122)** (NeurIPS 2018)  
  **中文**：世界模型方向的经典基础论文，适合补齐生成式环境建模背景。  
  **EN**: A foundational paper for understanding generative environment modeling.
- **[16] [TrafficBots: Towards World Models for Autonomous Driving Simulation and Motion Prediction](https://arxiv.org/abs/2303.04116)** (ICRA 2023)  
  **中文**：聚焦世界模型、仿真与运动预测，是连接 simulation 与 closed-loop iteration 的代表工作。  
  **EN**: Connects world models, simulation, and motion prediction in the autonomous driving setting.
- **[17] [CARLA: An Open Urban Driving Simulator](https://proceedings.mlr.press/v78/dosovitskiy17a.html)** (CoRL 2017)  
  **中文**：自动驾驶仿真的经典平台论文，适合补齐闭环验证环境的基础。  
  **EN**: A classic simulator paper for understanding validation environments in autonomous driving.
- **[18] [Panacea: Panoramic and Controllable Video Generation for Autonomous Driving](https://panacea-ad.github.io/)** (CVPR 2024)  
  **中文**：关注可控视频生成，可作为自动驾驶数据合成与扩充的入门资料。  
  **EN**: A good entry point into controllable video generation for autonomous driving data synthesis.
- **[19] [Editable Scene Simulation for Autonomous Driving via LLM-Agent Collaboration](https://yifanlu0227.github.io/ChatSim/)** (CVPR 2024)  
  **中文**：从场景编辑与 agent 协作角度展示仿真数据生成的新方向。  
  **EN**: Demonstrates how LLM-agent collaboration can support editable scene simulation and synthetic data generation.

### 持续跟踪资源 / Resources to Follow Continuously

- **[Awesome-Data-Centric-Autonomous-Driving](https://github.com/LincanLi-X/Awesome-Data-Centric-Autonomous-Driving)**  
  **中文**：汇总数据中心自动驾驶相关论文、数据集与项目，建议作为持续更新入口。  
  **EN**: A curated list of papers, datasets, and projects for staying up to date with data-centric autonomous driving.
- **[DriveLM Project](https://github.com/OpenDriveLab/DriveLM/tree/main)**  
  **中文**：可结合论文一起阅读，了解 benchmark、任务定义与代码实现。  
  **EN**: Useful alongside the paper for understanding the benchmark, task design, and implementation details.

### 与本项目的关系 / Why These Matter for This Project

- **中文**：这批资料分别对应本项目关注的几个核心问题：数据采集与挖掘、统一表示、检索与分析、规划优化、仿真生成，以及最终的数据闭环迭代。  
- **EN**: These resources map directly to the project’s core concerns: data collection and mining, unified representations, retrieval and analysis, planning optimization, simulation, and iterative closed-loop improvement.

## 当前说明

这是首版本地 MVP 骨架，目标不仅是验证一条可运行的数据闭环链路，也希望沿着“个人版 -> 企业版 -> SaaS 版”的路径持续拓展。

### 项目拓展路径 / Project Expansion Path

1. **个人本地能跑起来 / Local-first personal edition**  
   面向个人开发者与学习者，强调一台机器即可跑通 ingestion -> lakehouse -> platform 的最小闭环。
2. **可复制的企业版 / Enterprise-reproducible edition**  
   面向求职、面试与企业场景演示，目标是让学习者不仅会做 demo，还能展示更接近真实企业数据平台的架构设计与工程拆分能力，从而拿到更好的 offer。
3. **对外提供 SaaS 服务的多租户版本 / Multi-tenant SaaS edition**  
   面向真实产品化与商业化场景，逐步演进到支持多租户隔离、团队协作、权限控制、托管运行与对外服务交付的版本。

### 当前阶段重点 / Current Focus

1. ingestion -> lakehouse -> platform 闭环打通
2. 个人本地版可跑，作为整个系统演进的起点
3. 企业版扩展点已预留在 Python adapters / profiles 中，便于后续演进为可复制的企业级架构
4. 后续可继续演进到支持多租户 SaaS 的架构形态
5. local-dev 当前采用 local fs 存储 + Lance 主文件格式 + DuckDB 查询 + SQLite metadata 的轻量组合
6. 已提供最小 Python SDK 与多格式导出能力，作为统一数据出口的起点
