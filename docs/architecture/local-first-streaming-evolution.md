# Local-First Streaming 演进设计

> 父：[架构总览](./overview.md)
>
> 在本地阶段先验证 streaming 的语义边界，团队版与企业版只换底层 provider 不动平台语义。

---

## 一、设计原则

1. **Streaming ≠ 批处理放大版**。未来必然引入独立的接入面与流式计算面：`event ingestion → durable log → streaming compute → serving + lakehouse`，而不是 `more files → bigger batch job`。
2. **Dagster 不承担流式控制面**。Dagster 继续负责 asset-oriented batch / 离线物化 / 定时近线流程；不承担高频流式消费调度、大规模事件状态管理、平台级实时控制面。
3. **底层换技术，平台语义不变**。Kafka / Flink / Iceberg / StarRocks 替换底层后，平台对象仍是 `Source / Stream / StreamingJob / DatasetVersion / ExportArtifact / LineageEvent`。

---

## 二、本地 demo 的定位

不是生产级流平台，是边界验证器：

```text
local event source → JSONL event log → micro-batch processing
  → bronze normalized log → snapshot → DuckDB query → Lance index
  → metadata / lineage / export
```

解决的是"语义先成立"，不是"吞吐量先最大化"。

---

## 三、分阶段演进

| 阶段 | 目标 | 替身 |
|---|---|---|
| **Phase 0 · 本地** | 走通 streaming 平台语义 | JSONL event log + Python micro-batch + DuckDB + Lance + SQLite |
| **Phase 1 · 团队** | 稳定接入 + 回放 | Kafka / Pulsar 持久化日志 + Postgres metadata + 独立 scheduler + 对象存储 |
| **Phase 2 · 企业** | 高吞吐 / 多租户 / 可治理 | Flink 主流式引擎 + Iceberg / Paimon 流批一体 + StarRocks / Trino / Pinot 按访问模式分层 |

---

## 四、未来目标拓扑

```text
Edge / Device / App / CDC
  → Ingestion Gateway          鉴权 / 限流 / 幂等键 / schema 校验 / 断点续传
  → Durable Event Log          顺序追加 / 分区 / 回放 / 保留策略 / 消费解耦
  → Stream Processing Plane    去重 / 清洗 / 聚合 / event time / watermark / checkpoint
  → Hot Serving / Online Index 实时 dashboard / 在线检索 / 告警 / 低延迟读
  → Lakehouse Storage          冷热分层 / 长期留存 / 回算 / dataset version 物化
  → Metadata / Control Plane   source / stream / schema / streaming job / lineage / quality / audit
  → Platform API / BFF / SDK / Workbench
```

---

## 五、平台对象（演进时分批引入）

| 对象 | 关键字段 |
|---|---|
| `Source` | `source_id` / `source_type` / `owner` / `auth_mode` / `status` / `retention_policy` |
| `Stream` | `stream_id` / `source_id` / `schema_version_id` / `partition_key` / `ordering_mode` / `watermark_policy` / `replay_policy` |
| `SchemaVersion` | `schema_version_id` / `stream_id` / `format` / `compatibility_mode` / `event_time_field` / `dedupe_key` |
| `StreamingJob` | `streaming_job_id` / `stream_id` / `processor_provider` / `materialization_spec` / `serving_spec` / `checkpoint_strategy` / `status` |
| `StreamingRun` / `Checkpoint` | `streaming_run_id` / `streaming_job_id` / `offset_range` / `checkpoint_id` / `started_at` / `updated_at` / `status` |

`DatasetVersion` / `ExportArtifactManifest` / `LineageEvent` 不变——streaming 结果回流到统一出口。

---

## 六、本地 demo 与平台对象的对应

| 本地 demo | 平台对象 |
|---|---|
| `local-file-simulator` | `Source` |
| `local-events.jsonl` | `Stream` |
| 每次 micro-batch | `StreamingRun` |
| `stream-batch-001` 等版本 | `DatasetVersion` |
| `local-streaming-demo-latest.jsonl` | `ExportArtifact` |

demo 已经把对象关系放在正确方向上，未来只换 provider。

---

## 七、与目录的对应

| 目录 | 流式相关职责 |
|---|---|
| `apps/orchestrator` | Dagster code location，只负责离线 / 近线资产编排 |
| `apps/scheduler` | 升级为 task control plane（job submission / lifecycle / retries / callbacks / quota / execution adapter routing） |
| `python/workflows` | streaming materialization / dataset build / export / streaming control 等流程库 |
| `apps/<app>/src/services/` | 进程内事务型服务（状态机推进、事务级写入） |
| `infra/profiles` | event log provider / stream processor / serving engine / scheduler provider |

详细边界见 [分层与编排边界](./layering-and-orchestrator-boundaries.md)。

---

## 八、参考

- [架构总览](./overview.md)
- [系统分层总览](./system-layers.md)
- [分层与编排边界](./layering-and-orchestrator-boundaries.md)
