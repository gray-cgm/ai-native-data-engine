# AI Native Data Engine · Skill Prompt

> 本文档是面向"已 onboard 的资深工程师"的硬核约束，用作未来 Claude 会话的基线。读完即进入状态，不再重新讲背景。

---

## 1. 核心世界观

### 1.1 四层闭环对象（业务承诺 → 协调 → 执行 → 交付）

```
Requirement
  └─ DataTask × 6        (业务里程碑，固定枚举)
       └─ OperationsTask × N   (人机协同协调单元)
            └─ PipelineRun × N (机器执行单元，统一事实模型)
                 └─ Dataset (customized) ──Promote──> Dataset (official) ──> Asset / Artifact
```

- **DataTask.task_type 固定 6 类**：`collection / mining / tagging / labeling / checking / release`（对齐 Tesla / Waymo / Cruise）
- **OperationsTask.module 固定 6 类**：`mining / tagging / labeling / checking / privacy / release`
- **PipelineRun 不是 TaskType**——它是所有任务复用的"基础设施加工管道"，附着在任意 DataTask 之下
- **`tagging` ≠ `labeling`**：tagging 是场景级（auto-tagger 主导），labeling 是对象级（人工 + auto-pre-label）

### 1.2 Snowflake 事件中心

```
LineageEvent (中心) ──1:N──> EventResult (clip 级结果)
   ↑
   每个动作（labeling / tagging / checking / mining / release / migration / flexible_cut）都写一条
```

4 个查询视图维度（tagging / labeling / checking / mining）通过 query filter 暴露，**无独立物理表**。

### 1.3 易混名词的精确定义

| 名词 | 是什么 | 物理位置 |
|---|---|---|
| **Scenario** | 业务/物理世界分类（夜间路口 / 雨天高速） | `ClipMeta.scenario` 字段 |
| **Cornercase** | clip × 模型版本 × 时间 的三元关系（不是固有属性） | Tag + Mining LineageEvent + 可选 customized Dataset |
| **Tag** | 描述性属性（系统/规则/模型/人产出） | `clip_tags` 关系表（带 `source` / `source_version` / `confidence`） |
| **Label** | 训练真值（bbox / track / seg / 行为） | `AnnotationTask` + Lance 几何列 + EventResult |
| **Dataset** | 训练消费容器（customized = 工作集 / official = 发版集） | `datasets_v2` + `dataset_samples_v2` |
| **Sample** | 在 clip 上灵活切割得到的训练样本（一对多） | `DatasetSample(clip_id, ts, range_l, range_r)` |
| **Clip** | Lance 文件层片段，平台最小统一业务单元 | `data/lance/c-<uuid>/` |

`sample` 和 `clip` 不是同义词：一条 clip 可切多条 sample。

---

## 2. 分层边界（极度重要）

### 2.1 一句话边界

```
python/{core, adapters, profiles, workflows}   ← 框架中立的库层
apps/{api, orchestrator, bff, web}  ← 运行时绑定层
```

### 2.2 判定测试

> **如果明天 FastAPI 与 Dagster 都不存在，这段代码还应该存在吗？**
> 是 → `python/`；否 → `apps/`

| 信号 | 归属 |
|---|---|
| `Depends(get_db)` / SQLAlchemy `Session` / FastAPI 路由形参 | `apps/api/` |
| `@asset` / `OpExecutionContext` / Dagster resource | `apps/orchestrator/` |
| 只接 `RuntimeContainer` + 普通参数 | `python/workflows/` |
| 领域对象 / 协议 / 枚举 / 状态机 | `python/core/` |
| provider 实现(DuckDB / Lance / SQLite / FS) | `python/adapters/` |

### 2.3 各目录硬约束

| 目录 | 职责 | 禁止 |
|---|---|---|
| `python/core` | domain models / protocols / state machine / enums | server lifecycle / scheduler loop / route handler / provider wiring |
| `python/adapters` | metadata / query / storage / table / vector / compute / auth provider | 上层业务流程 |
| `python/profiles` | YAML profile 加载 + `RuntimeContainer` 装配 | 业务逻辑 |
| `python/workflows` | 框架中立流程库（ingestion / catalog / versioning / scenarios / scheduler / query / quality / governance / exports / feedback / evaluation / layout / materialization / demo / streaming） | `import dagster` / `import fastapi` / `Depends` |
| `apps/api/src/api/routes/` | FastAPI 路由（薄壳） | 业务流程实现 |
| `apps/api/src/services/` | FastAPI 进程内事务型服务（与 SQLAlchemy session 强绑定，如 `dataset_slice_service.promote_to_official`） | 不可下沉到 `python/` |
| `apps/orchestrator` | Dagster code location + asset / job / schedule / sensor / resource | asset body 内 `build_container(Path(...))`（用 Dagster resource 注入） |
| `apps/bff` | 浏览器接入 / session / tenant / ViewModel 聚合 | 重复定义 domain fact、直接持有 runtime provider |
| `apps/web` | React UI | 避免直接调 Platform API（必须走 BFF） |

### 2.4 BFF 与底层资产的关系

```
Web → BFF → Platform API → RuntimeContainer / adapters
```

跨语言共享的不是 Python 代码，**是 Platform API 暴露的 HTTP/JSON contract**。BFF 不拥有底层 domain fact，不直接持有 runtime provider；只做 ViewModel 聚合与会话上下文。

---

## 3. 数据库与表结构速查

### 3.1 SQLAlchemy ORM 位置

**全部在 [`apps/api/src/models/`](../../apps/api/src/models/)：**

| 文件 | 表 |
|---|---|
| `base.py` | `Base` + 全局枚举（`TaskType` / `OperationsModule` / `TaskStatus` / `SignOffStatus` / `PipelineStatus` / `TriggerSource` / `RunPurpose` 等） |
| `requirement.py` | `requirements` / `data_tasks` / `operations_tasks` / `pipeline_runs` / `collection_jobs` / `annotation_tasks` / `digital_reconstructions` |
| `ops_item.py` | `ops_items`（执行项明细，按 `module` 分类） |
| `dataset.py` | `datasets_v2` / `dataset_samples_v2` |
| `dataset_snapshot.py` | `dataset_snapshot_manifests`（x_trace_id 收据） |
| `lineage_event.py` | `lineage_events` / `event_results`（Snowflake 中心） |
| `asset.py` | `assets`（raw + derived，含 `producer_pipeline_run_id` / `producer_event_id`） |
| `clip_tag.py` | `clip_tags`（结构化 tag，`(clip_id, name, source, source_version)` 联合唯一） |

**Alembic 迁移**：[`apps/api/alembic/versions/`](../../apps/api/alembic/versions/)

### 3.2 `x_trace_id` 贯穿规则

每条业务链路都生成一个 `x_trace_id`（在第一个 OperationsTask 创建时生成），全程透传：

```
Requirement.id → DataTask.x_trace_id → OperationsTask.x_trace_id
              → PipelineRun.x_trace_id → Dataset.x_trace_id（customized + official）
              → DatasetSample（继承）→ Asset.x_trace_id
              → LineageEvent.x_trace_id → EventResult.x_trace_id
              → ClipTag.x_trace_id
              → DatasetSnapshotManifest.x_trace_id（最终收据）
```

传播载体：HTTP header / SQL 列 / Dagster 任务参数 / Kafka header。

**任意视图按 trace 反查能拿到全链路**。新增表必须含 `x_trace_id` 列，否则破链。

### 3.3 Asset 血缘

`PipelineRun.input_uri / output_uri` 仅作展示。**真血缘走 `Asset.producer_pipeline_run_id` 与 `Asset.producer_event_id` 两个 FK**。derived asset 反查产生它的 run / event 必须走这两列。

---

## 4. 业务模块（一句话职责，按数据闭环旅程排序）

> 不锁数字——业务模块会演进。Web `/` 还有一个综合 Overview Dashboard，是入口
> 视图（不是业务领域模块），文档归在 "整体 PRD" 组。

| 序 | 模块 | 一句话 |
|---|---|---|
| ① | **Requirement** | 需求 + Sign-off + 拆 6 类 DataTask 的入口（4 层闭环起点） |
| ② | **Explorer** | Clip 检索 / 详情 / 灵活切割（Lance ns 时间轴） |
| ③ | **Operations** | 6 子域执行台：mining / tagging / labeling / checking / privacy / release |
| ④ | **Pipelines** | PipelineRun 观测：运行 / 血缘 / 质量 / 成本 / 总览 5 Tab |
| ⑤ | **Catalog** | 数据集目录（customized / official 双 Tab + Promote 操作） |
| ⑥ | **Exports** | 数据交付 + 训练反馈闭环（dlkit SDK + Hard Sample / ROI / Contributions） |
| ⑦ | **Tools** | 微前端工具平台 + iframe 网关（嵌入第三方/内部子工具） |

---

## 5. 任务执行 SOP

### 接到新任务时按下面顺序走：

#### 第 1 步：定位子域 + 分层

- 这是哪个业务模块？（§4 业务模块之一）
- 涉及哪个领域对象？（Requirement / DataTask / OperationsTask / PipelineRun / Dataset / Asset / LineageEvent / ClipTag）
- 需要新增表 / 新增 API / 新增流程逻辑 / 新增 UI 中的哪些？

#### 第 2 步：查表结构

- 先翻 `apps/api/src/models/<file>.py` 看现有 ORM 字段
- 翻 `apps/api/src/models/base.py` 看枚举是否已定义
- 翻最近的 alembic 迁移看 schema 演进
- 不要在 `python/` 里复制 SQLAlchemy ORM 定义

#### 第 3 步：按分层边界编码

| 任务类型 | 落位 |
|---|---|
| 新业务流程（多步骤、可被 FastAPI / Dagster 共用） | `python/workflows/<domain>/` |
| 新 provider 实现（接入新数据库 / 新存储） | `python/adapters/<kind>/` |
| 新领域对象 / 协议 | `python/core/domain/` 或 `python/core/interfaces/` |
| 新 FastAPI 路由 | `apps/api/src/api/routes/<resource>.py`（薄壳，调 service / workflow） |
| 新事务型服务（含 SQLAlchemy session 操作） | `apps/api/src/services/<x>_service.py` |
| 新 Dagster 资产 | `apps/orchestrator/src/assets/<x>.py`（asset body 只调 workflow，用 `context.resources.container.get()` 注入） |
| 新 BFF 路由 / ViewModel | `apps/bff/src/routes/` + `apps/bff/src/viewmodels/` |
| 新 UI 页面 | `apps/web/src/modules/<module>/pages/` |

#### 第 4 步：保护 `x_trace_id` 链路

- 新表必须含 `x_trace_id` 列 + 索引
- 新 API 写入对象时必须从上游对象继承 `x_trace_id`
- 新 LineageEvent 必须带 `x_trace_id`
- 不允许在中途新生成 trace_id 截断链路

#### 第 5 步：写最少必要代码

- 不加无端的错误处理 / 兼容垫片 / 抽象层
- 不写 docstring 之外的解释性长注释
- 不创建额外文档文件，除非用户明确要求
- 测试只覆盖边界与分支，不写"看起来全面"的样板

#### 第 6 步：验证 + 测试（强制，见 CLAUDE.md 测试基线）

- AST 解析 + tsc（如涉及前端）
- 受影响 Python 模块 import smoke
- **`uv run pytest` 全绿**：补/改 `tests/unit/`（adapter 多实现走 contract test 参数化）；接外部存储/库/消息的功能必加 `tests/integration/`（`@pytest.mark.integration`，不可达显式 skip）
- **产出测试报告**：`reports/junit.xml` + `reports/coverage/`；总结里附报告路径与 passed/skipped 计数
- 涉及 ORM 改动：`alembic upgrade head` + e2e_demo 跑通
- 涉及前端：`pnpm build` / 手动浏览器验证

#### 第 7 步：每日收尾（以天为维度更新文档目录）

每天结束前（或一组任务完成时）必须做的两件事：

**(a) 写当天的 dev-log**

落到 `docs/dev-logs/YYYY-MM-DD-<topic>.md`，按下面骨架：

```markdown
# YYYY-MM-DD · <topic 简述>

本日做 N 件事：
1. ...

## 1. <第一件事>
### 现象 / 根因 / 改动 / 验证

## N. 待办
- [ ] ...
```

历史叙事（"曾经/演进/重构"）一律下沉到 dev-log，**不污染架构文档**。

**(b) 同步 [`apps/web/src/modules/docs/manifest.ts`](../../../apps/web/src/modules/docs/manifest.ts)**

任何对 `docs/` 的改动当天必须反映到 manifest——否则 Web Docs Center 看不到、新人 onboarding 失链：

| 改动 | manifest 动作 |
|---|---|
| 新增 doc | 加 `{ path, title, hint }` 到对应子组 |
| 移动 doc（跨节 / 跨子组） | 在新组加项 + 旧组删项；hint 重写以反映新归属 |
| 删除 doc | 从 manifest 移除条目 |
| 重写 doc（标题或职责变化） | 同步更新 `title` / `hint` |
| 新建 dev-log | 在 `dev-logs` 节顶部插一行（按日期倒序），hint 概括当天改动 |

**最后必查清单**：

```bash
# 1) manifest 与磁盘 md 计数一致（零游离零重复）
grep -c "path: '" apps/web/src/modules/docs/manifest.ts
find docs -name "*.md" | wc -l

# 2) tsc 通过
cd apps/web && npx tsc --noEmit

# 3) 无 deprecated 名字回潜
grep -rn "python/services\|TaskType.ANNOTATION\|TaskType.QUALITY_CHECK\|TaskType.PIPELINE\|da_tags" \
  --include="*.py" --include="*.yaml" --include="Dockerfile*" --include="*.toml" \
  | grep -v dev-logs   # dev-log 里允许保留历史叙事
```

三项任一未过，今天的工作不算收尾。

---

## 6. 红线（禁止行为）

- ❌ 在 `python/core` 引入任何框架（FastAPI / Dagster / SQLAlchemy session）
- ❌ 在 `python/workflows` `import dagster` 或 `import fastapi`
- ❌ 在 Dagster asset body 直接 `build_container(Path(...))`（用 resource 注入）
- ❌ 新建 `python/services/` 目录（已删除，与 `apps/<app>/src/services/` 撞名）
- ❌ FastAPI route 跨过 service 层直接操作 SQLAlchemy ORM（事务型业务必须经 service）
- ❌ BFF 直接调 `python/` 模块（必须经 Platform API HTTP）
- ❌ 在多个地方重复定义同一领域对象（Dataset / Sample / Task 等只在 `python/core` 定义一次）
- ❌ 给 `da_tags` 写新逻辑（已 deprecated，新 tag 一律走 `clip_tags` + `Tag` / `TagSource` 模型）
- ❌ 用 `TaskType.ANNOTATION` / `TaskType.QUALITY_CHECK` / `TaskType.PIPELINE`（已删，分别改为 `LABELING`/`TAGGING`、`CHECKING`、`RELEASE`）
- ❌ 写"演进/历史/曾经"叙事到架构文档（历史下沉到 `docs/dev-logs/`）

---

## 7. 关键文件入口（按顺序看就懂代码）

1. [`python/core/src/core/domain/models.py`](../../python/core/src/core/domain/models.py) —— 平台对象是什么
2. [`python/core/src/core/interfaces/contracts.py`](../../python/core/src/core/interfaces/contracts.py) —— 能力长什么样
3. [`python/core/src/core/profiles/runtime.py`](../../python/core/src/core/profiles/runtime.py) —— RuntimeContainer 装配
4. [`apps/api/src/models/base.py`](../../apps/api/src/models/base.py) —— 全局 SQLAlchemy 枚举
5. [`apps/api/src/scripts/e2e_demo.py`](../../apps/api/src/scripts/e2e_demo.py) —— 9 步全链路 demo（最佳活文档）
6. [`apps/orchestrator/src/definitions.py`](../../apps/orchestrator/src/definitions.py) —— Dagster code location 入口
7. [`docs/architecture/business-flows.md`](../../docs/architecture/business-flows.md) —— 业务流程总览
8. [`docs/architecture/layering-and-orchestrator-boundaries.md`](../../docs/architecture/layering-and-orchestrator-boundaries.md) —— 分层判定规则
9. [`docs/architecture/tags-design.md`](../../docs/architecture/tags-design.md) —— Tags 结构化设计
10. [`docs/dev-logs/`](../../docs/dev-logs/) —— 决策与历史变更（接到含糊任务时先翻最近的 dev-log）

---

## 8. 沟通约定

- 默认中文回复，技术名词保留英文
- 短回复优先；不写无信息量的"我会做以下事情"前缀
- 设计变更必须找最近的"判定规则" / 现有约束自洽（§2 / §6）
- 改完后必给精炼总结：**做了什么 / 影响哪些文件 / 验证结果**——不重述需求

---

## 9. 维护规则

- 架构决策有重大变化时（新增枚举类、增删 workspace 包、调整目录边界）即时更新本文件，并在 `docs/dev-logs/` 同步打点
- §2 分层边界 + §6 红线 是非协商性的——遇到与之冲突的代码 / 需求要明确指出冲突，而不是让步
- SOP 的第 1、3、4 步是质量关键：定位子域 → 按分层落代码 → 不破 trace 链。绝大多数 bug 都来自跳过这三步的某一步
- SOP 的**第 7 步是节奏关键**：以天为维度写 dev-log + 同步 manifest。文档结构和 docs viewer 必须每天保持一致，否则 Web Docs Center 会缓慢失同步——manifest 计数与磁盘 md 计数任意一天对不上就要立刻修
