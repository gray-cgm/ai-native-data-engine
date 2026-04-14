# Claude Code 实施 Backlog

> 目标：2 周内完成个人开发版 MVP，再用 4~8 周演进到团队版。

## Epic 1 - Monorepo 基础设施

### Story 1.1 - 建立 workspace 基础骨架
- [ ] **P0 Task 1.1.1 - 初始化 TS workspace**
  **输入：** monorepo 根目录、包管理策略、apps/packages 列表
  **输出：** `package.json`、`pnpm-workspace.yaml`、`turbo.json`
  **验收标准：** pnpm workspace 能正确解析 `apps/*`、`packages/*`、`sdk/*`，并为 `apps/web` 与 `apps/bff` 提供统一 TS workspace 基座
- [ ] **P0 Task 1.1.2 - 初始化 Python workspace**
  **输入：** Python 包结构与依赖管理策略
  **输出：** 根目录 `pyproject.toml`，并声明 uv workspace members
  **验收标准：** Python workspace 包含 API、orchestrator、core、adapters、workflows、profiles、SDK
- [ ] **P0 Task 1.1.3 - 补齐本地启动入口**
  **输入：** install / dev / demo 命令集合
  **输出：** `.env.example`、`Makefile`、根 README 启动说明
  **验收标准：** 用户能看到唯一清晰的安装和启动路径

## Epic 2 - 共享领域模型与运行时抽象

### Story 2.1 - 定义稳定 contracts
- [ ] **P0 Task 2.1.1 - 定义 Python 核心领域模型**
  **输入：** 统一数据资产模型
  **输出：** `Sample`、`Dataset`、`DatasetVersion`、`JobRun`、`ExportJob`、`LineageEvent` 与 runtime profile 类型
  **验收标准：** 核心模型同时支持本地 MVP 与后续演进
- [ ] **P0 Task 2.1.2 - 定义 Python adapter contracts**
  **输入：** 平台能力边界
  **输出：** `StorageAdapter`、`QueryAdapter`、`ComputeAdapter`、`MetadataAdapter`、`SearchAdapter`、`TableAdapter`、`AuthAdapter`
  **验收标准：** workflow 与 API 只依赖 contracts，不依赖具体 provider
- [ ] **P1 Task 2.1.3 - 定义 TS 侧 contracts 与 profiles**
  **输入：** Python 侧 adapter 与 capability 模型
  **输出：** TS 共享 contracts、profile 名称、capability 类型
  **验收标准：** Web、BFF 与 packages 层共享同一套 profile 语义

### Story 2.2 - 实现运行时装配
- [ ] **P0 Task 2.2.1 - 增加 profile YAML 配置**
  **输入：** `local-dev`、`team-dev`、`enterprise-saas` 需求
  **输出：** `infra/profiles` 下的 profile 配置文件
  **验收标准：** 每个 profile 都能声明 provider 选择与 capability flags
- [ ] **P0 Task 2.2.2 - 构建 profile resolver**
  **输入：** YAML profile 定义与 adapter 构造逻辑
  **输出：** `build_container()` 与 `RuntimeContainer` 装配逻辑
  **验收标准：** Platform API 与 workflows 能从 `local-dev.yaml` 解析出 container

## Epic 3 - 本地 DataLake MVP 主链路

### Story 3.1 - 实现本地 providers
- [ ] **P0 Task 3.1.1 - 实现本地 storage adapter**
  **输入：** 本地数据根目录需求
  **输出：** 基于 filesystem 的 storage adapter
  **验收标准：** adapter 可完成 put/get/list/open 本地文件
- [ ] **P0 Task 3.1.2 - 实现 SQLite metadata adapter**
  **输入：** dataset、version、workspace、task、run、export、lineage 实体
  **输出：** SQLite metadata provider
  **验收标准：** metadata 可跨运行持久化，并支持 API 查询
- [ ] **P0 Task 3.1.3 - 实现 Parquet table adapter**
  **输入：** sample records 与 export 需求
  **输出：** Parquet 表物化与导出逻辑
  **验收标准：** 记录可写入、读取，并支持导出为 Parquet / CSV / JSONL
- [ ] **P0 Task 3.1.4 - 实现 DuckDB query adapter**
  **输入：** 基于 Parquet 的表与 distribution 查询需求
  **输出：** DuckDB 本地查询 adapter
  **验收标准：** demo distribution 查询可基于物化数据运行
- [ ] **P1 Task 3.1.5 - 实现 Lance search adapter**
  **输入：** sample records 与 retrieval preview 需求
  **输出：** 本地 search / index provider
  **验收标准：** search preview 能返回已索引的 sample 行

### Story 3.2 - 构建本地资产编排链路
- [ ] **P0 Task 3.2.1 - 实现夜间路口弱势交通参与者场景筛选 workflow**
  **输入：** `examples/` 下的本地图像与 JSON metadata
  **输出：** 归一化后的 sample records 与最小 scenario package
  **验收标准：** 本地样本可被扫描成统一样本模型，并能筛出 priority samples
- [ ] **P0 Task 3.2.2 - 通过 container 物化 dataset assets**
  **输入：** runtime container 与 sample records
  **输出：** dataset、version、runs、search index、materialized tables、lineage
  **验收标准：** 单个函数可跑通本地端到端主链路
- [ ] **P0 Task 3.2.3 - 增加 Dagster asset definitions**
  **输入：** 资产物化 workflow
  **输出：** asset-oriented Dagster definitions
  **验收标准：** Dagster 暴露的是 dataset 相关资产，而不是纯脚本 job

## Epic 4 - Platform API、BFF 与工作台

### Story 4.1 - 暴露 Platform API
- [ ] **P0 Task 4.1.1 - 增加 sample operation API**
  **输入：** container 驱动的 scenario triage / query / search 函数
  **输出：** `/samples/ingest-demo`、`/samples/distribution`、`/samples/search-preview`
  **验收标准：** 本地 MVP 接口返回真实结果而非 mock
- [ ] **P0 Task 4.1.2 - 增加 catalog API**
  **输入：** metadata adapter
  **输出：** dataset、dataset version、workspace API
  **验收标准：** 用户可以通过 API 浏览数据资产
- [ ] **P0 Task 4.1.3 - 增加 operations API**
  **输入：** runs / tasks / exports 的 metadata 记录
  **输出：** operations endpoints
  **验收标准：** workbench 能渲染 tasks、runs、exports
- [ ] **P0 Task 4.1.4 - 增加 export API**
  **输入：** dataset version 查询与 table export 支持
  **输出：** 真实文件导出的 API endpoint
  **验收标准：** 发起 export 后会生成输出文件与 metadata 记录

### Story 4.2 - 构建 Node.js BFF
- [ ] **P0 Task 4.2.1 - 搭建 BFF 应用骨架**
  **输入：** 中后台场景与 monorepo TS workspace 需求
  **输出：** `apps/bff` 的 Node.js + TypeScript 应用壳
  **验收标准：** BFF 可本地启动，并能接入共享 TS contracts/schemas
- [ ] **P0 Task 4.2.2 - 增加 workbench 所需聚合接口**
  **输入：** Web 页面需求与 Platform API endpoint 列表
  **输出：** 面向前端的 BFF 场景接口
  **验收标准：** BFF 通过调用 Platform API 返回页面友好的聚合结果，而不是复制平台 domain logic
- [ ] **P1 Task 4.2.3 - 增加 BFF 认证/上下文边界**
  **输入：** session、tenant、permission 的最小需求
  **输出：** BFF request context 与 auth 占位能力
  **验收标准：** BFF 能承接浏览器侧的会话与权限上下文，而不污染 Platform API 语义

### Story 4.3 - 构建 Web Workbench
- [ ] **P0 Task 4.3.1 - 搭建 React workbench 骨架**
  **输入：** Web app 需求
  **输出：** React + Vite 应用壳
  **验收标准：** 本地可启动，并有清晰的运行方式
- [ ] **P0 Task 4.3.2 - 将 workbench 连接到真实 BFF**
  **输入：** dataset / task / workspace / export / search 页面需求与 BFF endpoint
  **输出：** BFF 驱动的 dashboard 页面
  **验收标准：** UI 通过 BFF 展示真实平台数据而非 mock
- [ ] **P1 Task 4.3.3 - 增加导出触发 UI**
  **输入：** export endpoint 与 dataset detail 数据
  **输出：** workbench 中的导出操作入口
  **验收标准：** 用户可在 UI 中触发导出并看到状态更新

## Epic 5 - 统一数据出口与文档

### Story 5.1 - 增加 SDK 访问面
- [ ] **P1 Task 5.1.1 - 创建最小 Python SDK**
  **输入：** Platform API endpoint 列表
  **输出：** 支持 ingest、datasets、exports、search preview 的 Python client
  **验收标准：** SDK demo 能成功调用真实 Platform API

### Story 5.2 - 沉淀架构与入门文档
- [ ] **P0 Task 5.2.1 - 编写根 README 启动指南**
  **输入：** 实际 install / startup 命令
  **输出：** 根目录 quickstart 文档
  **验收标准：** README 中仅包含真实可运行命令，并清晰区分 Web、BFF、Platform API 与 Dagster
- [ ] **P1 Task 5.2.2 - 编写 Beginner Guide**
  **输入：** 本地 MVP 架构与 DDIA 风格解释
  **输出：** 面向初学者的教程文档
  **验收标准：** 初学者能理解为什么使用 DuckDB、Parquet、Lance、SQLite 与 adapters
- [ ] **P1 Task 5.2.3 - 整理 docs 目录**
  **输入：** 架构、MVP 与 backlog 材料
  **输出：** `docs/architecture`、`docs/adr`、`docs/api`、`docs/tutorials`
  **验收标准：** 所有主要设计产物都能在 `docs/` 下被清晰发现

## Epic 6 - 团队版演进准备

### Story 6.1 - 为团队版扩展做准备
- [ ] **P1 Task 6.1.1 - 增加 team profile wiring**
  **输入：** `team-dev.yaml` provider map
  **输出：** profile-ready wiring 与 provider gap 文档
  **验收标准：** 即使部分 provider 仍是 placeholder，系统也能表达团队版拓扑
- [ ] **P2 Task 6.1.2 - 增加企业版 adapter placeholders**
  **输入：** 企业版 provider 目标
  **输出：** StarRocks、Iceberg/Paimon、OIDC、对象存储等 placeholder adapters
  **验收标准：** 扩展点明确存在，且能正常导入 / 编译
- [ ] **P2 Task 6.1.3 - 规划多租户平台演进路径**
  **输入：** 当前 workbench、BFF 与 metadata 边界
  **输出：** 面向 tenant context、auth、governance、quota 的 ADR 或设计说明
  **验收标准：** SaaS 演进方向被清晰记录，同时不过度提前实现 v1
