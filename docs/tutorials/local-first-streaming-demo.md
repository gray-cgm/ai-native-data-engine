# Local-First Streaming Demo

## 目的

这份文档补充一条在当前仓库中真正可跑的 local-first streaming demo。

它不是 Kafka/Flink 级别的生产方案，而是用最少依赖演示 streaming 系统最关键的几件事：

- 事件流接入
- micro-batch 处理
- 当前状态物化
- metadata / lineage 记录
- 导出与检索预览

这条 demo 的目标，是让仓库在保留 local-first 特性的前提下，提前长出 streaming 思维，而不是等未来切到分布式基础设施后再整体重写。

## 这条 demo 做了什么

运行命令：

```bash
make stream-demo
```

命令会调用：

```bash
uv run --package api python -m src.scripts.streaming_demo
```

脚本入口位于：

- `apps/api/src/scripts/streaming_demo.py`

核心 workflow 位于：

- `python/workflows/src/workflows/streaming/local_demo.py`

## 数据链路

当前 demo 采用一条故意简化的本地 streaming 链路：

```text
local event generator
-> JSONL event log
-> micro-batch runner
-> bronze normalized log
-> current sample snapshot
-> DuckDB distribution query
-> Lance search preview
-> metadata / lineage registration
-> JSONL export
```

与当前批式 triage demo 的区别在于：

- triage demo 从本地目录一次性读取样本
- streaming demo 从本地事件日志按 batch 消费事件

## 生成的本地工件

运行完成后，默认会生成这些工件：

- `data/raw/streaming/local-events.jsonl`
- `data/bronze/streaming/normalized-events.jsonl`
- `data/duckdb/streaming_demo.duckdb`
- `data/silver/streaming_samples.lance`
- `data/lance/streaming_samples.lance`
- `data/gold/streaming/streaming_samples.lance`
- `data/exports/local-streaming-demo-latest.jsonl`
- `data/exports/local-streaming-summary.json`

## 它验证了什么

这条 demo 主要验证以下问题：

### 1. Streaming 接入不等于实时平台

在 local-first 阶段，我们不需要先引入 Kafka、Flink、Pulsar，仍然可以用 event log + micro-batch 的方式把 streaming 的关键边界验证出来。

### 2. 流式状态最终仍然需要物化

事件日志本身不是最终消费形态。

为了给查询、导出、检索和平台 API 使用，当前状态仍然要被物化为：

- 当前样本快照
- DuckDB 查询结果
- Lance 检索索引
- metadata / lineage 记录

### 3. Streaming 也需要进入统一资产模型

这条 demo 不直接暴露“一个 JSONL 文件”，而是仍然把结果收敛到：

- workspace
- dataset
- dataset version
- job run
- export job
- lineage event

这保证未来 streaming 能力不会成为平台外的一套孤岛系统。

## 当前实现的边界

这条 demo 有意保持轻量，因此它不是生产级 streaming 架构。

当前不解决：

- 多进程并发消费
- checkpoint 持久化
- watermark
- 乱序处理
- schema registry
- 消息队列分区与回放
- 分布式状态管理

它的价值不是替代未来系统，而是提前把以下问题在本地讲清楚：

- 事件从哪里来
- batch 如何切分
- 当前状态如何落盘
- metadata 如何记录流式物化结果
- streaming 如何进入现有 Platform API / catalog / export 语义

## 推荐使用方式

第一次运行时：

```bash
make stream-demo
```

然后可以结合已有命令一起看：

```bash
make query
make lance
```

这样可以对比理解：

- 批式 triage demo 强调 scenario package
- streaming demo 强调 event log -> current state snapshot

## 未来该怎么演进

这条 demo 对应的未来演进设计见：

- `docs/architecture/local-first-streaming-evolution.md`

简单说，未来路线不是“把这个脚本放大”，而是逐步替换底层执行与日志基础设施：

- JSONL event log -> Kafka / Pulsar
- local micro-batch runner -> Flink / 流式执行平面
- 本地 DuckDB/Lance 快照 -> lakehouse + hot serving + online index
- 单机 metadata -> Postgres + scheduler / task control plane

但上层平台语义仍应保持一致：

- source
- stream
- streaming job
- dataset version
- lineage
- export artifact