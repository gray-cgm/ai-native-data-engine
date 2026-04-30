"""Onboarding demos for new engineers.

按系统分层（docs/architecture/system-layers.md）从下到上各跑一遍：

  01 → ① 文件格式层（Lance）
  02 → ② 存储层（Storage adapter）
  03 → ⑤ 查询层（DuckDB on Lance/Arrow）
  04 → ⑥ 应用层 · 业务承诺（Requirement / DataTask）
  05 → ⑥ 应用层 · 数据资产（Dataset / Sample / 灵活切割）
  06 → 血缘观测（Snowflake LineageEvent + EventResult + Asset）
  07 → 端到端 · Release Promote + Export 给算法工程师

每个脚本独立可跑、有大量 console 打印、便于调试。
跑完想看一次性串起来 → ``make e2e-demo``。
"""
