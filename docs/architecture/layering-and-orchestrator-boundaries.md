# 分层与编排边界

> 父：[架构总览](./overview.md) · [系统分层总览](./system-layers.md)
>
> 解答一个具体问题：仓库里命名相似的几个目录（`python/workflows` ⇄ `apps/orchestrator`、`apps/<app>/src/services/`）到底如何分工？给出边界规则与判定标准。

---

## 一、边界规则

```
python/{core, adapters, profiles, workflows}
     ↑ 框架中立的库层 —— 离开 FastAPI、离开 Dagster 仍然能跑

apps/{api, orchestrator, bff, web, scheduler}
     ↑ 运行时绑定层 —— 必须依赖某个框架（FastAPI / Dagster / Vite / …）
```

判定测试：

> 如果明天 FastAPI 与 Dagster **都**不存在，这段代码还应该存在吗？
>
> - 是 → `python/`
> - 否 → `apps/`

应用：

| 信号 | 归属 |
|---|---|
| `Depends(get_db)` / SQLAlchemy `Session` / FastAPI 路由形参 | `apps/api/` |
| `@asset` / `OpExecutionContext` / Dagster resource | `apps/orchestrator/` |
| 只接 `RuntimeContainer` + 普通参数 | `python/workflows/` |

---

## 二、目录职责

### `python/workflows`：框架中立的流程库

- 接收 `RuntimeContainer` + 参数
- 调 adapter / `apps/api/src/services/`（同进程时）
- 返回稳定结构

**禁止出现的导入**：`import dagster` / `from dagster import @asset` / `import fastapi` / `Depends`。

### `apps/orchestrator`：Dagster 绑定层

只做三件事：

1. 把 `python/workflows` 的函数 `@asset` 包装成 Dagster 资产；
2. 定义 schedule / sensor / resource；
3. 提供 Dagster code location 入口（`definitions.py`）。

**禁止**：在 asset body 内写业务流程；在 asset body 内 `build_container(Path(...))`（用 Dagster resource 注入）。

```python
# ✅ asset body 应是这样：
@asset(required_resource_keys={'container'})
def night_intersection_vru_triage_asset(context):
    container = context.resources.container.get()
    return run_scenario_triage_demo(container)
```

### `apps/<app>/src/services/`：进程内事务型服务

- 与 SQLAlchemy session 强绑定（`dataset_slice_service.promote_to_official` 这类）；
- 与 FastAPI 请求生命周期绑定（依赖 `Depends`、Request 上下文）；
- 不可下沉到 `python/`，因为它依赖框架。

---

## 三、目录意图（目标态）

```text
python/
  core/          领域模型 + 协议（绝对不依赖框架）
  adapters/      provider 实现
  profiles/      RuntimeContainer 装配
  workflows/     框架中立的多步骤流程库
                   - ingestion / catalog / versioning / scenarios
                   - scheduler / query / quality / governance
                   - exports / feedback / evaluation / layout
                   - materialization / demo / streaming

apps/
  api/
    src/
      api/routes/       FastAPI 路由（薄壳）
      services/         FastAPI 事务服务
      models/           SQLAlchemy ORM
      scripts/          命令行 demo
  bff/                  ViewModel 聚合
  web/                  React 前端
  orchestrator/
    src/
      definitions.py    聚合 Dagster Definitions
      assets/           Dagster asset = 调 workflows 的薄壳
      resources/        RuntimeContainer resource
      schedules/ sensors/
  scheduler/            轻量定时任务（非 Dagster）
```

---

## 四、PR 评审 Checklist

新增 / 移动文件时问以下问题：

- [ ] 这段代码依赖 FastAPI（Depends / Request / Response 类型）？是 → 必须放 `apps/api/`
- [ ] 这段代码依赖 Dagster（`@asset` / `OpExecutionContext`）？是 → 必须放 `apps/orchestrator/`
- [ ] Dagster asset body 直接 `build_container(...)`？→ 不允许，改用 Dagster resource 注入
- [ ] workflow 文件名包含 `assets/` / `dagster_*`？→ 改名，避免与 Dagster 术语撞名
- [ ] FastAPI 路由直接 `from workflows.xxx import ...` 跨过 `apps/api/src/services/`？纯流程类（如 scenario_triage demo）允许；事务型业务（dataset slice）必须经 service

---

## 五、与系统分层的对应

| 系统层（[system-layers.md](./system-layers.md)） | 对应代码位置 |
|---|---|
| 文件格式层（Lance / parquet） | `python/adapters/table` |
| 存储层（local / S3 / OSS） | `python/adapters/storage` |
| 湖表格式层 | `python/adapters/table` |
| 计算层（Dagster / local python） | `apps/orchestrator` + `python/workflows` |
| 查询层（DataFusion / DuckDB） | `python/adapters/query` |
| 应用层（Web / BFF / API） | `apps/web` + `apps/bff` + `apps/api` |
| 横切：元数据 | `apps/api/src/models` + SQLAlchemy + Alembic |

---

## 六、参考

- [架构总览](./overview.md)
- [系统分层总览](./system-layers.md)
- [Core / Adapters / Profiles / Workflows 分层](./core-adapters-profiles-workflows.md)
- [PipelineRun 统一事实模型 ADR](../adr/adr-pipelinerun-unified-fact-model.md)
- [业务流程总览](./business-flows.md)
