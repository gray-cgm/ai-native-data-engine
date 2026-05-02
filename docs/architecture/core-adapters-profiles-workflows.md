# Core / Adapters / Profiles / Workflows 分层

> 父：[架构总览](./overview.md) · [系统分层总览](./system-layers.md) · [分层与编排边界](./layering-and-orchestrator-boundaries.md)
>
> `python/{core, adapters, profiles, workflows}` 不是"四个 Python 目录"，是平台代码的四层职责。讲清这四层有助于扩展 query / export / scheduler / labeling / mining 等能力时不混在一起。

---

## 一、四层一句话

| 层 | 职责 |
|---|---|
| `core` | 定义世界观（领域模型 + 能力契约） |
| `adapters` | 实现能力（DuckDB / Lance / SQLite / FS / …） |
| `profiles` | 选择实现（YAML profile + RuntimeContainer 装配） |
| `workflows` | 编排流程（ingestion / query / export / orchestration 等） |

与系统分层的对应：`adapters/storage` ↔ 存储层；`adapters/table` ↔ 湖表 / 文件格式层；`adapters/query` ↔ 查询层；`adapters/compute` + `workflows` ↔ 计算层。`core` 与元数据控制层属于横切层，不归任何业务层。

---

## 二、`python/core`：领域模型 + 接口契约

只放两类最稳定的东西。

### 2.1 领域模型

平台真正关心的业务对象（不是某个框架或数据库的细节）：

- `SampleRecord` / `DatasetSummary` / `ComputeRun` / `AuthenticatedUser` / `LineageEvent` / `ProfileCapabilities` / `RuntimeProfile`

代码：[models.py](../../python/core/src/core/domain/models.py)。

价值：

1. **统一语言**——`apps/api` / `apps/bff` / Dagster / SDK 谈论的"Dataset"是同一个东西。
2. **隔离技术细节**——领域语义不被 SQLite / DuckDB / Lance / Kafka 绑死。
3. **跨服务共享事实**——Platform API、orchestrator、未来 scheduler / mining service 看到的是同一份对象。
4. **稳定上层流程**——adapter 切换不影响 workflow / route。

### 2.2 接口契约

声明"平台需要什么能力"，例如 `MetadataAdapter` / `QueryAdapter` / `SearchAdapter` / `TableAdapter` / `StorageAdapter` / `ComputeAdapter` / `AuthAdapter`。代码：[contracts.py](../../python/core/src/core/interfaces/contracts.py)。

`core` **不**承载：server lifecycle / scheduler loop / queue worker / route handler / provider wiring。

---

## 三、`python/adapters`：能力实现

按访问模式分目录：

```text
python/adapters/src/adapters/
  auth/ compute/ ingestion/ layout/ manifests/
  metadata/ query/ quality/ governance/ scheduler/
  storage/ table/ vector/
```

每个 provider 实现 `core/interfaces/contracts.py` 中声明的 protocol，对外提供能力，对内绑死技术细节。

---

## 四、`python/profiles`：运行时装配

YAML profile + resolver，决定当前环境装配哪一套 provider，组装出 `RuntimeContainer`。

入口：[runtime.py](../../python/core/src/core/profiles/runtime.py)。

切换 provider（`local fs → S3` / `DuckDB → StarRocks`）只需换 profile，不动产品代码。

---

## 五、`python/workflows`：流程编排

把多个 capability 串成业务流程：ingestion / materialization / query / export / scheduler / quality / governance / feedback / evaluation / demo / streaming。

约束：

- 接收 `RuntimeContainer` + 普通参数；
- 调 adapter 或 `apps/<app>/src/services/`（同进程时）；
- **不**依赖 FastAPI / Dagster；
- 同一个 workflow 函数能被 FastAPI route / Dagster asset / CLI / 测试复用。

详见 [分层与编排边界](./layering-and-orchestrator-boundaries.md)。

---

## 六、scheduler 为什么不进 core

scheduler 是常驻应用服务，不是平台事实：HTTP server / callback / 后台轮询 / resource manager / lifecycle 这些不属于领域模型。合理放置：

| 层 | 内容 |
|---|---|
| `python/core` | `Task` / `JobRun` / 状态枚举 / 接口能力 |
| `python/workflows/scheduler` | 框架中立的调度编排 |
| `apps/api/src/services/scheduler` | FastAPI 进程内的 SQLAlchemy 事务型协调（如有） |
| `apps/scheduler` | 独立服务入口（按需引入） |

---

## 七、类比

| 层 | 类比 |
|---|---|
| `core` | 建筑图纸与接口标准（房间布局 / 水电接口规范） |
| `adapters` | 具体施工方案（红砖 / 钢结构 / 水管型号） |
| `profiles` | 项目配置单（这个工地选哪套方案） |
| `workflows` | 施工流程（先地基 → 框架 → 布线 → 验收） |

---

## 八、Core 与 BFF 怎么共享一套知识

跨语言共享的核心不是代码文件，是**契约**。

```text
python/core            定义平台领域语义与接口契约
  → apps/api           暴露稳定的 HTTP / JSON contract
    → apps/bff         组合为页面友好的 ViewModel
      → apps/web       消费 BFF 返回的 payload
```

| 模型类型 | 定义方 |
|---|---|
| 平台事实模型（Dataset / DatasetVersion / Task / ExportJob / JobRun / Search 基础语义） | Python 侧（`python/core` + `apps/api`） |
| 页面聚合模型（dashboard payload / 卡片统计 / 组合 ViewModel / 排序分组态） | BFF 侧（`apps/bff`） |

后续可演进到 OpenAPI / JSON Schema 自动生成 TS client，让 `packages/{schemas, contracts}` 沉淀为 Node/Web 侧共享 contract 层，避免：

- BFF 手写 DTO
- 字段命名漂移
- 状态枚举不一致
- API 与前端类型定义分叉

---

## 九、入口文件

如果想顺着真实代码理解，按顺序看：

1. [models.py](../../python/core/src/core/domain/models.py) —— 对象是什么
2. [contracts.py](../../python/core/src/core/interfaces/contracts.py) —— 能力长什么样
3. [runtime.py](../../python/core/src/core/profiles/runtime.py) —— 能力如何被装配后交给上层

---

## 十、参考

- [架构总览](./overview.md)
- [系统分层总览](./system-layers.md)
- [分层与编排边界](./layering-and-orchestrator-boundaries.md)
- [系统目录与领域模型设计](./system-directory-and-domain-design.md)
