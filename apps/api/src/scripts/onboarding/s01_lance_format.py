"""01 · 文件格式层（Lance）

🎯 目标
   理解一个 clip 在磁盘上长什么样：data/lance/c-<uuid>/
   学会用 lance.dataset(...) 直接打开 Lance 文件、看 schema、读几行。

📖 知识点
   - Lance 是列式 + 向量原生格式（vs Parquet：增量 append / 向量索引更友好）
   - 一个 clip = 一个目录，含多个 *.lance 子表：
     · meta.lance      → 单行元数据（车辆 / 地点 / 场景 / tags / 时间窗口）
     · topic.lance     → 关键帧表（多 topic / 多 camera 列）
     · <Topic>.lance   → 高频独立 topic 表（行更多）
     · wm.lance        → 水位线（可选）
   - Lance 时间字段（start_time/end_time）单位 = 纳秒
   - clip_reader 是项目对 Lance 的薄包装：常用操作都封装好了

🚀 跑法
   uv run --package api python -m src.scripts.onboarding.01_lance_format
   uv run --package api python -m src.scripts.onboarding.01_lance_format --clip c-0b7cf...
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import lance

# clip_reader 在 python/adapters，对 Lance 的薄包装
from adapters import clip_reader

from src.scripts.onboarding._console import banner, done, end_banner, hr, info, kv, step, warn


DEFAULT_LANCE_ROOT = Path("data/lance")


def main(lance_root: Path, clip_id: str | None) -> None:
    banner(
        "01 · 文件格式层（Lance）",
        f"扫描 {lance_root.resolve()}，挑一个 clip 看它的文件结构与字段",
    )

    # ─── Step 1：列举所有 clip 目录 ───────────────────────────────
    step(1, "list clips", "Lance 不需要 catalog 服务，直接扫文件即可枚举")

    clip_ids = clip_reader.list_clip_ids(lance_root)
    if not clip_ids:
        warn(f"未找到 clip。先把 clip 放到 {lance_root}，再来看本 demo。")
        return
    info(f"共 {len(clip_ids)} 个 clip")
    for cid in clip_ids[:5]:
        kv("clip_id", cid)
    if len(clip_ids) > 5:
        info(f"...（省略 {len(clip_ids) - 5} 条）")

    # ─── Step 2：选一个 clip，列出它的 *.lance 子表 ─────────────
    target = clip_id or clip_ids[0]
    if target not in clip_ids:
        warn(f"clip {target} 不存在；可选：{clip_ids[:3]}…")
        return
    clip_dir = lance_root / target
    step(2, f"inspect tables in {target}", "一个 clip 目录通常含多个 *.lance 子表")

    tables = sorted(clip_dir.glob("*.lance"))
    if not tables:
        warn("该 clip 目录下没有 *.lance 文件（可能未 ingest 完成）")
        return
    for t in tables:
        # 直接调 lance API 拿 row count + schema
        ds = lance.dataset(str(t))
        kv(t.name, f"{ds.count_rows()} rows · {len(ds.schema)} cols")

    # ─── Step 3：meta.lance 单行元数据 ──────────────────────────
    step(3, "read meta.lance", "单行元数据：车辆/地点/场景/tags/时间窗口")
    meta = clip_reader.load_meta(clip_dir)
    for k in ("vehicle_name", "vehicle_model", "city", "district", "scenario",
              "tags", "da_tags", "jira_id", "start_time", "end_time",
              "calibration_version"):
        if k in meta:
            kv(k, meta[k])

    # 时间窗口换算为秒
    if meta.get("start_time") and meta.get("end_time"):
        duration_ns = int(meta["end_time"]) - int(meta["start_time"])
        info(f"clip 时长 ≈ {duration_ns / 1e9:.2f} 秒（ns / 1e9）")

    # ─── Step 4：topic.lance 与列式 schema ─────────────────────
    step(4, "read topic.lance schema",
         "topic.lance 列式 schema：每个 topic / camera 一列，类型是 struct")
    topic_path = clip_dir / "topic.lance"
    if topic_path.exists():
        ds = lance.dataset(str(topic_path))
        info(f"行数 {ds.count_rows()}，列数 {len(ds.schema)}")
        for f in list(ds.schema)[:8]:
            # str(f.type) 让复杂 struct 类型也能打印出来
            kv(f.name, str(f.type)[:80])
        if len(ds.schema) > 8:
            info(f"...（省略 {len(ds.schema) - 8} 列）")

        # 取前 2 行体验
        info("前 2 行（仅 timestamp + 第一个 topic 列）：")
        sample_cols = ["timestamp"] + [
            f.name for f in ds.schema if f.name != "timestamp"
        ][:1]
        try:
            tbl = ds.scanner(columns=sample_cols, limit=2).to_table()
            for i, row in enumerate(tbl.to_pylist()):
                kv(f"row[{i}]", str(row)[:120], indent=4)
        except Exception as exc:  # noqa: BLE001
            warn(f"扫描失败：{exc}")
    else:
        warn("没有 topic.lance（多模态信号未 ingest？）")

    # ─── Step 5：camera 对齐数据 ───────────────────────────────
    step(5, "extract camera catalog", "从 meta.lance 解析 camera 列表（位置/分辨率/FOV）")
    catalog = clip_reader.extract_camera_catalog(meta)
    for cam in catalog[:3]:
        kv(cam["name"], f'{cam.get("position")} · {cam.get("width")}x{cam.get("height")} · hfov {cam.get("hfov")}°')
    if len(catalog) > 3:
        info(f"...共 {len(catalog)} 个 camera")

    # ─── Step 6：standalone topic ──────────────────────────────
    summary = clip_reader.load_summary(clip_dir)
    if summary.schema.standalone_topics:
        step(6, "standalone topics", "高频信号（如 IMU）独立成一张 *.lance，避免 keyframe 被稀释")
        for st in summary.schema.standalone_topics[:3]:
            kv(st.name, f"{st.row_count} rows")

    # ─── 总结 ───────────────────────────────────────────────────
    hr()
    done(f"clip {target} 文件结构看完了")
    info("下一步：运行 02_storage_adapter.py 看「字节怎么落到磁盘 / 对象存储」")
    end_banner("Lance 文件格式 ✓")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Onboarding 01: Lance file format")
    parser.add_argument("--lance-root", default=str(DEFAULT_LANCE_ROOT))
    parser.add_argument("--clip", default=None, help="指定 clip_id；缺省取第一条")
    args = parser.parse_args()
    try:
        main(Path(args.lance_root), args.clip)
    except Exception as exc:  # noqa: BLE001 — 顶层兜底，新人能看到 traceback
        print(f"\n❌ {type(exc).__name__}: {exc}", file=sys.stderr)
        raise
