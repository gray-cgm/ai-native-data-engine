# 外部 API & SDK 使用说明

> 父：[API 总览](./overview.md)
> 范围：本文是**外部消费方**（算法工程师 / 自动化脚本 / 第三方系统）使用 Platform API 的指南。
> 内部调用契约（Web → BFF → Platform API）请看 [Internal API](./internal-api.md)。

---

## 1. 谁会用这套 API

| 消费方 | 主要场景 |
|---|---|
| **算法工程师** | 拉 official Dataset 训练 / 评估；反馈 cornercase |
| **数据中台运维** | 自动化导入 raw asset；监控 trace |
| **第三方供应商** | 接收标注任务；回写 da_tags |
| **CI / 自动化** | 跑 e2e test；生成回归集 |

## 2. 基础信息

| 项 | 值 |
|---|---|
| Base URL | `http://localhost:8000`（dev） · `https://api.your-domain` (prod) |
| 协议 | HTTP/1.1 + JSON |
| 认证 | 本地无；生产 Bearer Token / OIDC |
| 追踪 | 在请求 header 加 `X-Trace-Id`；服务端响应也回写 |
| 时区 | UTC，ISO8601 字符串 |

## 3. 算法工程师消费 Dataset 的标准路径

### 3.1 找一个 trainable official dataset

```bash
curl 'http://localhost:8000/api/v1/datasets?dataset_type=official&status=active'
```

返回字段：

```jsonc
{
  "items": [
    {
      "id": "ea4894c8-...",
      "name": "ds_night_vru_xxx_official",
      "dataset_type": "official",
      "dataset_version": 1,
      "source_type": "tags",
      "requirement_id": "...",
      "allow_train": true,
      "status": "active",
      "tag_expr": "promoted_from:5aee788d-...",
      "slice_strategy": "flexible",
      "ts_policy": "flexible_window",
      "default_range_l": -1, "default_range_r": 3,
      "created_at": "2026-04-29T...", ...
    }
  ],
  "total": 1
}
```

### 3.2 拉 sample 列表（训练 dataloader 直接消费）

```bash
curl 'http://localhost:8000/api/v1/datasets/ea4894c8-.../samples?limit=2000'
```

每条 sample：

```jsonc
{
  "id": "...", "dataset_id": "ea4894c8-...",
  "clip_id": "c-0b7cf8d7-...",   // 物理 clip 在 data/lance/c-<uuid>/
  "ts": 1763354223671148337,     // ns 时间戳，clip 内 sample 中心
  "range_l": -1, "range_r": 3,    // 帧范围，相对 ts
  "ts_origin": "flexible",        // flexible / from_tag / computed_1to4 / from_csv / random_window
  "training_type": "train",       // train / test / holdout
  "extra_meta": {
    "window": [start_ns, end_ns],
    "scenario": "night_intersection_vru",
    "vehicle": "L1NSPGHB0SB...",
    "promoted_from_sample_id": "..."  // 反查 customized 来源
  }
}
```

### 3.3 直接消费 JSONL artifact（推荐，最高速）

每次 release 同时落一份 jsonl 文件：

```
data/exports/<official_dataset_id>-v<n>.jsonl
```

```bash
# 算法侧
import json
with open('data/exports/ea4894c8-...-v1.jsonl') as f:
    for line in f:
        sample = json.loads(line)
        clip = load_lance_clip(sample['clip_id'])
        window = clip.slice(sample['ts'] + sample['range_l'] * frame_ns,
                            sample['ts'] + sample['range_r'] * frame_ns)
        ...
```

### 3.4 反向查 trace（验证数据来源）

```bash
# 给定 dataset id，查它从哪个需求来
curl 'http://localhost:8000/api/v1/datasets/ea4894c8-...' | jq '.item.requirement_id'

# 给定 trace id，看完整链路
curl 'http://localhost:8000/api/v1/snapshots/trace_e2e_3900a3b1799d'
```

## 4. 资源 CRUD（核心端点）

### 4.1 Dataset

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/v1/datasets` | 列表（filter `dataset_type / status / requirement_id`） |
| POST | `/api/v1/datasets` | 创建（body 同 DatasetV2 schema） |
| GET | `/api/v1/datasets/{id}` | 详情 |
| GET | `/api/v1/datasets/{id}/samples` | 样本列表 |
| POST | `/api/v1/datasets/{id}/samples` | 写样本（mode: flexible / one_to_four / random_sample） |
| POST | `/api/v1/datasets/{id}/cut` | 灵活切割快捷入口 |
| POST | `/api/v1/datasets/{id}/promote` | customized → official 提级 |

### 4.2 Asset

| Method | Path |
|---|---|
| POST | `/api/v1/assets` —— 登记 raw / derived asset |
| GET | `/api/v1/assets?asset_kind=...&clip_id=...&...` |
| GET | `/api/v1/assets/{id}` |

### 4.3 LineageEvent（Snowflake 中心）

| Method | Path |
|---|---|
| POST | `/api/v1/events` —— 写事件 + EventResult |
| GET | `/api/v1/events?...` —— 列表 |
| GET | `/api/v1/events/{id}` —— 详情 |
| GET | `/api/v1/events/dimensions/{tagging\|labeling\|checking\|mining}` —— 4 维度视图 |

### 4.4 Requirement / DataTask / OperationsTask / PipelineRun

参见 [模块 PRD · Requirement](../prd/module-requirement.md) 的字段表 + Internal API 文档的路径清单。

### 4.5 Clip（只读）

| Method | Path |
|---|---|
| GET | `/clips?scenario=&tag=&keyword=&...` |
| GET | `/clips/{id}` |
| GET | `/clips/{id}/cameras/{cam}/video` —— HTTP Range 视频流 |
| GET | `/clips/{id}/cameras/{cam}/aligned` —— 关键帧对齐 |

## 5. SDK（计划）

> 目前无独立 SDK，建议用上述 HTTP API。Python/TS SDK 在 roadmap 中。

未来 SDK 形态：

```python
# 计划中的 Python SDK
from ai_data_engine import Client
client = Client(base_url='http://localhost:8000')

ds = client.datasets.get('ea4894c8-...')
samples = client.datasets.samples(ds.id, limit=2000)

# Cornercase 反馈
client.events.create(
    event_type='mining',
    source_type='shadow_model_disagreement',
    results=[{'clip_id': 'c-...', 'payload_type': 'mining_candidate', 'tags': 'hard_case_v1'}],
)
```

## 6. 限流与配额

- 本地 dev：无限流
- 生产：每个 token 默认 100 req/s，可配；超限返回 429

## 7. 兼容性策略

- API 版本通过路径前缀：`/api/v1/...` 是当前稳定版
- legacy 路径（无前缀的 `/datasets` / `/clips` 等）仅本机使用，外部消费请用 `/api/v1/...`
- 字段新增不破坏；删字段需 deprecation 公告
- breaking change 升 `/api/v2/...`

## 8. 常见示例

### 8.1 创建一个 customized dataset（外部脚本）

```bash
curl -X POST http://localhost:8000/api/v1/datasets \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "ds_my_cornercase_v1",
    "dataset_type": "customized",
    "source_type": "other",
    "allow_train": false,
    "tag_expr": "hard_case_night_vru_v1",
    "default_range_l": -1, "default_range_r": 3
  }'
```

### 8.2 灌一批 sample（mining 工具自动化）

```bash
curl -X POST 'http://localhost:8000/api/v1/datasets/<id>/samples' \
  -H 'Content-Type: application/json' \
  -d '{
    "mode": "flexible",
    "clip_id": "c-...",
    "ts_start": 1763354200000000000,
    "ts_end":   1763354210000000000
  }'
```

### 8.3 读 BI 数据（按 trace 聚合）

```bash
# 一条 trace 的全链路对象
curl 'http://localhost:8000/api/v1/trace/trace_e2e_3900a3b1799d'

# 该 trace 的 events
curl 'http://localhost:8000/api/v1/events?x_trace_id=trace_e2e_3900a3b1799d'
```

## 9. 参考

- [E2E Demo 教程](../tutorials/e2e-demo.md) 的 Section 5 给出消费命令模板
- [Dataset + Snowflake 设计](../architecture/dataset-design.md) 详细 schema
- [术语澄清](../architecture/glossary-dataset-scenario-cornercase-tag-label.md) 字段语义
