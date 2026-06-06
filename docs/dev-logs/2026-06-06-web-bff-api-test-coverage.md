# 2026-06-06 · web / bff / api 三层测试补齐至 ≥80% 覆盖率

承接当日测试基线（[`2026-06-06-opendal-usecases-and-test-baseline.md`](./2026-06-06-opendal-usecases-and-test-baseline.md)）。本篇为 **apps 三层从零/接续补齐单元 + 集成测试**，三个 subagent 并行执行，每层各自工具链 line coverage 均达标。**全程只写测试 + 测试配置，零改生产实现**。

## 结果总览（实测复核）

| 层 | 技术栈 | 工具链 | line coverage | tests |
|---|---|---|---|---|
| **apps/api** | FastAPI | pytest + TestClient | **92%** | 154 passed / 4 deselected |
| **apps/bff** | Koa | vitest + supertest | **96.1%** | 132 passed |
| **apps/web** | React+Vite | vitest + RTL/jsdom | **80.83%** | 255 passed |

> 跨语言无单一合并指标，按"每层各自工具链 ≥80%"达成。

## 1. apps/api（pytest）

### 改动
- 测试基建 `tests/api/conftest.py`：内存 sqlite + StaticPool 建全表、TestClient 覆盖 `get_db`、需求链路 seed 工厂。
- 单测 `tests/api/unit/`：x_trace middleware（透传不截断）、schemas 校验、models 关系/cascade/枚举、services 纯逻辑、snapshot_service、database。
- 集成 `tests/api/integration/`：TestClient 请求级覆盖**全部 21 路由**（requirements / data_tasks 含 sign-off 状态机 / pipelines / datasets cut+promote / events+assets+snapshots / exports / labeling / ops_modules / clips / streaming），含 404/400/422 错误分支与 **x_trace_id 继承断言**（§3.2）。
- 根 [`pyproject.toml`](../../pyproject.toml) addopts 加 `--cov=src` + `[tool.coverage.run] omit` 排除 scripts。

### 未覆盖（非业务漏洞）
`clips.stream_video`（视频字节流依赖真实 lance 数据）、`core/database.init_db`（alembic 实战路径）、各路由次要可选过滤分支。

## 2. apps/bff（vitest + supertest）

### 改动
- [`apps/bff/vitest.config.ts`](../../apps/bff/vitest.config.ts)（node env、v8 coverage、`reports/bff-coverage`）+ `tests/helpers/`（fetchMock 拦截出站 Platform API、fake Koa Context）。
- 单测：13 engines（断言 URL/query/header 构造 + 聚合映射 + error→fallback）、services（platform base-url/解析/retry-once）、middlewares（exception/response/pagination/clean-timestamp）。
- 集成：supertest 打真实 `getApp()`，mock 出站 API，覆盖 16 handlers 全链路 + tools-gateway 代理（body/Location 改写）。

## 3. apps/web（vitest + React Testing Library）

### 改动
- [`apps/web/vitest.config.ts`](../../apps/web/vitest.config.ts)（jsdom、alias `@→src`、`reports/web-coverage`）+ `vitest.setup.ts`（补 matchMedia/ResizeObserver）+ `src/test-utils.tsx`（renderWithRouter）。
- 30+ 测试文件：shared hooks/组件、各模块 api 纯函数、页面/容器集成（mock 走 `@/shared/api/client` BFF 边界）——requirements / pipelines / exports / operations(含 annotation + cornerstone mock) / overview / explorer / catalog / tools / docs。
- 高覆盖：hooks 100%、各模块 api、requirements/exports/operations/pipelines。低覆盖：explorer 视频播放器、tools iframe 轮询（运行时重依赖）。

## 测试规范固化
三层均遵循 CLAUDE.md「测试基线（强制）」：unit + integration 分离、外部依赖不可达显式 skip、产出 coverage 报告（`reports/junit.xml`、`reports/coverage/`、`apps/bff/reports/bff-coverage/`、`apps/web/reports/web-coverage/`）。新增 subagent [`test-expert`](../../.claude/agents/test-expert.md) 沉淀测试规范。

## 测试暴露的生产代码问题与修复

测试补齐顺带暴露 4 处问题，已修复其中 2 个真实缺陷（仅改对应文件 + 回归测试，不扩大改动面）。

1. **[已修] bff `routes/docs-content.ts` 404 被拒成 500**：`GET /api/docs/file` 资源缺失/非法路径时手写 `ctx.status=404` + `{ message }`，body 不满足该路由 404 output 的 `errorResponseSchema`（缺 `status/code/requestId/error`），被 koa-joi-router 输出校验拒成 **500**。**改为 `throw new AppError(..., { status: 404 })`**，由 exception 中间件产出合规 envelope；tree route 同类手写 500 一并改为抛 AppError。回归测试断言 404 + `success:false` + `requestId` + `error.message`。
2. **[已修] web `requirement-list.page` 改筛选不 refetch**：`cacheKey` 固定 `'requirements'`，而 `useQuery` 仅在 `cacheKey` 变化时重取 → 改 `keyword/status/priority/page` 不触发请求。**cacheKey 改为 `requirements:${status}:${priority}:${keyword}:${page}`**（对齐 ops-module-list-page）。连带修复：整页 `<PageLoading>` 守卫改为 `listState==='loading' && !listData`，使后台 refetch 期间保留表格与筛选框、避免每次输入闪整页。回归测试断言改 keyword 后以新参数再次 fetch。
3. **[未改·设计行为] web `use-query` 模块级 `queryCache`** 跨实例共享，stale-while-revalidate 下同 key 页面重进先显旧数据——提示注意失效策略。
4. **[非 bug·契约说明] api `create_pipeline_run`** 的 schema 不含 `metrics`（创建时传会被丢弃，须走 PATCH）。

## N. 待办
- [x] 修 bff docs-content 404 输出 schema。
- [x] web use-query：list 页对齐动态 cacheKey + 后台 refetch 不闪整页。
- [x] CI 接入三层测试 + 覆盖率门禁（见 [`2026-06-07-ci-test-coverage-gates.md`](./2026-06-07-ci-test-coverage-gates.md)）。
- [ ] explorer 视频 / tools iframe 等运行时重依赖路径补 e2e（Playwright）覆盖。
