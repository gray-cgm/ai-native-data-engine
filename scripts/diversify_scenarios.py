"""一次性脚本：把 demo 数据里 clip 的 scenario 字段从 `xminer-pipeline-video`
分配到 10 个真实 ADAS 场景。改 2 处：
1. data/metadata/clip_catalog.sqlite 的 clips 表（含 summary_json / meta_json 内嵌字段）
2. data/lance/c-*/meta.lance 每个文件的 scenario 列（lance overwrite）

幂等：再跑一次会按同样 hash 分配；已经是新 scenario 的会被覆盖（不影响）。
回滚：clip_catalog.sqlite.bak 已备份；lance 自带版本可 lance.dataset(...).restore_version()。
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path

import lance
import pyarrow as pa


REPO = Path(__file__).resolve().parent.parent
SQLITE_PATH = REPO / "data" / "metadata" / "clip_catalog.sqlite"
LANCE_ROOT = REPO / "data" / "lance"

# (scenario_id, 中文 label, weight). 总 weight = 25 = 当前 clip 数。
SCENARIOS: list[tuple[str, str, int]] = [
    ("urban-unprotected-left-turn", "城区无保护左转", 4),
    ("night-intersection",          "夜间路口",       4),
    ("highway-cut-in",              "高速切入",       3),
    ("pedestrian-crossing",         "行人横穿",       3),
    ("rainy-highway",               "雨天高速",       3),
    ("tunnel-merge",                "隧道汇入",       2),
    ("construction-zone",           "施工区域",       2),
    ("traffic-jam-stop-go",         "拥堵走停",       2),
    ("narrow-road-passing",         "窄路会车",       1),
    ("roundabout-yielding",         "环岛让行",       1),
]

# 把 weight 展开成池
POOL = [s for s, _, w in SCENARIOS for _ in range(w)]


def assign_scenario(clip_id: str, idx: int) -> str:
    """确定性分配：同一 clip_id 永远落到同一 scenario（hash 取模）。
    idx 用作冲突打散，让分布更均匀。"""
    h = int(hashlib.md5(f"{clip_id}:{idx}".encode()).hexdigest(), 16)
    return POOL[h % len(POOL)]


def update_sqlite() -> dict[str, str]:
    """更新 clips 表 + JSON 内嵌字段；返回 {clip_id: new_scenario} 映射。"""
    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT clip_id, summary_json, meta_json FROM clips ORDER BY clip_id").fetchall()
    mapping: dict[str, str] = {}
    for idx, row in enumerate(rows):
        clip_id = row["clip_id"]
        new_scn = assign_scenario(clip_id, idx)
        mapping[clip_id] = new_scn

        summary = json.loads(row["summary_json"])
        meta = json.loads(row["meta_json"])
        # summary 顶层 + meta 顶层都可能有 scenario 字段
        summary["scenario"] = new_scn
        meta["scenario"] = new_scn

        conn.execute(
            "UPDATE clips SET scenario = ?, summary_json = ?, meta_json = ? WHERE clip_id = ?",
            (new_scn, json.dumps(summary), json.dumps(meta), clip_id),
        )
    conn.commit()
    conn.close()
    return mapping


def update_lance(mapping: dict[str, str]) -> tuple[int, int]:
    """对每个 c-*/meta.lance overwrite 写入新 scenario。返回 (updated, skipped)。"""
    updated = skipped = 0
    for clip_dir in sorted(LANCE_ROOT.iterdir()):
        if not clip_dir.is_dir():
            continue
        clip_id = clip_dir.name  # "c-<uuid>"
        if clip_id not in mapping:
            skipped += 1
            continue
        meta_path = clip_dir / "meta.lance"
        if not meta_path.exists():
            skipped += 1
            continue
        ds = lance.dataset(str(meta_path))
        tbl = ds.to_table()
        new_scn = mapping[clip_id]
        # 只换 scenario 列；其它原样保留
        scn_col = pa.array([new_scn] * tbl.num_rows, type=pa.string())
        new_tbl = tbl.set_column(tbl.schema.get_field_index("scenario"), "scenario", scn_col)
        lance.write_dataset(new_tbl, str(meta_path), mode="overwrite")
        updated += 1
    return updated, skipped


def main() -> None:
    print("=== diversify_scenarios.py ===")
    mapping = update_sqlite()
    print(f"\n[sqlite] updated {len(mapping)} clips in clip_catalog.sqlite")
    from collections import Counter
    dist = Counter(mapping.values())
    for scn, n in sorted(dist.items(), key=lambda x: -x[1]):
        zh = next((z for s, z, _ in SCENARIOS if s == scn), "?")
        print(f"   {scn:32s} {zh:8s}  {n}")
    updated, skipped = update_lance(mapping)
    print(f"\n[lance] meta.lance overwritten: {updated} updated, {skipped} skipped (no row in catalog)")
    print("\nDone. To rollback sqlite: cp data/metadata/clip_catalog.sqlite.bak data/metadata/clip_catalog.sqlite")


if __name__ == "__main__":
    main()
