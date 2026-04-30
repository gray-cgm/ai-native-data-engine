"""06 · Snowflake 事件中心 + Asset 血缘

🎯 目标
   学会 emit LineageEvent + EventResult，理解 4 维度（tagging/labeling/checking/mining）
   是「query view」而非物理表；学会登记 Asset。

📖 知识点
   - LineageEvent 是中心事件（事实发生表）：一次 mining / 标注 / 质检 / migration / release = 一条
   - EventResult 是逐 clip 结果行（一次 event 通常 N 条 EventResult）
   - 4 维度 = (event_type, payload_type) 的联合 filter，无独立物理表
     · tagging   → event_type ∈ {tagging, migration} ∧ payload_type=tag
     · labeling  → event_type=labeling ∧ payload_type=label
     · checking  → event_type=checking ∧ payload_type=check
     · mining    → event_type=mining ∧ payload_type=mining_candidate
   - Asset 是数据资产登记表（asset_kind=raw/derived），靠 producer_pipeline_run_id /
     producer_event_id 反查血缘
   - 设计文档：docs/architecture/dataset-design.md §五

🚀 跑法
   uv run --package api python -m src.scripts.onboarding.s06_snowflake_lineage
"""

from __future__ import annotations

import argparse
import sys
import uuid
from pathlib import Path

from src.core.database import SessionLocal, init_db
from src.models.asset import Asset
from src.models.lineage_event import EventResult, LineageEvent
from src.services import event_service
from src.services.event_service import EventResultPayload

from src.scripts.onboarding._console import banner, done, end_banner, hr, info, kv, step, warn


def main(reset: bool) -> None:
    banner(
        "06 · Snowflake 事件中心 + Asset",
        "emit LineageEvent → EventResult ×N → 4 维度 query → 登记 Asset",
    )

    init_db()
    db = SessionLocal()

    try:
        if reset:
            removed = db.query(LineageEvent).filter(
                LineageEvent.x_trace_id.like("trace_onb_%")
            ).all()
            for ev in removed:
                db.delete(ev)
            db.query(Asset).filter(Asset.x_trace_id.like("trace_onb_%")).delete(
                synchronize_session=False
            )
            db.commit()
            warn(f"reset：清掉 {len(removed)} 条 onboarding LineageEvent")

        trace_id = f"trace_onb_{uuid.uuid4().hex[:8]}"
        kv("x_trace_id", trace_id)

        # ─── Step 1：mining 事件（disengagement 来源） ─────────
        step(1, "emit mining event",
             "Mining 模块产出 5 条候选 clip，标记为 hard_case_v1")
        mining_ev = event_service.emit_event(
            db,
            event_type="mining",
            source_type="disengagement",  # 路测人工接管事件
            pipeline_commit="abc1234",
            pipeline_repo="ai-data-loop-engine",
            branch_name="onboarding-demo",
            x_trace_id=trace_id,
            payload={"intent": "find night vru hard cases"},
            results=[
                EventResultPayload(
                    clip_id=f"c-onb-{i:03d}",
                    payload_type="mining_candidate",
                    tags="hard_case_v1,nighttime,vru",
                    note=f"disengagement #{i}",
                )
                for i in range(5)
            ],
        )
        db.commit()
        kv("event.id", mining_ev.id)
        kv("event.event_id", mining_ev.event_id)
        kv("event.event_type", mining_ev.event_type)
        kv("event.source_type", mining_ev.source_type)
        kv("results count", len(mining_ev.results))

        # ─── Step 2：labeling 事件 ─────────────────────────────
        step(2, "emit labeling event", "5 条 clip 都人工标了 da_tags")
        labeling_ev = event_service.emit_event(
            db,
            event_type="labeling",
            source_type="manual_ui",
            x_trace_id=trace_id,
            results=[
                EventResultPayload(
                    clip_id=f"c-onb-{i:03d}",
                    payload_type="label",
                    da_tags="Good_behavior_v1",
                )
                for i in range(5)
            ],
        )
        db.commit()
        kv("labeling event.id", labeling_ev.id)

        # ─── Step 3：tagging 事件 ──────────────────────────────
        step(3, "emit tagging event", "系统打 cutin_v1_12 tag")
        tagging_ev = event_service.emit_event(
            db,
            event_type="tagging",
            source_type="rule_engine",
            x_trace_id=trace_id,
            results=[
                EventResultPayload(
                    clip_id=f"c-onb-{i:03d}",
                    payload_type="tag",
                    tags="cutin_v1_12,pedestrian_present",
                )
                for i in range(5)
            ],
        )
        db.commit()

        # ─── Step 4：checking 事件 ─────────────────────────────
        step(4, "emit checking event", "QA：3 通过 / 1 waived / 1 failed")
        checking_ev = event_service.emit_event(
            db,
            event_type="checking",
            source_type="qc_auto",
            x_trace_id=trace_id,
            results=[
                EventResultPayload(
                    clip_id="c-onb-000", payload_type="check",
                    extra={"status": "passed"},
                ),
                EventResultPayload(
                    clip_id="c-onb-001", payload_type="check",
                    extra={"status": "passed"},
                ),
                EventResultPayload(
                    clip_id="c-onb-002", payload_type="check",
                    extra={"status": "passed"},
                ),
                EventResultPayload(
                    clip_id="c-onb-003", payload_type="check",
                    extra={"status": "waived"}, note="模糊但可接受",
                ),
                EventResultPayload(
                    clip_id="c-onb-004", payload_type="check",
                    extra={"status": "failed"}, note="标注框越界",
                ),
            ],
        )
        db.commit()

        # ─── Step 5：4 维度查询 ────────────────────────────────
        step(5, "查 4 维度", "都通过 (event_type, payload_type) 联合 filter，无独立表")
        for dim in ("tagging", "labeling", "checking", "mining"):
            rows = event_service.query_dimension(db, dim, x_trace_id=trace_id, limit=20)
            kv(dim, f"{len(rows)} 条")

        # 拉一条具体的看看 shape
        info("看一条 mining 结果的形态：")
        rows = event_service.query_dimension(db, "mining", x_trace_id=trace_id, limit=1)
        if rows:
            r = rows[0]
            kv("  clip_id", r["clip_id"])
            kv("  payload_type", r["payload_type"])
            kv("  tags", r["tags"])
            kv("  event_type", r["event"]["event_type"])
            kv("  event_id", r["event"]["event_id"])

        # ─── Step 6：登记 Asset ───────────────────────────────
        step(6, "register Asset (derived)",
             "把 mining 产出登记成 derived asset；blame 走 producer_event_id")
        asset = Asset(
            name=f"mining-candidates-{trace_id[-6:]}.jsonl",
            asset_kind="derived",
            uri=f"data/exports/mining-{trace_id}.jsonl",
            format="jsonl",
            producer_event_id=mining_ev.id,  # 反查血缘
            x_trace_id=trace_id,
            byte_size=2048,
            row_count=5,
            payload={"source_type": "disengagement"},
        )
        db.add(asset)
        db.commit()
        kv("asset.id", asset.id)
        kv("asset.kind", asset.asset_kind)
        kv("producer_event_id", asset.producer_event_id)

        # 反向：从 event 查它产出的 asset
        produced = (
            db.query(Asset).filter(Asset.producer_event_id == mining_ev.id).all()
        )
        info(f"event {mining_ev.id[:8]}… 产出 {len(produced)} 个 derived asset")

        # ─── Step 7：trace 横切聚合 ───────────────────────────
        step(7, "trace 横切聚合", "本 trace 写了多少 events / event_results / assets")
        ev_count = db.query(LineageEvent).filter(
            LineageEvent.x_trace_id == trace_id
        ).count()
        result_count = (
            db.query(EventResult)
            .join(LineageEvent, LineageEvent.id == EventResult.event_pk)
            .filter(LineageEvent.x_trace_id == trace_id)
            .count()
        )
        asset_count = db.query(Asset).filter(Asset.x_trace_id == trace_id).count()
        kv("LineageEvent", ev_count)
        kv("EventResult", result_count)
        kv("Asset", asset_count)

        # ─── 总结 ───────────────────────────────────────────────
        hr()
        info("📐 关键认知：")
        info("  - Tag 是 result 不是 entity：同一 tag 名（cutin_v1_12）可来自 N 次 event")
        info("  - 4 维度只是 query view，不要试图给它们建独立物理表")
        info("  - Asset 二选一：producer_pipeline_run_id 或 producer_event_id（XOR）")

        info("🐛 调试：")
        info(f"  curl 'http://localhost:8000/api/v1/events?x_trace_id={trace_id}'")
        info(f"  curl 'http://localhost:8000/api/v1/events/dimensions/mining?x_trace_id={trace_id}'")
        info(f"  curl 'http://localhost:8000/api/v1/assets?x_trace_id={trace_id}'")

        done(f"events={ev_count} · results={result_count} · assets={asset_count}")
        info("下一步：s07_promote_export.py 把 customized dataset 提级为 official 并导出")
        end_banner("Snowflake & Lineage ✓")

    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Onboarding 06: Snowflake & lineage")
    parser.add_argument("--reset", action="store_true")
    args = parser.parse_args()
    try:
        main(args.reset)
    except Exception as exc:  # noqa: BLE001
        print(f"\n❌ {type(exc).__name__}: {exc}", file=sys.stderr)
        raise
