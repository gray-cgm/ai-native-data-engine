# Onboarding Demos

> 7 个独立可跑的小 demo，按系统分层（`docs/architecture/system-layers.md`）从下到上贯穿一遍。
> 每个脚本 < 250 行、注释密集、console 大量打印——专为新人入职第一周设计。
>
> 跑完 7 个 demo 想看一次性串起来 → 直接 `make e2e-demo`。

## 学习路径·

| # | 文件 | 对应分层 | 核心知识点 |
|---|---|---|---|
| 01 | `s01_lance_format.py` | ① 文件格式层 | 一个 clip 在磁盘上长什么样（meta.lance / topic.lance / standalone）；用 `lance.dataset()` 看 schema、读几行 |
| 02 | `s02_storage_adapter.py` | ② 存储层 | `LocalFileStorageAdapter` 的 put/get/list/delete + open（流式）；profile 切 backend 的设计 |
| 03 | `s03_duckdb_query.py` | ⑤ 查询层 | DuckDB 在 Lance 上跑 SQL：register Arrow → SQL → GROUP BY；DataFusion 演进规划 |
| 04 | `s04_business_flow.py` | ⑥ 应用层 · 业务承诺 | Requirement → 4 个 DataTask（sign-off）→ OperationsTask；x_trace_id 串通 |
| 05 | `s05_dataset_sample.py` | ⑥ 应用层 · 数据资产 | create customized Dataset；3 种切割（flexible / one_to_four / random_sample） |
| 06 | `s06_snowflake_lineage.py` | 血缘观测 | emit LineageEvent + EventResult + 4 维度 query；登记 Asset |
| 07 | `s07_promote_export.py` | 端到端收尾 | Promote → official Dataset → 导出 jsonl + 登记 Asset + DatasetSnapshotManifest |

## 准备工作

```bash
# 1) 安装依赖
make install

# 2) 升级 DB schema（首次跑 04+ 必须）
make db-upgrade

# 3) 把 demo clip 放到 data/lance/c-<uuid>/
#    没有真实数据也可以跑 04 / 06（不依赖 clip）；01/03/05/07 需要至少 1 个 clip
```

## 运行单个 demo

```bash
# 直接 module 调用
uv run --package api python -m src.scripts.onboarding.s01_lance_format
uv run --package api python -m src.scripts.onboarding.s02_storage_adapter
uv run --package api python -m src.scripts.onboarding.s03_duckdb_query
uv run --package api python -m src.scripts.onboarding.s04_business_flow --reset
uv run --package api python -m src.scripts.onboarding.s05_dataset_sample --reset
uv run --package api python -m src.scripts.onboarding.s06_snowflake_lineage --reset
uv run --package api python -m src.scripts.onboarding.s07_promote_export --reset

# 或用 Makefile（推荐）
make onboarding-01
make onboarding-02
...
make onboarding-all   # 顺序跑全部 7 个
```

## 调试方式

每个 demo 的最后都打了类似的内容（自适应替换 trace_id / dataset_id）：

```
🐛 调试：
  curl 'http://localhost:8000/api/v1/...'
  open  http://localhost:5173/...
```

把这些 curl / open 命令粘到终端 / 浏览器，就能看到 demo 写进系统的对象。

## 文档闭环

- **想看一行业务流程图** → [E2E Demo 教程](../../../../docs/tutorials/e2e-demo.md)
- **想看完整 ER 图与字段表** → [领域模型与语义](../../../../docs/architecture/domain-model.md)
- **想看名词精确定义** → [术语澄清](../../../../docs/architecture/glossary-dataset-scenario-cornercase-tag-label.md)
- **想看分层全景** → [系统分层总览](../../../../docs/architecture/system-layers.md)

## FAQ

**Q：为什么文件名带 `s01` 而不是 `01_`？**
A：`01_xxx` 不是合法 Python 标识符，无法用 `python -m` 调用。`s01_xxx` 是合法的。

**Q：跑 04 报 `no such table: requirements`？**
A：忘了 `make db-upgrade`，先升级到最新 alembic head。

**Q：跑 01/03/05/07 报「{lance_root} 下没有 clip」？**
A：先把 clip 数据放到 `data/lance/c-<uuid>/`，或者用 `make ingest` 录入。

**Q：跑过一次想清理，重跑？**
A：04/05/06/07 都支持 `--reset`，按 `[ONB-XX]` / `ds_onb_xx_` / `trace_onb_` 前缀清理本 demo 自己的数据，不影响其它对象。

**Q：和 e2e_demo.py 的关系？**
A：onboarding 是「拆开教学」，每个 demo 聚焦 1-2 个分层 / 1-2 个对象；
   e2e_demo 是「一次串起来」，9 步全跑完产出 official dataset。
   学完 onboarding 应该能完全看懂 e2e_demo 的代码。
