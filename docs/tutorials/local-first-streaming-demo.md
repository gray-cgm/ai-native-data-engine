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

## Kafka 模式（broker + DLQ + lag）

JSONL 模式适合快速跑通最小语义。要把 streaming pipeline 提升到与 Batch（Dagster Console）同等的可观测层级，可切到 **Kafka 模式** —— 真正的 broker、消费者 lag、DLQ 与 kafka-ui 控制台都齐备。

### 一键启动

```bash
make up-deps                 # broker(9092) + kafka-ui(8085)
make kafka-topics-init        # 预创建 streaming.events.{raw,dlq}
make stream-demo-kafka        # producer → streaming.events.raw（x_trace_id 作 partition key）
make stream-kafka-consumer    # 幂等消费者（另开终端，写 Bronze + DLQ + lag 快照）
# 打开 http://localhost:3000/pipelines (Overview Tab) —— Streaming 卡片实时显示 lag / DLQ
# 点 "Open Kafka UI console" 跳到 http://localhost:8085 直查 topic / consumer-group / 消息
```

### 关键约束

- **幂等账本**：消费者用 SQLite 维护 `(event_id, x_trace_id)` 复合键。重复投递相同消息不会重复落 Bronze，duplicate counter +1。
- **DLQ**：解析失败 / 写 Bronze 失败的消息直接入 `streaming.events.dlq`，envelope 含 `error_class / error_message / original_topic / original_offset / payload`。
- **At-least-once 提交**：消费者 `auto_commit=False`，仅在 ledger 写入 + Bronze 落盘都成功后才 `consumer.commit()`。
- **Lag 可视化**：每个 poll 周期把 partition lag + counters 写入 `data/streaming/kafka_lag.json`；Platform API `GET /streaming/health` 读取，BFF `GET /api/pipelines/streaming-health` 合并 kafka-ui `/actuator/health` 后给 Pipelines Overview 用。
- **Trace 透传**：producer 用 `x_trace_id` 作为 partition key，并把 `x-trace-id` / `x-requirement-id` 写到 Kafka header；DLQ envelope 同样保留 `x_trace_id`，便于跨 topic 审计。

### Topic 配置

| topic | 分区数 | 用途 |
|---|---|---|
| `streaming.events.raw` | 3 | 主流量；按 `x_trace_id` 分区，保证同 trace 顺序 |
| `streaming.events.dlq` | 1 | 死信队列；envelope 自带原 payload 与错误元数据 |

可通过环境变量覆盖 `KAFKA_TOPIC_EVENTS` / `KAFKA_TOPIC_DLQ`。

### 与 Pipelines 视图对接

Pipelines Overview 的 Streaming 卡片是 Kafka 模式真正的产品入口：

- 顶部 Stat：accepted / duplicates / DLQ / total_lag
- 按 partition 显示 lag 进度条
- 状态色：healthy（green）/ lagging（orange）/ degraded（red）/ idle / down
- 一键打开 Kafka UI（与 Dagster Console 对称）

如要构造 DLQ 场景，可手动往 `streaming.events.raw` 投递格式错误的消息，DLQ 计数与 kafka-ui 中的 `streaming.events.dlq` 都会更新。

### 关停

```bash
make kafka-down              # 停 broker + kafka-ui（保留容器与卷）
make kafka-logs              # tail broker + kafka-ui 日志
```

### 与 ADR 的对应关系

Kafka 集成的完整设计、决策矩阵、Trace propagation contract 与 follow-up（DLQ replay、Dagster sensor 包装、kafka-ui 网关化与权限、多 broker profile 切换）见
[`docs/adr/adr-pipelinerun-unified-fact-model.md`](../adr/adr-pipelinerun-unified-fact-model.md) §8。

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