# 模块 PRD · Catalog（数据集目录）

> 父文档：[整体产品 PRD](./ai-data-loop-infra-prd.md)
> 路由：`/catalog` · `/catalog/v2/:datasetId` · `/catalog/:scenarioId`

## 1. 模块定位

Catalog 是**数据集（Dataset）的浏览与管理入口**——所有 customized / official 数据集在这里被列出、搜索、提级（Promote）后再交给算法工程师消费。

> 简单记忆：**Operations 产出 → Catalog 沉淀 → Pipelines 加工 → Catalog 交付**。

## 2. 用户故事

| 角色 | 想要 | 通过 Catalog 怎么做 |
|---|---|---|
| 算法工程师 | 找一个可训练的 official dataset | Datasets Tab → Official 子 Tab → 关键字搜 → 点详情 → 导出 jsonl |
| DRE / 数据方 | 看自己挂的 customized 工作集进展 | Datasets Tab → Customized 子 Tab → 按 requirement_id 过滤 |
| PM | 浏览本月的发版历史 | Datasets Tab → Official → 按创建时间排序 |
| 新人 | 大致看下都有什么 clip | By Scenario Tab → 按 scenario 聚合视图（旧逻辑保留） |

## 3. 主要功能

### 3.1 双视图切换（Segmented）

| 视图 | 数据源 | 默认 |
|---|---|---|
| **Datasets**（默认） | `GET /api/datasets`（来自 `datasets_v2`） | ✅ |
| **By Scenario** | `fetchClipDatasets()` 按 `meta.scenario` 聚合 | ❌ |

### 3.2 Datasets 视图：customized / official 双 Tab

- 列表字段：name · type · version · trainable · slice · requirement · tag_expr · created
- 顶部右上角「+ New dataset」按钮，弹 NewDatasetModal（详见 §4）
- 空态有一键 CTA「Create first dataset」
- 关键字搜索：按 name / id / tag_expr / requirement_id

### 3.3 Dataset 详情页（`/catalog/v2/:id`）

- 顶部 Statistics 卡：samples / version / trainable / status
- Metadata Card（id / type / source / slice strategy / tag_expr / requirement / created）
- promoted-official 顶部 Alert 显示来源 customized 链接，可一键回跳
- Samples 表：clip_id（链 → Explorer ?ts=...）/ ts(ns) / range / origin / split / created；带搜索筛选

### 3.4 New Dataset 弹窗

- 字段：name · type（customized/official）· source（tags/csv/other）· tag_expr · requirement_id · default_range_l/r · allow_train
- 创建后跳转新 dataset 详情页

## 4. 与其他模块的关系

| 输入来源 | 描述 |
|---|---|
| Operations · Mining / Explorer 灵活切割 | 产生 customized dataset 的样本 |
| Operations · Release Promote | customized → official 提级 |
| Pipelines · release run | 终态 PipelineRun 通过 snapshot manifest 关联 official dataset |

| 输出去向 | 描述 |
|---|---|
| 算法工程师 | API `/api/v1/datasets/:id/samples` + JSONL artifact |
| Explorer | clip 详情页可跳回 Catalog dataset 详情 |

## 5. 关键设计决策

- **Dataset 只剩 customized + official 两类**——不再有第三种语义。
- **dataset_id 是 UUID**——不再用 `scenario:slug` 的字符串拼装作为 dataset_id。
- **样本粒度 = (clip_id, ts, range_l, range_r)**——同一 clip 可在多 dataset 以不同 ts 存在。
- **Promote 是不可逆的复制**——customized 改了不会自动同步到 official；official 想更新需重新 promote 出 v+1 版本。

详细设计见 [Dataset + Snowflake 设计](../architecture/dataset-design.md)。

## 6. 待办与扩展

- [ ] official dataset 的 freeze / deprecated 状态切换 UI
- [ ] 多 dataset 之间的 diff（哪些 sample 加了 / 删了）
- [ ] artifact 直接下载入口（带签名 URL）
- [ ] dataset 评估指标关联（与训练 metrics 联动）
