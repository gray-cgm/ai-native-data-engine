# Claude Code · 项目协作基线

本项目是 **AI Native Data Engine**——面向自动驾驶 / 机器人数据闭环的平台型 monorepo。

## 入会必读

每次新会话，**第一件事 read 下面这份硬核 Skill Prompt 即可进入状态**，不需要再讲背景：

→ [`.claude/skills/architecture/SKILL.md`](./.claude/skills/architecture/SKILL.md)

包含：
- §1 核心世界观（4 层闭环对象 / Snowflake 事件中心 / 易混名词精确定义）
- §2 分层边界（python/ ⇄ apps/ 判定规则与硬约束）
- §3 数据库与表结构速查（ORM 位置 / `x_trace_id` 贯穿规则）
- §4 业务模块一句话职责（按数据闭环旅程排序）
- §5 任务执行 SOP（6 步标准作业程序）
- §6 红线（10 条非协商性禁止行为）
- §7 关键文件入口（10 个）
- §8 沟通约定
- §9 维护规则

## 测试基线（强制）

任何改动生产代码的任务，**收尾前必须补/更新测试并产出测试报告**，否则不算完成。

- **框架与目录**：pytest + pytest-cov，配置在根 [`pyproject.toml`](./pyproject.toml) `[tool.pytest.ini_options]`。测试在根 `tests/`：`tests/unit/`（纯函数 / adapter / Protocol，零外部依赖）+ `tests/integration/`（依赖 docker 服务：minio / postgres / kafka，打 `@pytest.mark.integration`）。
- **单元测试**：`uv run pytest`（默认排除 integration）。adapter 多实现用 **contract test 参数化**跑全实现，守护 Protocol 行为一致（如 `StorageAdapter` 同时跑 local_fs + opendal）。
- **集成测试（必含）**：凡接入外部存储 / 数据库 / 消息系统的功能，必须写一组 `@pytest.mark.integration` 用例；外部服务不可达时 **显式 `pytest.skip`，禁止伪 pass**。本地：`docker compose up -d minio minio-setup` 后 `uv run pytest -m integration`。
- **测试报告（必出）**：每次跑测产出 `reports/junit.xml` + `reports/coverage/`（HTML）+ 终端 coverage 摘要；集成测试单独跑时另出 `reports/integration-junit.xml`。收尾总结里附报告路径与 `passed / skipped` 计数。
- **专属 subagent**：测试工作委派 [`test-expert`](./.claude/agents/test-expert.md)（只写测试与测试基建，不改生产实现；发现 bug 报告回实现方）。

## 仓库扩展阅读

- 业务流程：[`docs/architecture/business-flows.md`](./docs/architecture/business-flows.md)
- 分层边界：[`docs/architecture/layering-and-orchestrator-boundaries.md`](./docs/architecture/layering-and-orchestrator-boundaries.md)
- Tags 设计：[`docs/architecture/tags-design.md`](./docs/architecture/tags-design.md)
- 历史变更：[`docs/dev-logs/`](./docs/dev-logs/)（按日期组织，遇含糊任务先翻最近 3 篇）
