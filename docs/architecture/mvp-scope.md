# 首版 MVP 范围

## 首版目标

首版是一个**正确但轻量**的个人开发版系统：它应能在一台笔记本上跑起来，并帮助用户建立“面向自动驾驶数据闭环的本地 DataLake 工作台”这一正确心智模型。

## 范围内能力

### 数据导入
- 从本地目录导入 demo 数据
- 接入图像文件和 JSON metadata
- 归一化为统一 SampleRecord

### 资产编排
- 使用 Dagster 的 asset-oriented 模式
- 物化与 dataset 相关的资产，而不只是脚本式 job
- 保留最小 run 与 lineage 记录

### 本地 DataLake / Lakehouse 主链路
- 使用 Parquet 存储结构化样本表
- 使用 DuckDB 做本地查询
- 使用 Lance 构建基础样本检索 / 索引
- 使用 SQLite 存储 metadata

### Platform 工作台
- dataset 浏览
- dataset version 浏览
- search preview
- tasks 视图
- workspaces 视图
- exports 视图

### 统一数据出口
- 支持 Parquet / CSV / JSONL 导出
- 提供最小 Python SDK 作为第一版统一访问出口

## 首版明确不做

- 完整标注平台
- 复杂的数据挖掘编排系统
- 分布式计算集群
- 企业级对象存储能力
- 完整 RBAC / SSO
- 真正的多租户隔离
- 生产级治理工作流
- 完整流式数据处理体系

## 为什么要刻意收敛范围

首版优先保证：

1. 本地启动简单
2. 数据资产生命周期主链路正确
3. 统一数据资产模型成立
4. 能安全演进到团队版和企业版

这个 MVP 的目标不是“看起来像完整企业产品”，而是验证这条核心链路：

```text
local raw files
-> ingestion
-> sample materialization
-> parquet table
-> duckdb query
-> lance index
-> metadata registration
-> api/web/sdk/export
```

## 当前 MVP 能力总结

- 本地目录数据导入
- 图像 + JSON metadata ingestion
- 统一样本物化
- Dagster asset-oriented pipeline
- DuckDB 查询
- Lance search preview
- SQLite metadata 存储
- dataset / version / task / workspace / export API
- Web workbench
- 多格式真实导出文件
- 最小 Python SDK
