# 2026-06-06 · OpenDAL 三大用例落地 + 测试基线建立

承接当日 [`2026-06-06-opendal-storage-adapter.md`](./2026-06-06-opendal-storage-adapter.md)（Phase 1：`OpenDALStorageAdapter` 新增+共存）。本篇做 5 件事：

1. `StorageAdapter` 契约加 `size(uri)`（range read 必需），三实现补齐。
2. 用例一：clips 视频 range read 改走 `container.storage`（backend-pluggable）。
3. 用例二：dataset 导出 artifact 经 storage 发布到对象存储（`publish_export`）。
4. 用例三：docker-compose 加 MinIO（含自动建桶）+ team-dev profile 切 opendal/s3。
5. 建立 pytest 测试基线（unit + integration + 报告）+ 引入 `test-expert` subagent，并在 CLAUDE.md/SKILL.md 写入强制测试规范。

## 1. StorageAdapter 加 `size(uri)`

### 改动
[`contracts.py`](../../python/core/src/core/interfaces/contracts.py) `StorageAdapter` 加 `size(uri) -> int`；local_fs（`Path.stat().st_size`）/ opendal（`op.stat().content_length`）/ s3（stub）补齐。range 响应需要 `Content-Range` 的 total size。

## 2. 用例一 · clips 视频 range read 走 storage

### 现象 / 根因
[`clips.py`](../../apps/api/src/api/routes/clips.py) `stream_video` 原本裸 `local_path.open('rb')` + seek，绑死本地 fs，s3-backed clip 无法复用。

### 改动
range 分支改走 `get_runtime_container().storage`：`storage.size(uri)` 取大小、`storage.open(uri,'rb')` + seek 流式切片。OpenDAL Reader 的 `seek()` 在 s3 下自动发 HTTP Range 请求 → **同一段代码服务 local 与对象存储**。no-range 分支保留 `FileResponse` 本地快路径。

### 验证
`tests/unit/test_clip_range.py`：`_parse_range` 6 个边界 + 复刻 iter_chunk 断言 `storage.open+seek` 出的字节 == 原始切片。

## 3. 用例二 · dataset 导出发布到 storage

### 改动
- 新增 [`workflows/exports/publish.py`](../../python/workflows/src/workflows/exports/publish.py) `publish_export(storage, local_path, target_uri)`：单文件走 `put_file`，目录（Lance 导出）整树保结构上传。
- [`pipeline.py`](../../python/workflows/src/workflows/demo/pipeline.py) `run_scenario_triage_flow` 在 `table.export` 后按 `capabilities.object_storage` opt-in 发布。**local-dev（object_storage=false）零回归**。
- 分工对齐 ADR：TableAdapter（Lance）写本地，storage 负责上云；`./data/exports/v1.lance` 经 opendal(base=./data) 落为 s3 key `exports/v1.lance`。

### 验证
`tests/unit/test_publish_export.py`：单文件 + 多文件目录树两路径。

## 4. 用例三 · MinIO 基础设施 + team-dev profile

### 改动
- [`docker-compose.yml`](../../docker-compose.yml) 加 `minio` 服务（9000/9001 + healthcheck）+ `minio-setup`（minio/mc 一次性建桶 `ad-data`）+ `minio_data` 卷。
- [`team-dev.yaml`](../../infra/profiles/team-dev.yaml) storage 由占位 `provider: minio` 改为 `provider: opendal, scheme: s3`（endpoint/bucket/region/ak/sk）。
- resolver 的 opendal 分支把非保留键透传给 `Operator('s3', ...)`。

### 验证
- `tests/integration/test_opendal_minio.py`（`@pytest.mark.integration`）：write/read/range/size + publish 树。
- 本机 **docker 未运行 → 集成测试 3 项显式 skip（非伪 pass）**。真 e2e：`docker compose up -d minio minio-setup && uv run pytest -m integration`。
- 注：team-dev.yaml 仍有**预先存在**的 profile-shape 缺口（用 `profile:` 而非 `name:`、缺 `scenario` 块），导致 `build_container` 暂不可用；与本次存储改动无关，集成测试因此直接用 `OpenDALStorageAdapter` 而非 build_container。

## 5. 测试基线 + test-expert subagent

### 改动
- dev deps 加 `pytest` + `pytest-cov`；根 [`pyproject.toml`](../../pyproject.toml) `[tool.pytest.ini_options]`：testpaths/pythonpath/`integration` marker/默认 `-m "not integration"`/junit+coverage 报告。
- `tests/`：`conftest.py`（contract fixture 参数化 local_fs+opendal、`minio_storage` 不可达即 skip）+ `unit/`（contract / opendal / resolver / publish / clip_range）+ `integration/`。
- 新增 subagent [`.claude/agents/test-expert.md`](../../.claude/agents/test-expert.md)。
- [`CLAUDE.md`](../../CLAUDE.md) 加"测试基线（强制）"节；[`SKILL.md`](../../.claude/skills/architecture/SKILL.md) SOP 第 6 步纳入 pytest + 集成测试 + 报告。

### 验证
`uv run pytest` → **28 passed, 3 deselected**；新代码覆盖：opendal 91% / local_fs 93% / resolver 90% / publish 100%。报告：`reports/junit.xml` + `reports/coverage/`。

## N. 待办
- [ ] team-dev.yaml 修 profile-shape（`name:` + `scenario` 块）使 `build_container` 可用，补一条经 build_container 的 MinIO 集成测试。
- [ ] clips s3-backed clip 的 remote-uri → storage key 约定（待真实 s3 clip 摄取落地）。
- [ ] CI 起 docker MinIO 跑 `-m integration`，把测试报告纳入流水线 artifact。
