# 2026-06-06 · OpenDAL 接管 StorageAdapter（Phase 1：新增 + 共存）

本日做 3 件事：
1. 评审"用 OpenDAL 做统一存储层"的真实边界，确认只替 `StorageAdapter` 一类 adapter。
2. 实装 `OpenDALStorageAdapter`，与 `LocalFileStorageAdapter` / `S3StorageAdapter` 共存。
3. resolver 加 `provider: opendal` 装配分支，跑通 contract parity 与无回归验证。

落地路线严格对齐 [`docs/adr/tech-selection-datafusion-opendal.md`](../adr/tech-selection-datafusion-opendal.md)：**新增 + 共存 + profile 切换，不一刀切替换**，Protocol 不动，调用方零改动。

## 1. 边界澄清：OpenDAL 只替 StorageAdapter

### 现象
需求是"adapter 能否用 OpenDAL 做统一存储层"。

### 根因
OpenDAL 本质是 object-storage SDK 通用层，**只覆盖字节读写**。项目 7 类 adapter 里只有 `StorageAdapter`（`put/get/open/exists/list/delete`）是裸字节语义；`TableAdapter`(Lance/Parquet) / `QueryAdapter`(DuckDB) / `MetadataAdapter`(SQLite/PG) / `SearchAdapter`(向量) 都是带格式/引擎语义的抽象，OpenDAL 不能替。

另注意一条不重叠路径：Lance/DuckDB 写对象存储走各自原生 object_store / httpfs，**不经过 OpenDAL**——上云后对象存储凭证需在 profile 层统一下发，避免两套配置漂移。

## 2. OpenDALStorageAdapter 实装

### 改动
- 新增 [`python/adapters/src/adapters/storage/opendal/adapter.py`](../../python/adapters/src/adapters/storage/opendal/adapter.py)：实现 `StorageAdapter` 7 方法。
- 依赖 [`python/adapters/pyproject.toml`](../../python/adapters/pyproject.toml) 加 `opendal>=0.45`（实测 0.47.2，darwin arm64 有预编译 wheel）。

### 关键设计
- **URI 归一**：`relpath(abspath(uri), abspath(base))`，scheme-agnostic。fs 下 `root/key` 精确还原原始路径；cloud 下 cwd 前缀相互抵消，`./data/exports/x.json` → key `exports/x.json`，本地一套配置直接换 `scheme: s3/oss/gcs`。
- **text/binary 双模**：workflow 实际用 `open(uri,'w')`+`json.dump`、`open(uri,'r')`+`json.load`。OpenDAL File 只给 binary，文本模式用 `io.TextIOWrapper` 包裹，关闭即 commit。
- **delete 幂等** + **open('w') 自动建父目录**（local_fs 不会，是行为超集）。

## 3. resolver 装配 + 验证

### 改动
[`python/profiles/src/profiles/resolver.py`](../../python/profiles/src/profiles/resolver.py) storage 分支加 `provider: opendal`（`scheme` + `root`/`base` + 其余 options 透传），保留 local_fs / s3。

profile 配置形态：
```yaml
storage:
  provider: opendal
  scheme: fs          # 或 s3 / oss / gcs / azblob …
  root: ./data        # key 归一基准；cloud 下另传 bucket/endpoint/ak/sk
```

### 验证
- **Contract parity**：`OpenDALStorageAdapter('fs')` 与 `LocalFileStorageAdapter` 在 7 方法 + text/binary/json/put-get/list/幂等 delete 上行为一致。
- **Resolver**：local-dev profile 无回归（仍 `LocalFileStorageAdapter`）；`provider: opendal` 正确装配，真实读写落点正确（`./data/exports/...`）。
- compile + import smoke 通过。

## N. 待办

Phase 2 已落地，详见 [`2026-06-06-opendal-usecases-and-test-baseline.md`](./2026-06-06-opendal-usecases-and-test-baseline.md)：

- [x] 杀手用例一：clips 视频 Range Read 切到 `container.storage`（seek 触发 OpenDAL Range）。
- [x] 杀手用例二：dataset 导出 artifact 经 `publish_export` 发布到对象存储。
- [x] team-dev MinIO：docker-compose 加 minio + profile 切 opendal/s3 + 集成测试（docker 起则真跑）。
- [ ] 共存 1–2 版本后回看使用率，决定是否下线手写 `S3StorageAdapter`。
