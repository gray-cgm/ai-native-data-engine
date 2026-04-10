# AI Native Data Closed Loop Engine MVP

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

## 学习资料 / Learning Resources

如果你想系统理解 AI Native Data Engine 与自动驾驶数据闭环学习，这里给出一条适合开源项目 README 的学习路线。  
If you want to systematically understand AI Native Data Engine and data-closed-loop learning for autonomous driving, the following roadmap is a practical starting point.

### 推荐阅读顺序 / Recommended Reading Order

1. **先看总览综述 / Start with a survey**  
   建立对 data-centric autonomous driving、big data system、data mining、closed-loop technology 的整体认知。  
   Build a high-level mental model of data-centric autonomous driving, big-data systems, data mining, and closed-loop technologies.
2. **再看感知与表示基础 / Then study perception and representation foundations**  
   重点理解 BEV、multi-sensor fusion 等核心表示方法，因为它们是后续规划与闭环优化的重要输入。  
   Focus on BEV and multi-sensor fusion, since they are core inputs for downstream planning and closed-loop optimization.
3. **再进入闭环规划与端到端 / Move into closed-loop planning and end-to-end driving**  
   理解自动驾驶模型如何围绕 planning objective 进行训练与评估。  
   Understand how driving systems are trained and evaluated around planning objectives.
4. **再看 LLM / VLM 驱动的新范式 / Then explore LLM/VLM-driven paradigms**  
   重点关注 reasoning、interpretability、language-guided planning。  
   Pay attention to reasoning, interpretability, and language-guided planning.
5. **最后补世界模型、仿真与数据生成 / Finally study world models, simulation, and data generation**  
   这些方向直接对应数据闭环中的 synthetic data、simulation、scenario editing 与 active iteration。  
   These topics map directly to synthetic data, simulation, scenario editing, and active iteration in a data loop.

### 学习路线图 / Study Roadmap

#### 1) 总览与路线建立 / Survey and Big Picture

- **[1] [Data-Centric Evolution in Autonomous Driving: A Comprehensive Survey of Big Data System, Data Mining, and Closed-Loop Technologies](https://arxiv.org/abs/2401.12888)** (2024)  
  **中文**：系统梳理自动驾驶中的大数据系统、数据挖掘与闭环技术，最适合作为整个方向的总览入口。  
  **EN**: A comprehensive overview of big-data systems, data mining, and closed-loop technologies in autonomous driving; the best entry point for this topic.

#### 2) 感知基础与数据表示 / Perception Foundations and Data Representation

- **[2] [BEVFormer](https://link.springer.com/chapter/10.1007/978-3-031-20077-9_1)** (ECCV 2022)  
  **中文**：BEV 感知经典工作，是理解鸟瞰表示、时空建模与下游任务接口的重要起点。  
  **EN**: A landmark BEV perception paper and a good starting point for understanding bird’s-eye-view representations and spatiotemporal modeling.
- **[3] [BEVFusion: Multi-Task Multi-Sensor Fusion with Unified Bird's-Eye View Representation](https://ieeexplore.ieee.org/abstract/document/10160968)** (ICRA 2023)  
  **中文**：多传感器融合代表工作，适合从数据融合视角理解自动驾驶感知栈。  
  **EN**: A representative multi-sensor fusion work that helps build intuition for unified BEV-based perception.
- **[4] [Delving Into the Devils of Bird's-Eye-View Perception: A Review, Evaluation and Recipe](https://ieeexplore.ieee.org/abstract/document/10321736)** (TPAMI)  
  **中文**：对 BEV 感知进行综述、评估与经验总结，适合系统补课。  
  **EN**: A review-and-evaluation style paper for consolidating your understanding of BEV perception.

#### 3) 闭环规划与端到端驾驶 / Closed-Loop Planning and End-to-End Driving

- **[5] [Planning-Oriented Autonomous Driving](https://openaccess.thecvf.com/content/CVPR2023/html/Hu_Planning-Oriented_Autonomous_Driving_CVPR_2023_paper.html)** (CVPR 2023)  
  **中文**：强调以 planning 为中心的自动驾驶建模，是理解闭环优化目标的重要论文。  
  **EN**: Centers autonomous driving around planning objectives, making it highly relevant for closed-loop learning.
- **[6] [DriveAdapter: Breaking the Coupling Barrier of Perception and Planning in End-to-End Autonomous Driving](https://openaccess.thecvf.com/content/ICCV2023/html/Jia_DriveAdapter_Breaking_the_Coupling_Barrier_of_Perception_and_Planning_in_ICCV_2023_paper.html)** (ICCV 2023)  
  **中文**：讨论端到端驾驶中感知与规划解耦问题，对理解训练结构与模块边界很有帮助。  
  **EN**: Explores how to decouple perception and planning in end-to-end driving, which is useful for understanding architecture design.
- **[7] [LMDrive: Closed-Loop End-to-End Driving with Large Language Models](https://arxiv.org/abs/2312.07488)** (CVPR 2024)  
  **中文**：关注 LLM 在闭环端到端驾驶中的应用，适合了解语言模型如何进入驾驶决策环节。  
  **EN**: Shows how large language models can be brought into closed-loop end-to-end driving.

#### 4) LLM / VLM 驱动的自动驾驶 / LLM- and VLM-Driven Driving

- **[8] [DriveGPT4: Interpretable End-to-end Autonomous Driving via Large Language Model](https://arxiv.org/abs/2310.01412)** (2023)  
  **中文**：探索用大语言模型提升端到端驾驶的可解释性与决策表达。  
  **EN**: Investigates how LLMs can improve interpretability in end-to-end autonomous driving.
- **[9] [DriveLM: Driving with Graph Visual Question Answering](https://arxiv.org/abs/2312.14150)** (2023)  
  **中文**：通过图结构 VQA 增强驾驶场景理解，是视觉语言任务进入驾驶的重要代表。  
  **EN**: Uses graph-based visual question answering to structure driving scene understanding.
- **[10] [Dilu: A Knowledge-Driven Approach to Autonomous Driving with Large Language Models](https://arxiv.org/abs/2309.16292)** (ICLR 2024)  
  **中文**：从知识驱动角度使用 LLM 进行驾驶决策，适合关注 reasoning 路线的读者。  
  **EN**: A reasoning-oriented LLM approach for autonomous driving with an explicit knowledge-driven flavor.
- **[11] [LLM-Assist: Enhancing Closed-Loop Planning with Language-Based Reasoning](https://arxiv.org/abs/2401.00125)** (2024)  
  **中文**：聚焦语言推理增强闭环规划，适合与传统感知-控制方法对照阅读。  
  **EN**: Enhances closed-loop planning with language-based reasoning and is useful for comparing against pure perception-control methods.
- **[12] [VLP: Vision Language Planning for Autonomous Driving](https://arxiv.org/abs/2401.05577)** (2024)  
  **中文**：结合视觉与语言进行规划，适合了解多模态 planning 的代表范式。  
  **EN**: A representative multimodal planning work that combines vision and language.

#### 5) 世界模型、仿真与数据生成 / World Models, Simulation, and Data Generation

- **[13] [World Models](https://arxiv.org/abs/1803.10122)** (NeurIPS 2018)  
  **中文**：世界模型方向的经典基础论文，适合补齐生成式环境建模背景。  
  **EN**: A foundational paper for understanding generative environment modeling.
- **[14] [TrafficBots: Towards World Models for Autonomous Driving Simulation and Motion Prediction](https://arxiv.org/abs/2303.04116)** (ICRA 2023)  
  **中文**：聚焦世界模型、仿真与运动预测，是连接 simulation 与 closed-loop iteration 的代表工作。  
  **EN**: Connects world models, simulation, and motion prediction in the autonomous driving setting.
- **[15] [CARLA: An Open Urban Driving Simulator](https://proceedings.mlr.press/v78/dosovitskiy17a.html)** (CoRL 2017)  
  **中文**：自动驾驶仿真的经典平台论文，适合补齐闭环验证环境的基础。  
  **EN**: A classic simulator paper for understanding validation environments in autonomous driving.
- **[16] [Panacea: Panoramic and Controllable Video Generation for Autonomous Driving](https://panacea-ad.github.io/)** (CVPR 2024)  
  **中文**：关注可控视频生成，可作为自动驾驶数据合成与扩充的入门资料。  
  **EN**: A good entry point into controllable video generation for autonomous driving data synthesis.
- **[17] [Editable Scene Simulation for Autonomous Driving via LLM-Agent Collaboration](https://yifanlu0227.github.io/ChatSim/)** (CVPR 2024)  
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

这是首版本地 MVP 骨架，重点验证：

1. ingestion -> lakehouse -> platform 闭环打通
2. 个人版 profile 可跑
3. 企业版扩展点已预留在 Python adapters / profiles 中
4. local-dev 已采用 SQLite metadata + Parquet table + DuckDB query + Lance search 的轻量 DataLake 组合
5. 已提供最小 Python SDK 与多格式导出能力，作为统一数据出口的起点
