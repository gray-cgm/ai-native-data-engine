# 2026-05-04 · Exports MVP 全实装 / UI 交互拉直 / Overview 重写 / 场景数据多样化

> 同日另一篇：[设计稿 2026-05-04-exports-sample-contribution-design.md](./2026-05-04-exports-sample-contribution-design.md)
> 本篇记录"设计稿之后的全部实装 + 沿途几个独立专项"。

本日合并 6 件事：

1. Exports 模块 V1/V2 命名清理（统一一份 routes/exports.py + `/api/v1/exports/*`）
2. **Exports P0/P1/P2 三阶段全部上线**（snapshot 闭环 / dlkit SDK + Consumption / Hard Sample + ROI + Contributions）
3. UI 交互可感知性体系：`clickable-row` + `IdCell` + `size="small"`，并按反馈剪枝（去左侧蓝竖条）
4. Overview 重写为 **Role-Based Dashboard**（4 段配色分段 + 2 charts + 全模块下钻）
5. demo 数据 scenario 从 1 类（`xminer-pipeline-video`）扩展到 **9 类真实 ADAS 场景**
6. Algorithm Engineer → **Machine Learning Engineer** 全局重命名

---

## 1. V1/V2 命名清理

### 起因
P0 阶段为新 routes 文件起的别名 `exports_v2_router` + 文档/注释处的 "Exports v2 P0" 字样在 MVP 阶段不必要——团队还没到需要区分老版本的体量，新人 onboard 容易困惑。

### 改动
- 删 `apps/api/src/api/routes/export.py`（旧 `POST /exports/dataset/{id}`），折到 `routes/exports.py` 的 `POST /api/v1/exports/datasets/{dataset_id}`
- main.py 收敛 `exports_v2_router` → `exports_router`
- BFF `services/export-job.ts` 同步改 URL
- alembic 迁移 `a7c9e1d2f3b4_exports_v2_p0.py` → `a7c9e1d2f3b4_exports_p0.py`
- 全局 `grep "Exports v2 / v2 P0 / exports_v2"` 0 命中
- dev-log 文件名 `2026-05-04-exports-v2-sample-contribution-design.md` → `..._exports-sample-contribution-design.md`，propagate 到 PRD / docs manifest / web link

### 决策
**保留 P0/P1/P2/P3 阶段标识**——那是 MVP 内部滚动里程碑，不是产品版本号；与 v1/v2 不同概念。

---

## 2. Exports MVP 三阶段全实装

### P0 · Snapshot 闭环（验证：snapshot.consumed_count 0→7 + e2e_demo 9/9 通过）

| 层 | 文件 |
|---|---|
| ORM | [`apps/api/src/models/{train_run.py, dataset_snapshot.py}`](../../apps/api/src/models/) |
| 迁移 | [`alembic/versions/a7c9e1d2f3b4_exports_p0.py`](../../apps/api/alembic/versions/) |
| Service | [`apps/api/src/services/train_run_service.py`](../../apps/api/src/services/train_run_service.py) |
| Routes | `routes/exports.py` 第一波 7 个端点 |
| BFF / Web | `exports*.ts` + 新 `modules/exports/` 模块（5 Tab：Snapshots 真实 + 4 placeholder） |
| Demo | e2e_demo 注册 1 条示例 TrainRun |

### P1 · SDK + Consumption（验证：SDK register → 7 events → snapshot 计数同步）

| 层 | 文件 |
|---|---|
| ORM | [`models/consumption_event.py`](../../apps/api/src/models/consumption_event.py)（新表，落主 SQLite） |
| 迁移 | [`alembic/versions/b8d3e5f7a921_exports_p1.py`](../../apps/api/alembic/versions/) |
| Service | `services/consumption_event_service.py`（按 snapshot 一次性 bump 计数，避免 N+1） |
| Routes | +2: `POST/GET /api/v1/exports/usage` |
| **SDK** | 新 workspace 包 [`sdk/dlkit/`](../../sdk/dlkit/) + 加入 uv workspace |
| Web | Consumers Tab + train_run drawer 下钻 |

dlkit MVP 取舍（README 中明示）：
- Buffer 是普通 list + 后台 daemon thread；失败仅 log warning（**不本地落盘**、**不重试**——P3 再补）
- `dataset()` 返回 `list[dict]`，不依赖 PyTorch
- 自动 detect `MLFLOW_RUN_ID` / `WANDB_RUN_ID` / `KUBEFLOW_RUN_ID`

### P2 · Hard Sample / ROI / Contributions（验证：clip-0 hard_score=1.38）

| 层 | 文件 |
|---|---|
| Service | [`services/contribution_service.py`](../../apps/api/src/services/contribution_service.py)（**live SQL GROUP BY**，无 Dagster job + 无 sample_contributions 物化表） |
| Routes | +3: `/contributions` / `/contributions/rollup` / `/contributions/{sample_uid}` |
| /usage | 加 `sample_uid_prefix` 过滤（clip-level lookup 用） |
| SDK | `dlkit.LossLogger(run).log(uids, losses, ...)` 薄壳 helper |
| Web | 替换 3 个 placeholder：HardSamplesView / RoiView / ContributionsView + 共享 ContributionDrawer |
| 跨模块 | Catalog dataset 详情加 `<TrainingImpactSection>` · Explorer clip 详情加 `<TrainingHistorySection>` |
| Demo | e2e_demo seed 12 events 含真实 loss 分布（clip-0 0.8~1.5 高 loss） |

**MVP 公式**：`hard_score = mean_loss × log(1 + consumed_count)`，无 time_decay；P3 加可配置 + 物化。

### Storage 取舍（写入 PRD 显式）
- consumption events 落主 SQLite（< 100k events/snapshot 跑得动）
- 设计稿 D2 决策保留：量级触发后按既定 endpoint 契约迁 DuckDB（业务代码 0 改动）

---

## 3. UI 交互可感知性 + 简化（两轮）

### 第一轮：建立 affordance 体系

发现：所有可点击 element 都是 hover-only 灰底，用户看不出"这行能点"。建立**第一性原则**：at-rest 就要看出来，不靠 hover 才暴露。

落地：
- [`styles/tokens.css`](../../apps/web/src/styles/tokens.css) 加 9 个 `--interactive-*` 变量
- [`styles/layout.css`](../../apps/web/src/styles/layout.css) 加 `.clickable-row` / `.clickable-card` / `.clickable-chip` 全局类 + `:focus-visible` outline
- 共享 [`DataTable`](../../apps/web/src/shared/components/data-table.tsx) 加 `rowHref` / `onRowClick` / `isRowSelected` props，**自动 tabIndex + Enter/Space 键盘可达 + cmd/ctrl/middle-click 开新标签**
- 6 模块 7 个高流量页面接入新 affordance（catalog/explorer/operations/pipelines/exports/requirements）
- 写入 [`docs/prd/ui-ux-design.md`](../prd/ui-ux-design.md) §4.0 Interactive Affordance 章节

### 第二轮（用户反馈：交互过于复杂）

剪枝：
- ❌ 删 `.clickable-row` 左侧 3px 蓝竖条（视觉噪音）
- ✅ DataTable 默认 `size="small"`，CSS 再压 cell `padding: 6px 10px` / th `8px 10px`，表头 600 + 浅灰 bg
- ✅ 新共享组件 [`<IdCell>`](../../apps/web/src/shared/components/id-cell.tsx)（基于 antd `Typography.copyable`），3 variant：`short` / `mono-ellipsis` / `full`
- ✅ 所有 ID 列（dataset_id / clip_id / x_trace_id / train_run_id / artifact_uri）批量替换为 `<IdCell>`，**clip_id 显示不全的硬截 `slice(0,16)` 全部下线**

文档同步：[`docs/prd/ui-ux-design.md`](../prd/ui-ux-design.md) §4.0 改写——删左竖条规则，加密度规则，加 IdCell 强制规则。

---

## 4. Overview 重写为 Role-Based Dashboard

### 起因
原 OverviewPage 是 legacy demo activity feed（PlatformPulse / OperationsPulse / RecentActivityV2 等），不能服务"闭环负责人 / 数据工程师 / 算法工程师"分别要看的指标。

### 重写
按 ui-ux-design.md §4.0 规则 + 新建 [PRD module-overview.md](../prd/module-overview.md)：

```
PageContainer "Overview"
├── 平台北极星 SectionHeader (overview · blue)
│   └── Hero NSM Card (4 Statistic)
├── 数据闭环负责人 SectionHeader (manager · geekblue)
│   └── 3 cards: Requirement Funnel · Pipeline Funnel · Cost Trend (LINE chart)
├── 数据工程师 SectionHeader (de · volcano)
│   └── 3 cards: Pipeline Health · Ops Backlog (BAR chart) · Tools Health
└── 算法工程师 SectionHeader (mle · cyan)
    └── 2 cards: Latest Official Datasets · Top Scenarios + Quick Links
```

### 关键决策
- D1 不引入 dashboard 物化端点——9 个独立 BFF 端点 + 客户端聚合
- D2 chart 库选 `@ant-design/plots`（接受 +1MB bundle 换 antd 设计 token 默契）
- D3 不做实时 WS（D 刷新按钮够用）
- D4 滚动 section vs Tabs by Role——同屏可见 > 切标签
- 删 7 个 orphan 旧 sub-components（验证 zero external import 后再删）

### 文件
新增：[`modules/overview/api.ts`](../../apps/web/src/modules/overview/api.ts) · `components/{ops-backlog-chart, cost-trend-chart, section-header}.tsx` · `pages/overview.page.tsx`（重写） · 新 PRD

### 用户后续反馈：4 段视觉无差别
加 [`<SectionHeader role title subtitle icon>`](../../apps/web/src/modules/overview/components/section-header.tsx) 组件——4px 实色左 accent bar + 浅色 bg tint + 22px 图标 + 标题 + 副标题。

| 段 | role | 主色 |
|---|---|---|
| 平台北极星 | overview | `#1677ff` blue |
| 数据闭环负责人 | manager | `#2f54eb` geekblue |
| 数据工程师 | de | `#fa541c` volcano |
| 算法工程师 | mle | `#13c2c2` cyan |

---

## 5. Scenario 数据多样化

demo 数据所有 25 个 clip 的 `scenario` 都是 `xminer-pipeline-video`——首页 Top Scenarios 卡只显 1 类，Catalog scenario view 也是单 bucket，演示效果差。

写一次性脚本 [`scripts/diversify_scenarios.py`](../../scripts/diversify_scenarios.py)：
- 9 类真实 ADAS 场景按权重池分配（urban-unprotected-left-turn / night-intersection / pedestrian-crossing / traffic-jam-stop-go / tunnel-merge / construction-zone / narrow-road-passing / rainy-highway / highway-cut-in）
- 用 `hash(clip_id + idx)` 确定性 mod 池——重跑 / 团队成员各自跑都是同一结果
- 同时改 SQLite `clips.scenario` + `summary_json`/`meta_json` JSON 内嵌字段 + 25 个 `meta.lance` 文件 overwrite
- 备份 `clip_catalog.sqlite.bak`（460 KB）作为安全网

验证 SQLite ↔ Lance 0 不匹配；GET `/clips/scenarios` 立即返回 9 个 scenario。

---

## 6. Algorithm Engineer → Machine Learning Engineer 全局重命名

用户要求英文全称替换。中文 "算法工程师" 保留。

改动：
- `apps/web/src/modules/overview/{pages/overview.page.tsx, components/section-header.tsx 配置}` 文件 docstring + section subtitle + Page description
- `apps/web/src/modules/docs/manifest.ts` hint
- `docs/prd/module-overview.md` §2.3 标题 + §3 page 结构图 + 末段说明
- `docs/prd/ai-data-loop-infra-prd.md` mermaid node `Algo` → `MLE` + label 加英文全称

`grep -rn "Algorithm Engineer\|algorithm engineer\|Algo\b"` 在 `apps/web/src/` + `docs/prd/` **0 命中**。

---

## 影响的核心文件总览

| 类别 | 数量 |
|---|---|
| 新增 Python 文件 | 6（2 services + 1 ORM + 2 alembic + 1 diversify script） |
| 新 SDK 包 | 1（`sdk/dlkit/`，6 文件） |
| 新增 React 组件 | 11（exports tabs + drawers + cross-module sections + overview cards/charts/section-header + IdCell） |
| 新 Web 模块 | 1（`modules/exports/`） |
| 重写 Web 页面 | 1（overview.page.tsx） |
| 新 PRD 文档 | 2（module-exports.md / module-overview.md） |
| Token / 全局 CSS | 2（tokens.css 加 9 个变量 / layout.css 加 ~90 行 affordance） |
| 删除 orphan | 8（旧 export.py + 7 个 overview legacy components） |

新 routes 总数：`/api/v1/exports/*` 共 12 条端点 ✅

---

## 验证（每步通过才进下一步）

- [x] alembic upgrade head（P0 + P1）
- [x] make e2e-demo --reset 9/9 步通过；banner 含新 endpoints
- [x] dlkit SDK 端到端 smoke：register run → report events → snapshot.consumed_count 同步
- [x] 5 个 P2 endpoints smoke：top hard / dataset rollup / single drilldown / filtered rollup / clip-prefix usage
- [x] `pnpm --filter bff typecheck` ✅
- [x] `pnpm --filter web typecheck` ✅
- [x] `pnpm --filter web build` ✅（4.24~5.70s 各次）
- [x] SQLite ↔ Lance scenario 0 不匹配
- [x] 全局 grep V1/V2 零残留
- [x] 全局 grep "Algorithm Engineer / Algo" 零残留

---

## 还剩什么没做（P3 + 后续）

- [ ] Exports P3：闭环回流（"Send to Mining" 自动 create OperationsTask + `parent_trace_id`）
- [ ] consumption_events SQLite → DuckDB 迁移（量级触发后）
- [ ] sample_contributions 物化 + Dagster schedule 异步刷新
- [ ] dlkit framework callback 适配（PyTorchLightning / HuggingFace Trainer）
- [ ] dlkit 失败降级 jsonl 落盘 + retry（替代当前的 log+drop）
- [ ] dlkit CLI（`dlkit flush` / `dlkit status`）
- [ ] hard_score 公式加 time_decay + 配置化
- [ ] Overview WebSocket 推送（替代 30s 轮询）+ Cost trend by-stage stack
- [ ] Contributions 视图加曲线图（recharts/echarts）
- [ ] 把剩余直接用 antd `<Table>`（未走 `<DataTable>`）的页面也接 `clickable-row`
- [ ] `data/metadata/clip_catalog.sqlite.bak` 何时清理
