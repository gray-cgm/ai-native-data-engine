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

## 仓库扩展阅读

- 业务流程：[`docs/architecture/business-flows.md`](./docs/architecture/business-flows.md)
- 分层边界：[`docs/architecture/layering-and-orchestrator-boundaries.md`](./docs/architecture/layering-and-orchestrator-boundaries.md)
- Tags 设计：[`docs/architecture/tags-design.md`](./docs/architecture/tags-design.md)
- 历史变更：[`docs/dev-logs/`](./docs/dev-logs/)（按日期组织，遇含糊任务先翻最近 3 篇）
