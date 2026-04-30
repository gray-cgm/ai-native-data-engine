"""03 · 查询层（DuckDB on Lance / Arrow）

🎯 目标
   学会用 DuckDB 在 Lance 文件上跑 SQL，理解「Lance → Arrow → DuckDB register」三步走。

📖 知识点
   - DuckDB 是嵌入式 OLAP 引擎（无服务进程，纯 in-process）
   - 当前用法：cursor 模式 ``con.execute(sql).fetchall()``
   - 查询路径：Lance.dataset → PyArrow Table → DuckDB.register_arrow → SQL
   - QueryAdapter 抽象在 ``python/core/src/core/interfaces/contracts.py``
   - 未来规划：DataFusionQueryAdapter（Lance native，省一层 Arrow 中转），见
     adr/tech-selection-datafusion-opendal.md

🚀 跑法
   uv run --package api python -m src.scripts.onboarding.s03_duckdb_query
   uv run --package api python -m src.scripts.onboarding.s03_duckdb_query --clip c-0b7cf...
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import duckdb
import lance

from adapters import clip_reader

from src.scripts.onboarding._console import banner, done, end_banner, hr, info, kv, step, warn


DEFAULT_LANCE_ROOT = Path("data/lance")


def main(lance_root: Path, clip_id: str | None) -> None:
    banner(
        "03 · 查询层（DuckDB on Lance）",
        "把 Lance 数据 register 成 DuckDB 表，跑几条 SQL 体验",
    )

    clip_ids = clip_reader.list_clip_ids(lance_root)
    if not clip_ids:
        warn(f"{lance_root} 下没有 clip。先跑 s01 看看？")
        return
    target = clip_id or clip_ids[0]
    if target not in clip_ids:
        warn(f"clip {target} 不存在；可选：{clip_ids[:3]}…")
        return
    clip_dir = lance_root / target

    # ─── Step 1：DuckDB in-memory ─────────────────────────────────
    step(1, "open DuckDB", "in-memory 模式：零依赖、零 I/O，进程结束即释放")
    con = duckdb.connect(":memory:")
    info(f"DuckDB version: {duckdb.__version__}")

    # ─── Step 2：Lance → Arrow → DuckDB register ──────────────────
    step(2, "register Lance as DuckDB table",
         "Lance dataset → to_table() 拿 Arrow → DuckDB.register('alias', tbl)")
    topic_path = clip_dir / "topic.lance"
    if not topic_path.exists():
        warn(f"{topic_path} 不存在；该 clip 没有 topic 表")
        return
    ds = lance.dataset(str(topic_path))
    info(f"Lance dataset 行数 {ds.count_rows()}，列数 {len(ds.schema)}")

    # 关键：to_table 是 zero-copy（Arrow IPC），不会真复制内存
    arrow_tbl = ds.to_table()
    con.register("topic", arrow_tbl)
    done("已注册为 DuckDB 表 `topic`")

    # ─── Step 3：第一条 SQL：行数与列名 ────────────────────────
    step(3, "DESCRIBE", "看 DuckDB 给 Lance 推断出的 schema")
    rows = con.execute("DESCRIBE topic").fetchall()
    for r in rows[:6]:
        kv(r[0], r[1])
    if len(rows) > 6:
        info(f"...（省略 {len(rows) - 6} 列）")

    # ─── Step 4：聚合查询 ─────────────────────────────────────────
    step(4, "GROUP BY", "DuckDB 在 Arrow 上跑聚合：列式 + SIMD")
    cnt = con.execute("SELECT COUNT(*) FROM topic").fetchone()[0]
    kv("total rows", cnt)

    # ─── Step 5：把多 clip 的 meta 合起来查（典型场景） ─────────
    step(5, "join multiple clip metas",
         "把所有 clip 的 meta.lance 合并成一张表 `clip_meta`")
    meta_paths = [p / "meta.lance" for p in (lance_root.iterdir())
                  if (p / "meta.lance").exists()]
    if not meta_paths:
        warn("没有 meta.lance 可合并")
    else:
        info(f"待合并 {len(meta_paths)} 个 meta")
        # 取每个 clip 的 single row meta，append 到一个 Arrow Table
        first = lance.dataset(str(meta_paths[0])).to_table()
        # union 所有 meta
        import pyarrow as pa  # noqa: PLC0415 — 局部用一次
        tables = [first]
        for p in meta_paths[1:10]:  # 控制规模，最多看 10 个
            try:
                tables.append(lance.dataset(str(p)).to_table())
            except Exception:  # noqa: BLE001
                pass
        merged = pa.concat_tables(tables, promote_options="default")
        con.register("clip_meta", merged)

        # 跑一个典型聚合
        info("按 city 分布：")
        rows = con.execute(
            "SELECT city, COUNT(*) AS clip_count "
            "FROM clip_meta WHERE city IS NOT NULL "
            "GROUP BY city ORDER BY clip_count DESC LIMIT 5"
        ).fetchall()
        for city, n in rows:
            kv(city or "<unknown>", n)

        info("按 scenario 分布：")
        rows = con.execute(
            "SELECT scenario, COUNT(*) AS n "
            "FROM clip_meta WHERE scenario IS NOT NULL "
            "GROUP BY scenario ORDER BY n DESC LIMIT 5"
        ).fetchall()
        for s, n in rows:
            kv(s, n)

    # ─── Step 6：filter + projection 下推 ─────────────────────────
    step(6, "filter pushdown",
         "DuckDB 把 WHERE 下推到 Arrow / Lance，省 IO（小数据看不出，大数据效果显著）")
    sample = con.execute(
        "SELECT timestamp FROM topic WHERE timestamp IS NOT NULL LIMIT 3"
    ).fetchall()
    for ts, in sample:
        kv("timestamp(ns)", ts)

    # ─── 知识总结 ───────────────────────────────────────────────
    hr()
    info("📐 抽象边界：")
    info("  - QueryAdapter 接口只暴露 query() / create_view() / register_table() / materialize_table()")
    info("  - 业务代码不直接 import duckdb，而是通过 adapter；profile 切到 starrocks/datafusion 时无感")
    info("  - 在 Dagster asset 里做质检（apps/orchestrator/.../data_pipeline.py）也走同一套")

    info("🐛 调试小贴士：")
    info("  - 想 explain plan：con.execute('EXPLAIN <sql>').fetchall()")
    info("  - 想看物化中间表：con.execute('CREATE TABLE foo AS SELECT ...')，然后 'PRAGMA show_tables'")
    info("  - 大 Lance：用 ds.scanner(columns=[...], filter=...) 而不是 to_table() 全量")

    con.close()
    done("DuckDB on Lance ✓")
    info("下一步：运行 s04_business_flow.py 看「业务对象怎么从 Requirement 走到 Dataset」")
    end_banner("Query Layer ✓")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Onboarding 03: DuckDB on Lance")
    parser.add_argument("--lance-root", default=str(DEFAULT_LANCE_ROOT))
    parser.add_argument("--clip", default=None)
    args = parser.parse_args()
    try:
        main(Path(args.lance_root), args.clip)
    except Exception as exc:  # noqa: BLE001
        print(f"\n❌ {type(exc).__name__}: {exc}", file=sys.stderr)
        raise
