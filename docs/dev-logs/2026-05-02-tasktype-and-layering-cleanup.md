# 2026-05-02 · TaskType 重构 / 分层边界 / Tags 重设计 / Mermaid 交互 / 文档拉直

本日合并五件事：

1. `TaskType` 两轮重构，最终 6 类（对齐 Tesla / Waymo / Cruise）
2. `python/services` ⇄ `apps/<app>/src/services/` 撞名问题彻底拆解
3. `da_tags` 历史债清理 → 新 `Tag` / `clip_tags` 结构化设计
4. Web 文档 Mermaid 三轮交互修复（自适应 / pan-zoom / pinch 灵敏度）
5. 全部架构文档去历史叙事 + 大幅压缩

---

## 1. TaskType：从 4 类 → 5 类 → 6 类

### 演进

| 轮次 | 触发 | 结果 |
|---|---|---|
| 起点 | 现状 | `COLLECTION` / `ANNOTATION` / `QUALITY_CHECK` / `PIPELINE` |
| 第 1 轮 | "Pipeline 不是业务里程碑；Mining 与 Collection 平行" | 删 `PIPELINE` 改 `RELEASE`；加 `MINING`。共 5 类 |
| 第 2 轮 | "对齐头部团队术语；annotation 太粗，要分场景级 vs 对象级" | 拆 `ANNOTATION` → `TAGGING` + `LABELING`；`QUALITY_CHECK` 改名 `CHECKING`。共 6 类 |

### 最终 6 类（[apps/api/src/models/base.py](../../apps/api/src/models/base.py)）

| TaskType | 中文 | 行业惯例 |
|---|---|---|
| `collection` | 数据采集 | Tesla 路测 + shadow mode；Waymo 自有车队 |
| `mining` | 数据挖掘 | active learning / hard-negative mining / 相似度召回 |
| `tagging` | 场景级打标 | scene tagging / metadata tagging（auto-tagger 主导） |
| `labeling` | 对象级精细标注 | 2D/3D bbox / seg / track / lane（人工 + auto-pre-label） |
| `checking` | 质量校验 | QA gate / review |
| `release` | 发版交付 | dataset release / training set freeze |

**核心理由**：tagging（场景级，自动化覆盖率高）与 labeling（对象级，强人工）成本结构 / SLA / 人机配比根本不同，合并到 `annotation` 会让 ops 工作流、计费、SLA 错配。

### 级联代码

| 文件 | 改动 |
|---|---|
| [apps/api/src/scripts/e2e_demo.py](../../apps/api/src/scripts/e2e_demo.py) | `_TASK_TYPE_MAP` 6 键 + 旧值兼容；`_DEFAULT_DATA_TASKS` 拆 6 条；`_STAGE_TO_TASK_TYPE` / `_OPS_TO_TASK_TYPE` 一一对应；字段 `pipeline_id` → `release_id` |
| [apps/api/src/scripts/seed_trace_demo.py](../../apps/api/src/scripts/seed_trace_demo.py) | `TASK_TITLES` 加 `TAGGING` / `LABELING` / `CHECKING` / `RELEASE` |
| [apps/api/src/scripts/onboarding/s04_business_flow.py](../../apps/api/src/scripts/onboarding/s04_business_flow.py) | 拆 6 条；mining ops_task 挂 mining DataTask |
| [apps/api/src/scripts/requirements_demo.py](../../apps/api/src/scripts/requirements_demo.py) | `task_type: annotation` → `labeling` |
| 3 个 scenario yaml（night_vru / urban_intersection / highway_cutin） | 每个加 tagging + labeling 双任务，`pipeline / quality_check / annotation` 全替换 |
| [apps/web/src/modules/requirements/pages/requirement-detail.page.tsx](../../apps/web/src/modules/requirements/pages/requirement-detail.page.tsx) | `mapDataTaskToOpsModule` 一一对应 6 类 |

旧值通过兼容映射保留：`annotation → LABELING` / `quality_check → CHECKING` / `pipeline → RELEASE`，老 yaml 与历史 DB 行可继续读出。

---

## 2. 分层边界：拆掉 `python/services`

### 现状诊断

仓库里同时有 `python/services` 与 `apps/api/src/services/`，名字撞但职责完全不同：

- 前者：scenario_triage / streaming demo 的 entry，含锁 + container 装配，190 行
- 后者：FastAPI 进程内、与 SQLAlchemy session 强绑定的事务型服务（`dataset_slice_service.promote_to_official` 等）

新人看到 `from services import …` 无法判断是哪一个。同时 `python/workflows` 下还有 `assets/pipeline.py`，名字与 Dagster 的 `assets/` 概念撞。

### 落地

| 动作 | 路径 |
|---|---|
| 删除 `python/services/` 整个 workspace 包 | — |
| 拆 → `python/workflows/demo/scenario_triage.py` | [link](../../python/workflows/src/workflows/demo/scenario_triage.py) — `run_scenario_triage_demo` / `get_scenario_triage_summary` + lock |
| 拆 → `python/workflows/streaming/runner.py` | [link](../../python/workflows/src/workflows/streaming/runner.py) — `run_local_streaming` / `get_local_streaming_summary` + lock |
| 重命名 `workflows/assets/` → `workflows/materialization/` | `pipeline.py` → `dataset_pipeline.py` |
| 新增 `apps/orchestrator/src/resources/runtime.py` | `RuntimeContainerResource`（Dagster `ConfigurableResource`），按 profile 路径懒加载 `RuntimeContainer` |
| 重写 `apps/orchestrator/src/definitions.py` | asset body 改用 `context.resources.container.get()`；imports 从 `services` 改 `workflows.demo` |
| 更新 `apps/api/src/api/routes/{samples,streaming}.py` | 直接 `from workflows.demo / workflows.streaming` |
| 依赖清理 | 根 / api / orchestrator 的 `pyproject.toml` 移除 `ad-services`；`uv lock` 重新生成（Removed `ad-services v0.1.0`） |

### 边界规则（最终态）

- `python/{core, adapters, profiles, workflows}` —— 框架中立的库层
- `apps/{api, bff, web, orchestrator, scheduler}` —— 运行时绑定层
- 判定测试：**如果明天 FastAPI 与 Dagster 都不存在，这段代码还应存在吗？是 → `python/`；否 → `apps/`。**

完整规则与 PR checklist 见 [layering-and-orchestrator-boundaries.md](../architecture/layering-and-orchestrator-boundaries.md)。

---

## 3. Tags 重设计：从 `da_tags` 到 `clip_tags`

### 现状诊断

- `da_tags` 是历史债（`da` = "data analyst" 简称，含义不清）；存在 `ClipMeta.da_tags` (CSV) 与 `EventResult.da_tags` 两处，语义混乱
- 不区分人工 / 自动来源；自动 tag 没有算法版本，无法做模型升级 A/B 对照
- 没有 confidence；auto-tagger 低置信样本无法主动送审

### 新设计

权威设计文档：[docs/architecture/tags-design.md](../architecture/tags-design.md)。核心：

| 层 | 内容 |
|---|---|
| 领域对象 | `Tag` Pydantic model + `TagSource` enum（[python/core/src/core/domain/models.py](../../python/core/src/core/domain/models.py)） |
| ORM 表 | `ClipTag`（[apps/api/src/models/clip_tag.py](../../apps/api/src/models/clip_tag.py)）；`(clip_id, name, source, source_version)` 联合唯一 |
| Alembic 迁移 | [f4b6c8d9e0a1_clip_tags_table.py](../../apps/api/alembic/versions/f4b6c8d9e0a1_clip_tags_table.py) |
| Source 5 类 | `manual` / `auto_tagging` / `auto_labeling` / `rule` / `import` |
| `source_version` 命名规范 | auto: `<tagger_id>@<semver>`；manual: `user:<email>`；rule: `rule:<id>@<semver>`；import: `vendor:<name>@<batch_id>` |
| 兼容并存 | 同一 tag 在不同算法版本下并存（用于 A/B 对照） |

### 数据迁移

[apps/api/src/scripts/migrate_da_tags_to_clip_tags.py](../../apps/api/src/scripts/migrate_da_tags_to_clip_tags.py)：扫描 `EventResult.da_tags`，每条 CSV 拆出 N 个 `ClipTag(source=manual, source_version="legacy:da")`，幂等可重跑。

### 文档同步

- glossary §1.5 / §2 / §3.1 / §4 / §5 / §7.1 / §7.5 全部从 `da_tags` 改写为 `clip_tags`
- domain-model / clip-lance-data-model / business-flows §4.4 加新 tags schema 入口
- e2e-demo Step 4 改为「auto-tagger v3.2 写 clip_tags + 人工抽检 5%」
- Web Docs Center manifest 加 `tags-design.md` 入口（领域模型组）

---

## 4. business-flows.md 二轮重写（user 5 点反馈对应）

| 反馈 | 解决 |
|---|---|
| ① TaskType 命名不专业，应保留 collection / mining / tagging / labeling / checking / release | §1 改写为 6 类表，配 Tesla / Waymo / Cruise 行业惯例对照列 |
| ② 不需要强调"Pipeline 不是 TaskType"，本文是讲业务流程 | 这部分压成 §1 表格脚注，不再独立成节 |
| ③ 全景 Mermaid：collection / mining 应平行同组 | §2 改用 `subgraph S2 direction TB`，COL / MIN 在阶段 ② 内并列汇入候选池 |
| ④ `da_tags` 是历史债，要重设计支持人工 + 自动（区分算法版本）的 tags | 见 §3：新 `Tag` / `clip_tags` 设计 + `tags-design.md` |
| ⑤ ③ 加工 Mermaid 交叉线太多 | 改用 `flowchart TB`（top-bottom），CAND 上下分流到 Tagging / Labeling 后双双汇入 Checking；LineageEvent 旁路改用散文交代，不画进主图 |

---

## 5. 文档拉直：架构文档只描述当前设计

按"架构文档不留历史叙事 / 历史下沉 dev-log"原则，全面重写压缩。

| 文档 | 行数变化 | 主要动作 |
|---|---|---|
| `system-directory-and-domain-design.md` | 952 → 195 | 砍 phase 占位表与重复领域分层；§2.7 改"应用服务的两个去处" |
| `core-adapters-profiles-workflows.md` | 498 → 153 | 砍重复"为什么补这篇"自问自答 |
| `local-first-streaming-evolution.md` | 376 → 102 | 三阶段表格化；对象字段表代替散文 |
| `overview.md` | 215 → 137 | 删两份重复"两种视角" |
| `business-flows.md` | 230 → 211 | TaskType 升 6 类 + Mermaid 平行布局重排 + 加 tags 入口 |
| `layering-and-orchestrator-boundaries.md` | 201 → 137 | 去掉"陷阱已消除"叙事 |
| `fdl-integration.md` | 182 → 80 | 三类服务映射用表代替散文 |
| `monorepo-modules.md` | 166 → 165 | 目录树注释化；中文化能力域命名 |

并行同步：`overview.md` / `monorepo-modules.md` / `fdl-integration.md` / `local-first-streaming-evolution.md` / `core-adapters-profiles-workflows.md` / `domain-model.md` / `ai-data-platform-gap-map.md` 中旧 `python/services/<x>` 全部分流到 `python/workflows/<x>` 或 `apps/<app>/src/services/<x>`；`adr/ai-data-platform-roadmap.md` scheduler / query / evaluation / feedback 4 处分流；`ddia2-cognitive-map.md` 链接路径改指 `python/workflows/demo/scenario_triage.py`；`readme.md` 移除 `python/services` 行。

PRD / ADR / gap-map 这类前瞻文档保留 forward-looking 语气，但仍精简。

---

## 6. Web 文档 Mermaid 交互（三轮）

### 6.1 非全屏：自适应不滚动

[apps/web/src/modules/docs/docs-viewer.css](../../apps/web/src/modules/docs/docs-viewer.css#L386)：viewport 改 `display: flex` 居中 + `overflow: hidden`；SVG 同时受 `max-width: 100%` 与 `max-height: 70vh` 约束，浏览器按较小缩放因子等比缩小。横长 / 纵长大图都整张可见，不再有滚动条。Mermaid 配 `useMaxWidth: false` 输出 viewBox + 真实宽高属性，缩放保持 aspect ratio。

### 6.2 全屏：pan-zoom 工具

[apps/web/src/modules/docs/components/mermaid-block.tsx](../../apps/web/src/modules/docs/components/mermaid-block.tsx) 新建 `MermaidPanZoom` 子组件。

- 滚轮缩放（围绕光标锚点）：`factor = exp(-deltaPx × sensitivity)`，按 `event.deltaY` 比例连续缩放
  - macOS pinch（带 `ctrlKey: true`）：sensitivity = 0.01，单帧 ~1–10%
  - 普通滚轮 / 两指滚动：sensitivity = 0.0015，单格 ~7–17%
- 拖拽平移：mousemove / mouseup 走 window 级监听，光标拖出 modal 也不丢；transform 直接 imperative 写到 DOM，避免 60fps setState 卡顿
- 双击复位 + 工具栏（`−` / 百分比 / `+` / 复位）；范围 25%–600%

### 6.3 锚点几何 bug 修复

最初 `zoomAt` 用 `containerRef.getBoundingClientRect()` 算光标偏移，但 stage 是 flex-centered，flex 隐式 offset 没算进来，pinch 缩放跑偏。改成读 `stageRef.getBoundingClientRect()`：rendered rect 同时包含 flex offset 与当前 transform，几何与布局解耦。新公式 `newTx = tx + q * (1 - ratio)`，其中 `q = clientX - stageRect.left`。

---

## 7. 验证

| 项 | 结果 |
|---|---|
| AST 解析 13 个 .py | ok |
| YAML 解析 3 个 scenario | ok |
| `tsc --noEmit`（apps/web） | ok |
| `import` smoke：`workflows.demo` / `workflows.streaming.runner` / `workflows.materialization.dataset_pipeline` | ok |
| `import services` | `ModuleNotFoundError`（确认包已删） |
| `apps/orchestrator/src/definitions.py` | 6 个 asset key + `container` resource 注册 |
| `from src.models import ClipTag, TagSource` + `Base.metadata.tables['clip_tags']` | ok |
| `from core.domain.models import Tag, TagSource` | ok |
| `python -m src.scripts.e2e_demo --reset`（清空 DB 后） | 6 条 DataTask 入库；`clip_tags` 表自动创建（11 列） |
| `uv lock` | Removed `ad-services v0.1.0` |

---

## 8. 待办

- [ ] `python/workflows/src/workflows/demo/pipeline.py` 中 `run_local_demo` 仍直接 `new DuckDBQueryAdapter` / `new LanceVectorAdapter`，应改为从 `RuntimeContainer` 取
- [ ] mermaid pan-zoom 加触控板手势（trackpad two-finger pan in fullscreen 当前是 wheel-zoom，未来可识别 momentum scroll → pan）
- [ ] 跑一次 `python -m src.scripts.migrate_da_tags_to_clip_tags`，把 `EventResult.da_tags` 全部投影到 `clip_tags`；之后下个 PR 关闭 `da_tags` 字段写路径
- [ ] 新增 `apps/api/src/api/routes/clip_tags.py`（`GET /clips/:id/tags` / `POST /clips/:id/tags` / `DELETE /clips/:id/tags/:tag_id`），Web 端 Clip Detail 改用新 endpoint
- [ ] `python/adapters/src/adapters/catalog/sqlite_clip_index.py` 增加按 `clip_tags.name + source_version` 过滤的能力，旧 `da_tags_csv` 列读路径下个 PR 退役
- [ ] `apps/api/src/services/event_service.py` / `lineage_event.py` 中 `da_tags` 字段加 `Deprecated` 注释；下个 schema 版本删除
