# 模块 PRD · Explorer（Clip 检索 / 详情 / 切割）

> 父文档：[整体产品 PRD](./ai-data-loop-infra-prd.md)
> 路由：`/explorer` · `/explorer/search` · `/explorer/clips/:clipId`

## 1. 模块定位

Explorer 是**clip-centric 的浏览与切片入口**——用户从原始 Lance 数据出发，按场景 / 标签 / 车型 / 城市 / 关键字检索 clip，进入详情页观看视频、查看多模态对齐数据、并按时间窗口**灵活切割**出 dataset sample。

> 简单记忆：**Explorer 是把 Lance clip 翻译给人看的层**。

## 2. 用户故事

| 角色 | 场景 | 主操作 |
|---|---|---|
| 数据工程师 | 找一段含「夜间 + 雨天 + VRU」的 clip | search 页关键字 + 多 tag 过滤 |
| 算法 | 看一段 clip 的多 sensor 数据 | 详情页 Tabs：Video / Topic frames / Schema |
| 标注供应商 | 拿一段切片去标注 | 详情页 Mark in / Mark out → Save Cut → 选 customized dataset |
| 新人 | 浏览整体数据分布 | distribution 页看 scenario / tag / vehicle 直方图 |

## 3. 主要功能

### 3.1 search 页（`/explorer/search`）

- 多维过滤：scenario / vehicle / city / district / tag / da_tag / has_wm / 关键字
- 双视图切换：Table（密集信息）/ Wall（卡片预览，hover 自动播放视频缩略）
- Wall 卡内容：clip_id（ellipsis）/ vehicle@city/district / start · duration / **ClipProgressBar（lance start/end）** / topic 数 / cam 数 / tags
- 排序：start_time_desc（默认）/ start_time_asc / keyframe_count

### 3.2 distribution 页（`/explorer`）

- scenario / city / vehicle 分布直方图
- tag 词云
- 数据规模 KPI（clip 数 / 关键帧总数 / 累计时长）

### 3.3 clip 详情页（`/explorer/clips/:clipId`）

#### 3.3.1 Metadata 卡

- Clip ID（copyable，monospace）
- Vehicle / Location / Scenario / Duration / Tags
- **Timeline 进度条**：来自 Lance metadata 的 `start_time / end_time`（ns），全宽展示

#### 3.3.2 Video & Cameras Tab

- 多摄像头列表（recordable / AVM 分类）
- HTML5 video 播放器，HTTP Range 支持
- **VideoTimeline 富交互**：start..end 全段 ns 时间轴 + 关键帧 tick + 双手柄选区（Mark In / Mark Out 默认覆盖整段）
- 默认 cut 窗口 = clip 整段 → Save Cut 按钮立即可用
- 点击轨道任意位置 scrub；拖动时自动吸附最近关键帧

#### 3.3.3 Topic Frames Tab

- 选 topic.lance 列 / standalone topic
- 预览前 N 行 raw payload（截断 800 字符）
- 点击 Frame# 跳到视频对应 currentTime

#### 3.3.4 Schema Tab

- topic.lance 列名 + 非空数 / camera 索引列 + frame 数 / standalone 表 + 行数

### 3.4 Save Cut Modal（灵活切割核心）

- Mark in / Mark out 选定 [ts_start_ns, ts_end_ns]
- 选已有 customized dataset 或一键 New Dataset
- 提交：调 `POST /api/datasets/:id/cut` → 写 DatasetSample + LineageEvent(flexible_cut)
- 幂等：相同 (dataset, clip, ts) 二次提交返回 deduplicated

## 4. 与其他模块的关系

| 输入来源 | 描述 |
|---|---|
| Lance 物理目录 `data/lance/c-<uuid>/` | 真正的 clip 主存 |
| `clip_catalog.sqlite` 索引 | 快速点查 / 多维过滤 |

| 输出去向 | 描述 |
|---|---|
| Catalog | Save Cut → customized dataset 的 sample |
| Operations · Mining | search 页可用 query 一键创建 mining ops_item |

## 5. 关键设计决策

- **时间戳 = Lance ns 单一来源**：所有 in/out / 当前播放位置都以 ns 为基准；video 元素的秒数仅用于 UI 双向映射，写入 sample 时直接落 ns。
- **关键帧吸附阈值 = 2 帧 ns**：拖动手柄时若距某关键帧 ≤ 2 帧就 snap；避免过激吸附。
- **wall 卡片的 hover 自动播放**：纯前端 mouseenter/leave，节流到本地视频缓存可用时启用。
- **Mark out > Mark in 校验**：Save Cut 按钮在 `cutValid = startNs < endNs` 时才启用。

## 6. 待办与扩展

- [ ] Multi-cut 一次切多段（Trim mode 切分一段为多段）
- [ ] 跨 clip 相似度检索（基于 vector index）
- [ ] 在 Timeline 上叠加 ops_items（labeling / checking 状态）
- [ ] 关键帧 tick 加上 fps 元数据，废弃硬编码 10Hz
