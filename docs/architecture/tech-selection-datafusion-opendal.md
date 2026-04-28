# 技术选型评审：DataFusion 替换 DuckDB / OpenDAL 替换 StorageAdapter

> 状态：草案 · 2026-04-29
> 作者：架构组
> 范围：多模态湖仓底层执行引擎与对象存储抽象层
> 决策方向：**两项都采纳，但都走"新增 + 共存 + profile 切换"的渐进路线**，不做一刀切替换

---

## 0. 结论先行

| 升级项 | 推荐 | 强度 | 一句话理由 |
|---|---|---|---|
| **DuckDB → DataFusion** | 部分采纳：新增 `DataFusionQueryAdapter` 作为 Lance-native / 质检 / streaming 路径默认；DuckDB 留给即席分析 | ⭐⭐⭐⭐ | Lance 与 DataFusion 同源；当前 DuckDB 用法浅，迁移成本低；为 SaaS 阶段铺路 |
| **自研 StorageAdapter → OpenDAL** | 采纳：新增 `OpenDALStorageAdapter`；视频 Range Read + 多云后端立即受益；保留 `LocalFileStorageAdapter` 作为零依赖默认 | ⭐⭐⭐⭐⭐ | 接口语义 100% 兼容；多云 + 流式 + 可观测性三重红利；不破坏其它 6 类 adapter |

> 若只能先做一项 → **先做 OpenDAL**：红利更明确（多云 + 流式），风险更小，算法工程师对 dataset 导出走 S3 / OSS 感知最强。DataFusion 等 streaming 路线开始重要时再上。

---

## 1. 背景与现状（事实清单）

### 1.1 DuckDB 当前用法

| 项 | 现状 |
|---|---|
| Import 入口 | `python/adapters/src/adapters/query/duckdb/adapter.py`、`apps/orchestrator/src/assets/data_pipeline.py` |
| 查询模式 | `cursor.execute(sql)` + `fetchall()`，主要 3 类：`GROUP BY scene COUNT(*)`、`WHERE has_lane_marking = false`、`read_json_auto(...)` |
| 抽象 | `QueryAdapter` Protocol（`python/core/src/core/interfaces/contracts.py`），实现 `DuckDBQueryAdapter`（`db_path`, `data_path`） |
| 装配 | `python/profiles/src/profiles/resolver.py:38-42` 按 profile 条件选 DuckDB 或 StarRocks |
| 数据源 | Lance Dataset → PyArrow Table → DuckDB register（中转方式，非 lance 扩展） |
| 规模 | `data/duckdb/app.duckdb` ~800KB；扫的是 `data/.../samples.lance` + JSON 报告 |
| 复杂度 | **极低**：window / recursive CTE / 全文 / geospatial 一项未用 |

### 1.2 自研 Adapter 体系当前布局

7 类 adapter（`python/adapters/src/adapters/`）：

| 类别 | 实现 | 典型后端 |
|---|---|---|
| query | `DuckDBQueryAdapter`、`StarRocksQueryAdapter` | DuckDB、StarRocks |
| table | `LanceTableAdapter`、`ParquetTableAdapter`、`IcebergAdapter`、`PaimonAdapter` | Lance / Parquet / Iceberg / Paimon |
| vector | `LanceVectorAdapter` | Lance |
| **storage** | **`LocalFileStorageAdapter`、`S3StorageAdapter`** | **本地 fs、S3** |
| metadata | `SQLiteMetadataAdapter`、`PostgresMetadataAdapter` | SQLite、PG |
| compute | `LocalPythonComputeAdapter`、`DagsterLocalComputeAdapter` | 本地 / Dagster |
| auth | `LocalAuthAdapter`、`OIDCAuthAdapter` | 本地 / OIDC |

`RuntimeContainer`（`python/core/src/core/profiles/runtime.py`）把所有 adapter 实例打包；profile.yaml 驱动装配。

> **关键认知**：OpenDAL 名字虽叫 *Open Data Access Layer*，本质等同 "object storage SDK 通用层"，**只能替 storage 这一类**，不会取代 table / vector / query / metadata 等业务语义抽象。"用 OpenDAL 替代 adapter 设计"是个伪命题。

---

## 2. DuckDB → DataFusion 对比

### 2.1 维度表

| 维度 | DuckDB（现状） | DataFusion |
|---|---|---|
| **与 Lance 的耦合** | DuckDB lance 扩展可用但非主路；现 path 是 Arrow 中转 | **Lance 官方推荐查询引擎**，`lance.dataset(...).scan()` 内部就是 DataFusion；`LanceDB` 即"Lance + DataFusion + 向量索引"打包 |
| **SQL 能力** | 顶级：window、recursive CTE、PIVOT、geospatial、full-text、`read_csv_auto` 等 | 中等：基础 SQL + window 完备；recursive CTE / 高阶聚合 / 全文搜索仍在补齐 |
| **Python 易用度** | `import duckdb; duckdb.sql(...)` 一行；与 pandas / Arrow 双向桥接非常顺 | `datafusion-python` 可用；`SessionContext`/`DataFrame` API 风格更接近 Spark；糖衣较少 |
| **性能（OLAP 单机）** | TPC-H、ClickBench 多数对比中略胜 | 接近，部分聚合算子更快；都属于一线 |
| **流式 / 增量** | 弱；定位 OLAP 一次性查询 | 强：原生 dataflow / streaming exec，与 Iceberg/Paimon CDC 集成路径短 |
| **跨进程嵌入** | C++ 单文件，Python/Java/Go/Wasm/Rust 都有 | Rust crate，可嵌入 Rust 服务；Python 是绑定，跨语言不如 DuckDB 老练 |
| **可插拔 datasource** | DuckDB extension API 难度较高 | `TableProvider` trait 是核心抽象；Iceberg / Lance / Paimon 都有现成实现 |
| **生态成熟度** | 1.x stable，5y+；DBeaver / Tableau / Notebook 通吃 | 0.x → 1.x 过渡中，被 InfluxDB IOx / Comet / Ballista / GreptimeDB 用作内核 |

### 2.2 项目维度判断

**支持迁移**
- Lance 已是主力存储格式（ClipReader、LanceTableAdapter、LanceVectorAdapter）。Lance ⊕ DataFusion 是同源生态——继续用 DuckDB 等于 Lance → Arrow → DuckDB → 再算，多一层无谓 IPC。
- 三步走规划（personal → team → SaaS）走向 SaaS 时本来就要替换执行层；提前选 DataFusion 让 personal/team 阶段就跑在与未来分布式版本同源的引擎上，避免二次 SQL 方言迁移。
- DuckDB 杀手级能力（PIVOT / window / 全文）当前代码**一个都没用到**，迁移代价小。
- streaming 路线（Kafka / 增量 dataset 重建）DataFusion 适配更好。

**反对 / 暂缓**
- 90% 用例是给 Web/BFF 喂统计 + 给 Dagster 跑质检，DuckDB 的"零依赖、纯 Python 易调试"在本地开发体验上仍很好。换 DataFusion 多一个 Rust pyo3 wheel，调试 stacktrace 要会读 Rust。
- `datafusion-python` 的 SQL 兼容性 corner case 偶发（如 `GROUP BY ALL` / `EXCLUDE`）。
- QueryAdapter 抽象里同时有 DuckDB + StarRocks **本来就抽象掉了**；再加 DataFusion 不破坏架构，但意味着每种后端的方言差异都要持续维护。

### 2.3 推荐姿势：渐进、不一刀切

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        QueryAdapter Protocol                            │
└──────┬───────────────────────┬───────────────────────────┬──────────────┘
       │                       │                           │
       ▼                       ▼                           ▼
DuckDBQueryAdapter      DataFusionQueryAdapter        StarRocksQueryAdapter
   (现状保留)               (新增, 渐进切换)               (规划中)
   ▲                       ▲                           ▲
   │ Web UI 即席分析           │ Lance-native 路径             │ SaaS 多租户分布式
   │ Dashboard KPI            │ 质检 asset                   │
   │ 本地 dev 体验             │ 增量 / 流式 dataset          │
   └ profile.query.engine: duckdb │ datafusion │ starrocks ─┘
```

1. **保留 DuckDB 作"Web UI 即席查询"默认 backend** —— Dashboard / 分布统计本地体验最好。
2. **新增 `DataFusionQueryAdapter`**（Protocol 不变，零侵入），用于：
   - **Lance-native 路径**：从 `data/lance/c-<uuid>/` 直接 scan 的查询，不再二次 register 到 DuckDB。
   - **Streaming / 增量重建**：未来 Kafka 落地后的 incremental snapshot。
3. **Dagster asset 中的质检（`feature_extraction_with_quality_check`）**：长期 asset，建议直接迁到 DataFusion——它恰好是 Lance + 规则计算，DataFusion 可以做 zero-copy 算子下推到 Lance scan。
4. profile.yaml 加开关：`query.engine: duckdb | datafusion`。

**预估工作量**：增加 `DataFusionQueryAdapter` ≤ 0.5 人天；质检 asset 切过去 ≤ 1 人天。一刀切替换 DuckDB **不建议**。

---

## 3. 自研 StorageAdapter → OpenDAL 对比

### 3.1 维度表

| 维度 | 自研 StorageAdapter | OpenDAL |
|---|---|---|
| **后端覆盖** | 2 个：local fs + S3（手写） | 30+：S3 / GCS / Azure / OSS / OBS / COS / HDFS / WebDAV / IPFS / FS / memory / HTTP / Postgres-as-blob / Redis / FTP / SFTP …… |
| **维护成本** | 自己跟进 boto3 升级、retry、multipart、超时、IAM、断点续传 | Apache 顶级项目；retry / timeout / cache / encryption / metrics / logging 都是 layer 形式叠加 |
| **流式 / Range Read** | 现 adapter 同步整文件 get | 原生 `Reader` 抽象，支持 range / async / streaming，对视频片段 / 大 parquet 部分读友好 |
| **可观测性** | 自己写 log / metrics | 一行 `op.layer(LoggingLayer())` / `op.layer(MetricsLayer())` 直接拿到 OpenTelemetry trace |
| **跨语言一致性** | 仅 Python | Rust 核心；Python / Java / Node / Go / C 绑定一致——未来 BFF（Node）或新写 Rust 微服务都能共用同一份 service 配置语义 |
| **易用度（Python）** | 自家 API，团队习惯 | `opendal.Operator(scheme, **kwargs)`，async/sync 双套 API；学习曲线半天 |
| **生态背书** | — | Databend / RisingWave / GreptimeDB / Vector / OpenTelemetry-Collector |
| **依赖代价** | 0 额外二进制 | 一个 Rust pyo3 wheel；离线 / arm32 / 老 glibc 偶有摩擦 |
| **接口语义覆盖** | put/get/list/delete | put/get/list/delete + range + multipart + stat + scan + writer …… |

### 3.2 关键澄清（容易误判）

OpenDAL **不能替**：

- ❌ TableAdapter（Lance append/overwrite/export）—— 那是表格语义，OpenDAL 只给字节
- ❌ VectorAdapter（向量索引 build/search）
- ❌ MetadataAdapter（SQLite/PG）
- ❌ QueryAdapter（DuckDB / DataFusion）
- ❌ ComputeAdapter（Dagster / 本地 Python）

→ 准确描述：**用 OpenDAL 替代 StorageAdapter 这一个 adapter 类的实现**，其它 6 类 adapter 不变。

### 3.3 项目维度判断

**支持迁移**
1. **多云路径必然来**：personal（local fs）→ team（S3/MinIO）→ SaaS（多租户跨云：S3 + OSS + GCS + Azure 都得支持）。手写每个云 SDK 的 adapter 是无意义重复劳动；OpenDAL 一个 scheme 切换就上。
2. **大文件 / 视频流式访问**：Lance clip 目录里有 mp4，Explorer 还要 HTTP Range；OpenDAL `Reader.read(range=...)` 原生支持 partial read，比手写 boto3 streaming 干净。
3. **可观测性免费**：BFF / API 层加 trace / metrics 是迟早要做的，OpenDAL 的 layer 系统是装饰器形态，比自己在 adapter 里塞日志清爽。
4. **接口完全兼容现 StorageAdapter Protocol**：现 `put/get/list/delete` 一一对应 OpenDAL 的 `write/read/list/delete`。做成 `OpenDALStorageAdapter` 一个新实现，profile 切换即可，不破坏架构。

**反对 / 暂缓**
1. 如果只打算做 personal 版，本地 FS adapter 已经够用，OpenDAL 是 over-engineering。
2. opendal-py 依赖 pyo3 wheel：apple silicon、x86_64 manylinux、windows 有；arm32 / alpine（musl libc）偶尔需要自编。如果部署目标含特殊环境，先验证 wheel 可用。
3. 接口语义虽覆盖，但**语义边界不同**：OpenDAL 的 `list` 是惰性 iterator；现 `list_files` 可能是一次性 list。迁移时把 paginate / 流式拉取暴露给上层，否则等于浪费它。

### 3.4 推荐姿势

```
┌────────────────────────────────────────────────────────────────────┐
│                     StorageAdapter Protocol                         │
└──────┬────────────────────────┬──────────────────────────┬──────────┘
       │                        │                          │
       ▼                        ▼                          ▼
LocalFileStorageAdapter   S3StorageAdapter       OpenDALStorageAdapter
   (零依赖默认)              (现状保留)               (新增, 多云路径)
                                                    ▲
                                  ┌─────────────────┼─────────────────┐
                                  │  S3 / OSS / GCS / Azure / HDFS / FS │
                                  └────────────────────────────────────┘
       └ profile.storage.driver: local │ s3 │ opendal:<scheme> ─┘
```

1. **新增 `OpenDALStorageAdapter`**，profile.yaml 加 `storage.driver: local | s3 | opendal`。OpenDAL 与现有手写实现并存，**不删老实现，先共存 1-2 个版本**。
2. **第一个杀手用例：Explorer 视频 Range Read**（`apps/api/src/api/routes/clips.py` 的 `/clips/{id}/cameras/{camera}/video`）。现状是手写 file 切片；切到 OpenDAL 后 **S3-backed clip 直接用同一段代码**就能 range stream。
3. **第二个用例：dataset 导出 artifact**（official dataset 的 jsonl/parquet 落盘到 `data/exports/` 或 `s3://exports/...`）。这是用户能感知"切云"价值的点。
4. **不要碰** TableAdapter / VectorAdapter / QueryAdapter / MetadataAdapter——它们的语义远超对象存储。

**预估工作量**：新增 `OpenDALStorageAdapter` + profile 路由 ≤ 1 人天；clips video range 路由切过去 ≤ 0.5 人天。

---

## 4. 共同实施原则

1. **不替换、共存**——两项都不要做"删旧+换新"的一刀切；用现有 profile 体系做 driver 选择。这是 adapter 设计本身给的红利。
2. **找一个能立即 demo 价值的用例先切**：DataFusion → 质检 asset；OpenDAL → 视频 range。让团队感知到红利再扩大。
3. **测试守门**：两项都加一组 contract test 确保新 adapter 与老 adapter 在同一组 fixture 上行为一致（QueryAdapter / StorageAdapter Protocol 已具备这条件）。
4. **依赖锁定**：DataFusion / OpenDAL 都处于快速演进；CI 锁定 minor version + 升级时跑兼容性测试。

---

## 5. 风险与回退

| 风险 | 缓解 |
|---|---|
| `datafusion-python` 版本演进快，corner case bug | 锁 minor；contract test；保留 DuckDB adapter 随时回退 |
| OpenDAL Rust wheel 在特殊环境（arm32、alpine、老 glibc）安装失败 | profile 默认仍是 `LocalFileStorageAdapter`；OpenDAL 仅在 team / SaaS 部署启用 |
| 团队成员对新引擎不熟悉，调试时间增加 | 限定单一切入点（质检 asset / 视频 range）观察一个迭代再扩面 |
| 多 backend 方言差异长期维护成本 | contract test 兜底；如某 backend 长期闲置直接下线 |

---

## 6. 决策结果（草案）

> 待评审会议确认后转 ADR。

| 决议 | 状态 |
|---|---|
| 新增 `DataFusionQueryAdapter`，与 DuckDB 并存；profile 默认仍 DuckDB；质检 asset 切到 DataFusion | 待批准 |
| 新增 `OpenDALStorageAdapter`，与本地 / S3 并存；profile 默认仍 `LocalFileStorageAdapter`；clips video range / dataset export 优先切到 OpenDAL | 待批准 |
| 不删除任何现有 adapter；不修改其它 6 类 adapter | 待批准 |
| 共存 1–2 个版本后回看使用率，决定是否下线 | 待批准 |

---

## 7. 参考文件

| 路径 | 作用 |
|---|---|
| `python/adapters/src/adapters/query/duckdb/adapter.py` | DuckDB adapter 实现 |
| `python/core/src/core/interfaces/contracts.py` | QueryAdapter / StorageAdapter Protocol 定义 |
| `python/profiles/src/profiles/resolver.py` | profile 驱动的 adapter 装配 |
| `python/core/src/core/profiles/runtime.py` | RuntimeContainer 数据类 |
| `infra/profiles/local-dev.yaml` | 本地开发 profile 配置 |
| `apps/orchestrator/src/assets/data_pipeline.py:189-233` | DuckDB 直接使用样例（质检） |
| `apps/api/src/api/routes/clips.py` | 视频 range read 现状 |
