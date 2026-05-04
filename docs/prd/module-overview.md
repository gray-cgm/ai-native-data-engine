# 模块 PRD · Overview（综合首页 / Role-Based Dashboard）

> 父文档：[整体产品 PRD](./ai-data-loop-infra-prd.md)
> 路由：`/`
> 设计原则：**全局可视、闭环透明**——一屏把"闭环负责人 / 数据工程师 / 算法工程师"三个角色的"今天最该看什么"摆出来，每个数字都能下钻到对应模块。

## 1. 模块定位

Overview 是**整个平台的综合 entry**，按 **Role-Based View** 组织。不是"流水帐 Activity Feed"，是"今天要不要 escalate 的指挥台"。

> 简单记忆：**`/` 看水位，点任一卡进对应模块看明细**。所有数字默认可点，cmd-click 开新标签。

## 2. 角色 × 关注点 × 卡片对照

### 2.1 数据闭环负责人（Manager）

| 关注 | Overview 卡 | 下钻 |
|---|---|---|
| 需求漏斗与进度 | **Requirement Funnel**：4 段 stacked count（drafted → in_progress → completed → blocked）+ 高优需求按时交付率 | `/requirements` |
| 全链路折损 | **Pipeline Funnel**：collection_clips → mining_candidates → labeling_completed → training_samples 4 段数字 | `/pipelines?tab=overview` |
| 北极星 | **Cost Trend**：近 14 天 PipelineRun 累计成本折线（**chart 1**） | `/pipelines?tab=cost` |

### 2.2 数据工程师（DE）

| 关注 | Overview 卡 | 下钻 |
|---|---|---|
| Pipeline 健康 | **Pipeline Health**：今日 running / success / failed 三宫 + 失败 Top 3 | `/pipelines?tab=runs&status=failed` |
| Ops 待办水位 | **Ops Backlog Bar Chart**：6 子域（mining/tagging/labeling/checking/privacy/release）柱状图，**chart 2**；点柱跳对应子域 | `/ops/{module}` |
| 工具监控 | **Tools Health**：tools registry 各项 status 简列 | `/tools/{toolId}` |

### 2.3 算法工程师（Machine Learning Engineer · MLE）

| 关注 | Overview 卡 | 下钻 |
|---|---|---|
| 最新资产动态 | **Latest Official Datasets**：top 5 newest official dataset list | `/catalog/v2/{datasetId}` |
| 数据分布 | **Top Scenarios**：top 5 scenario by clip_count | `/explorer?scenario=...` |
| 快捷入口 | **Quick Links**：`/explorer/search` · `/exports?tab=hard-samples` · `/catalog?tab=official` | 各自直跳 |

## 3. 页面结构

```
PageContainer "Overview"
├── HeroNSM Row (4 Statistic)
│   ├── Total dataset assets
│   ├── Today's pipeline runs
│   ├── 7-day cost
│   └── Ops backlog total
├── Section Manager
│   ├── Requirement Funnel Card
│   ├── Pipeline Funnel Card
│   └── Cost Trend Card (LINE chart, 14d)
├── Section Data Engineer
│   ├── Pipeline Health Card
│   ├── Ops Backlog Card (BAR chart)
│   └── Tools Health Card
└── Section Machine Learning Engineer
    ├── Latest Official Datasets Card
    └── Top Scenarios + Quick Links Card
```

不开 Tabs by Role —— role section 顺着卷轴走，符合 Manager / DE / MLE 同时在线的现场感。每个 section 用专属配色 + 图标的 `<SectionHeader>` 做视觉分段（Overview=blue, Manager=geekblue, DE=volcano, MLE=cyan）。

## 4. 数据源（BFF 端点 → 卡片对应）

| 卡 | 端点 | 解析 |
|---|---|---|
| Hero · Total dataset assets | `GET /api/datasets` | `total` 或 items 长度 |
| Hero · Today's pipeline runs | `GET /api/pipelines/runs` | filter 今日；`items.length` |
| Hero · 7-day cost | `GET /api/pipelines/cost-stats` | `total_cost_7d` 或 by-day 求和 |
| Hero · Ops backlog | `GET /api/ops/overview` | `sum(modules.counts.total)` |
| Requirement Funnel | `GET /api/requirements/stats` | by_status / by_priority |
| Pipeline Funnel | `GET /api/dashboard` + `GET /api/ops/overview` | clip_count / mining counts / labeling counts / dataset_sample_count |
| Cost Trend Line | `GET /api/pipelines/runs?limit=200` | Python 端按 `created_at` 截日聚合 cost |
| Pipeline Health | `GET /api/pipelines/runs?limit=50` | 按 status group |
| Ops Backlog Bar | `GET /api/ops/overview` | `modules.counts.total` per module |
| Tools Health | `GET /api/tools/registry` | `items[].health` |
| Latest Official Datasets | `GET /api/datasets?dataset_type=official&limit=5` | items |
| Top Scenarios | `GET /api/clips/scenarios` | `items` sort by clip_count desc, top 5 |

## 5. 交互规则

- **每个 Statistic 默认可点**：通过 `clickable-card` 全卡跳 + 内部数字明确 `<Link>` 备份
- **chart 中柱 / 点可点**：bar 柱点击跳 `/ops/{module}`；line 点点击跳 `/pipelines?tab=cost&date=...`
- **加载态**：单 Card loading skeleton（不全页 PageLoading），让其它卡片先出
- **错误态**：单 Card Alert error；不阻塞其它卡

## 6. 关键设计决策

- **D1 不引入 dashboard 物化表**：Overview 直接调现有 11 个端点 + 客户端聚合。MVP 量级足够；P3 高频访问触发再加缓存
- **D2 chart 库选 `@ant-design/plots`**：与 antd 设计 token 默契；接受 +1MB bundle 作为代价
- **D3 不做 WebSocket 实时**：刷新按钮 + cmd-R 即可；避免 SSE / WS 接入复杂度
- **D4 Role-Based 用滚动 section 而非 Tabs**：现场角色经常切换，一屏可见 > 标签页切换
- **D5 不显示 trace 链路图**：那是 Pipelines 模块的 Lineage Tab 职责；Overview 只放数字
- **D6 复用 `clickable-card` + `IdCell`**：跟 ui-ux-design.md §4.0 一致，0 新交互模式

## 7. 待办与扩展

- [ ] WebSocket 推送当日 pipeline run state（替代 30s 轮询）
- [ ] Cost Trend 加 by-stage stack（collection / mining / labeling / release）
- [ ] Quick Actions 自定义化（用户固定收藏入口）
- [ ] Hero 顶加"今日 escalation 提醒"区（failed run + SLA 延迟自动汇总）
- [ ] Manager 视角加 SLA 燃尽图
