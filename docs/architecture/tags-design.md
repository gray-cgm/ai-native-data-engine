# Tags 设计

> 父：[领域模型与语义](./domain-model.md) · [业务流程总览](./business-flows.md)
>
> Tag 是平台对 clip 的"轻量定性描述"，与 Labeling 的精细几何标注分立。本文规定 tag 的来源、版本、存储与查询规则。

---

## 一、设计目标

| 目标 | 实现 |
|---|---|
| 区分人工 vs 自动 | 必填 `source` 枚举 |
| 自动 tag 必带算法版本 | `source_version` 必填，格式 `<tagger_id>@<version>` |
| 同一 tag 可被多源重复打 | `(clip_id, name, source, source_version)` 联合唯一，不互相覆盖 |
| 支持 query 过滤 + 聚合 | `clip_tags` 关系表 + Lance 端 ClipMeta.tags 双写 |
| 兼容历史 `da_tags` | 一次性迁移：所有 da_tags → `Tag(source=manual, source_version="legacy:da")` |

---

## 二、Tag 模型

```python
class TagSource(str, PyEnum):
    MANUAL = "manual"               # 人工添加（标注员 / 运营 / 算法工程师）
    AUTO_TAGGING = "auto_tagging"   # auto_tagging pipeline 系统打标
    AUTO_LABELING = "auto_labeling" # auto_labeling pipeline 副产 tag
    RULE = "rule"                   # 规则引擎匹配（场景规则 / tag 规则）
    IMPORT = "import"               # 从外部源导入（vendor / 上游系统）

@dataclass
class Tag:
    name: str               # 短名（snake_case 或 kebab-case）
    source: TagSource
    source_version: str     # auto: "auto-tagger@v3.2"；manual: "user:alice@example.com"
    confidence: float | None  # auto 类必填 [0, 1]；manual 一般为 None
    applied_at: datetime
    notes: str | None       # 额外上下文（model_run_id / rule_id / reviewer notes）
```

### `name` 命名规范

- 一律小写，词间用 `-` 或 `_`，避免空格与全角符号
- 三类前缀（可选）：
  - **场景**：`scene-night` / `scene-intersection` / `scene-rain`
  - **属性**：`attr-vru` / `attr-occluded` / `attr-low-light`
  - **事件**：`event-cut-in` / `event-disengagement` / `event-aeb-trigger`
- 无前缀的纯名（`night` / `cutin`）兼容旧数据，新写入鼓励带前缀

### `source_version` 命名规范

| Source | 格式 | 示例 |
|---|---|---|
| `manual` | `user:<email>` | `user:alice@example.com` |
| `auto_tagging` | `<tagger_id>@<semver>` | `auto-tagger@v3.2.1` |
| `auto_labeling` | `<labeler_id>@<semver>` | `auto-bbox-labeler@v0.7` |
| `rule` | `rule:<rule_id>@<semver>` | `rule:night-shadow@v1` |
| `import` | `vendor:<name>@<batch_id>` | `vendor:zhonghai@2026-04-batch3` |

---

## 三、存储

### 3.1 `clip_tags` 表（SQLite / PG，平台元数据）

```sql
CREATE TABLE clip_tags (
    id              VARCHAR(36) PRIMARY KEY,
    clip_id         VARCHAR(36) NOT NULL,
    name            VARCHAR(64) NOT NULL,
    source          VARCHAR(16) NOT NULL,       -- TagSource enum
    source_version  VARCHAR(128) NOT NULL,
    confidence      REAL,                       -- 0..1, NULL allowed for manual
    applied_at      TIMESTAMP NOT NULL,
    notes           TEXT,
    x_trace_id      VARCHAR(64),                -- 串入 Snowflake 链路
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (clip_id, name, source, source_version),
    INDEX (clip_id),
    INDEX (name, source),
    INDEX (x_trace_id)
);
```

唯一键 `(clip_id, name, source, source_version)` 保证：

- 同一 `auto-tagger@v3.2` 在同一 clip 上只写一行（重复跑跳过）；
- 同一 tag 在不同算法版本下分别保留（用于 A/B 对照）；
- 人工同 email 重复 tag 不会写多行；不同人工各自一行。

### 3.2 Lance ClipMeta.tags（文件层冗余）

ClipMeta 增加结构化 `tags` 数组：

```python
class ClipMetaTag(BaseModel):
    name: str
    source: TagSource
    source_version: str
    confidence: float | None
    applied_at: datetime
```

写入路径：`clip_tags` 落 SQLite 后异步同步到 Lance ClipMeta，作为只读冗余加速 clip-doc 直读场景。**真值以 SQLite 为准**，Lance 侧滞后是允许的。

### 3.3 历史 `da_tags` 字符串数组的处理

旧字段 `ClipMeta.da_tags: list[str]` 是 data analyst 工程师人工打的字符串。一次性迁移：

```python
for tag_name in clip.da_tags or []:
    db.add(ClipTag(
        clip_id=clip.id, name=tag_name,
        source=TagSource.MANUAL, source_version="legacy:da",
        confidence=None, applied_at=clip.created_at,
        notes="migrated from da_tags",
    ))
```

迁移完成后 `da_tags` 字段在 schema 中保留 `Deprecated`，写路径关闭，读路径返回空数组并 warn。下一个 schema 版本删除。

---

## 四、查询模式

| 场景 | SQL |
|---|---|
| 找夜间路口的 clip（任意来源） | `SELECT clip_id FROM clip_tags WHERE name IN ('scene-night','scene-intersection') GROUP BY clip_id HAVING COUNT(DISTINCT name)=2` |
| 找 auto-tagger v3.2 标过 cut-in 但 v3.1 没标过的 clip | `SELECT a.clip_id FROM clip_tags a LEFT JOIN clip_tags b ON a.clip_id=b.clip_id AND b.source_version='auto-tagger@v3.1' AND b.name='event-cut-in' WHERE a.source_version='auto-tagger@v3.2' AND a.name='event-cut-in' AND b.id IS NULL` |
| 找置信度低于 0.6 的 auto tag（送人工抽检） | `SELECT * FROM clip_tags WHERE source LIKE 'auto%' AND confidence < 0.6` |
| 找算法版本覆盖了多少 clip | `SELECT source_version, COUNT(DISTINCT clip_id) FROM clip_tags WHERE source='auto_tagging' GROUP BY 1` |
| 查 clip 的全部 tag（按时间倒序） | `SELECT * FROM clip_tags WHERE clip_id=? ORDER BY applied_at DESC` |

---

## 五、与 LineageEvent 的关系

每次 tagging 动作（auto 或 manual 批次）写一条 `LineageEvent(event_type='tagging')`，关联 N 行 `EventResult`，每个 `EventResult.subject_id` 是 clip_id，`payload` 携带 `{tag_name, source_version, confidence}`。`clip_tags` 是 EventResult 的"投影视图"——同源信息双写到关系表加速查询。

数据流：

```
auto-tagger 模型推理（PipelineRun）
  → LineageEvent(tagging) + N 条 EventResult
  → 投影到 clip_tags（同 trace_id）
  → 异步同步到 Lance ClipMeta.tags
```

---

## 六、来源细则

### 6.1 `manual`

- 必填 `source_version="user:<email>"`
- `confidence` 留空
- 写入路径：标注员 UI / 运营批量 import / 算法工程师 ad-hoc
- 删除：仅原作者或管理员可删，写一条 `LineageEvent(event_type='tag_revoked')`

### 6.2 `auto_tagging`

- 必填 `source_version="<tagger_id>@<semver>"`
- 必填 `confidence`
- 写入路径：`workflows.tagging.auto_tagger_run` PipelineRun 落地
- 模型升级：旧版本 tag 不删，新版本 tag 共存——下游可选择按 `source_version` 过滤

### 6.3 `auto_labeling`

- 与 `auto_tagging` 类似，但通常作为 labeling 副产（labeling 模型预测了 bbox 顺带产出 scene tag）
- `notes` 建议带 `linked_event_id` 指向 labeling 的 LineageEvent，便于回查

### 6.4 `rule`

- `source_version="rule:<rule_id>@<semver>"`
- `confidence=1.0`（规则确定性）
- 规则定义存 `tagging_rules` 表（不在本文档范围）

### 6.5 `import`

- 外部 vendor / 上游系统迁入
- `source_version="vendor:<name>@<batch_id>"`
- `notes` 建议带 `import_run_id` / vendor 提供的原始 schema

---

## 七、查询视图（Snowflake 4 维度之一）

`tagging` 是 [Snowflake 设计](./dataset-design.md) 4 个查询维度之一：

```sql
-- "tagging" 视图：按 tag + 算法版本聚合 clip 数
SELECT name, source, source_version, COUNT(DISTINCT clip_id) AS clip_count
FROM clip_tags
WHERE x_trace_id = ?
GROUP BY 1, 2, 3
ORDER BY clip_count DESC;
```

视图通过 query filter 暴露，无需独立物理表。

---

## 八、API 入口

| 操作 | 端点 | 备注 |
|---|---|---|
| 列举某 clip 的 tags | `GET /clips/:id/tags` | 默认按 applied_at desc，支持 ?source=manual 过滤 |
| 添加 manual tag | `POST /clips/:id/tags` | body 需带 `name`；`source` 强制为 `manual` |
| 删除 tag | `DELETE /clips/:id/tags/:tag_id` | 写一条 LineageEvent(tag_revoked) |
| 批量 auto 写入 | 内部 only：`workflows.tagging.bulk_apply` | 不暴露给 Web |
| 按 tag 反查 clip | `GET /clips?tag=event-cut-in&min_confidence=0.7` | 走 clip_tags 索引 |

---

## 九、参考

- [业务流程总览](./business-flows.md)（阶段 ③ Tagging 子流程）
- [Dataset + Snowflake 设计](./dataset-design.md)（4 查询视图）
- [领域模型与语义](./domain-model.md)
