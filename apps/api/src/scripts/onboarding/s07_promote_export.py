"""07 · 提级与导出（端到端收尾）

🎯 目标
   把一个 customized dataset 通过 Operations · Release Promote 提级为 official，
   并导出 jsonl artifact 给算法工程师消费 + 登记 Asset + 写 DatasetSnapshotManifest。

📖 知识点
   - Promote = 复制 sample + 新建 official Dataset 行 + 写 LineageEvent(release)
   - 唯一约束 (dataset_id, clip_id, ts) 保证幂等：重复 Promote 不会重复 sample
   - export artifact 一行一个 sample，算法 dataloader 直接消费 jsonl
   - DatasetSnapshotManifest 是端到端 receipt（trace → official → artifact）
   - 服务函数：dataset_slice_service.promote_to_official + snapshot_service.attach_*

🚀 跑法
   uv run --package api python -m src.scripts.onboarding.s07_promote_export
   uv run --package api python -m src.scripts.onboarding.s07_promote_export --reset
"""

from __future__ import annotations

import argparse
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from adapters import clip_reader
from src.core.database import SessionLocal, init_db
from src.models.asset import Asset
from src.models.dataset import Dataset, DatasetSample
from src.models.dataset_snapshot import DatasetSnapshotManifest
from src.models.lineage_event import LineageEvent
from src.services import dataset_slice_service as slicer
from src.services import snapshot_service

from src.scripts.onboarding._console import banner, done, end_banner, hr, info, kv, step, warn


DEFAULT_LANCE_ROOT = Path("data/lance")
EXPORTS_DIR = Path("data/exports")


def main(lance_root: Path, reset: bool) -> None:
    banner(
        "07 · 提级与导出（端到端收尾）",
        "customized → Promote → official → 导出 jsonl + 登记 Asset + Snapshot",
    )

    init_db()
    db = SessionLocal()

    try:
        if reset:
            removed = (
                db.query(Dataset).filter(Dataset.name.like("ds_onb_07_%")).all()
            )
            for d in removed:
                db.delete(d)
            db.query(DatasetSnapshotManifest).filter(
                DatasetSnapshotManifest.x_trace_id.like("trace_onb_07_%")
            ).delete(synchronize_session=False)
            db.commit()
            warn(f"reset：清掉 {len(removed)} 个旧 demo dataset")

        clip_ids = clip_reader.list_clip_ids(lance_root)
        if not clip_ids:
            warn(f"{lance_root} 下没 clip。先跑 s01 / make ingest")
            return
        candidates = clip_ids[:5]
        trace_id = f"trace_onb_07_{uuid.uuid4().hex[:6]}"
        kv("x_trace_id", trace_id)

        # ─── Step 1：建 customized dataset + 写 sample ─────────
        step(1, "build customized dataset + N samples",
             "把 5 个 clip 收成工作集（每 clip 1 sample，flexible 切割整段）")
        ds_cust = slicer.create_dataset(
            db,
            name=f"ds_onb_07_{trace_id[-6:]}_customized",
            dataset_type="customized",
            source_type="other",
            allow_train=False,
            tag_expr="onboarding-demo",
            slice_strategy="flexible",
            ts_policy="flexible_window",
            created_by="onboarding",
        )
        db.commit()
        kv("customized.id", ds_cust.id)
        kv("customized.name", ds_cust.name)

        for cid in candidates:
            meta = clip_reader.load_meta(lance_root / cid)
            start_ns = int(meta.get("start_time", 0))
            end_ns = int(meta.get("end_time", 0))
            if end_ns <= start_ns:
                # 兜底：合成假窗口
                start_ns = (abs(hash(cid)) % 10**10) * int(1e9)
                end_ns = start_ns + int(3 * 1e9)
            slicer.flexible_cut(
                db, dataset=ds_cust, clip_id=cid,
                ts_start=start_ns, ts_end=end_ns,
                x_trace_id=trace_id,
            )
        db.commit()
        sample_count = db.query(DatasetSample).filter(
            DatasetSample.dataset_id == ds_cust.id
        ).count()
        kv("samples written", sample_count)

        # ─── Step 2：promote_to_official ───────────────────────
        step(2, "promote_to_official",
             "复制 samples + 新建 official Dataset + 写 LineageEvent(release)")
        result = slicer.promote_to_official(
            db,
            customized=ds_cust,
            name=f"ds_onb_07_{trace_id[-6:]}_official",
            tag_expr=f"promoted_from:{ds_cust.id}",
            allow_train=True,
            x_trace_id=trace_id,
            created_by="onboarding",
        )
        db.commit()
        ds_off_id = result["official_dataset"]["id"]
        ds_off_name = result["official_dataset"]["name"]
        release_ev_id = result["event"]["id"]
        kv("samples_copied", result["samples_copied"])
        kv("samples_deduped", result["samples_deduped"])
        kv("official.id", ds_off_id)
        kv("official.name", ds_off_name)
        kv("release event.id", release_ev_id)
        kv("release event.event_type", "release")

        # ─── Step 3：写 / 更新 DatasetSnapshotManifest ─────────
        step(3, "snapshot manifest", "把这条 trace 的端到端 receipt 钉一行")
        snapshot_service.open_or_create(
            db,
            x_trace_id=trace_id,
            requirement_id=None,  # 本 demo 不挂 requirement
            data_task_id=None,
            operations_task_id=None,
            gold_pipeline_run_id=None,  # 本 demo 没真跑 pipeline
            pipeline_run_count=0,
            clip_ids=candidates,
            scenario="onboarding-demo",
            title="onboarding s07 manifest",
            summary="end-to-end onboarding flow demo",
        )
        snapshot_service.attach_dataset_version(
            db, x_trace_id=trace_id,
            dataset_id=ds_off_id,
            dataset_version_id=f"v{result['official_dataset']['dataset_version']}",
        )
        db.commit()
        manifest = (
            db.query(DatasetSnapshotManifest)
            .filter(DatasetSnapshotManifest.x_trace_id == trace_id)
            .first()
        )
        kv("manifest.id", manifest.id if manifest else "<none>")

        # ─── Step 4：导出 jsonl artifact ───────────────────────
        step(4, "export jsonl",
             "把 official dataset 的 sample 列表写成 jsonl，算法直接消费")
        EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
        version_id = f"v{result['official_dataset']['dataset_version']}"
        out_path = EXPORTS_DIR / f"{ds_off_id}-{version_id}.jsonl"

        samples = (
            db.query(DatasetSample)
            .filter(DatasetSample.dataset_id == ds_off_id)
            .order_by(DatasetSample.created_at.asc())
            .all()
        )
        with out_path.open("w", encoding="utf-8") as fh:
            for s in samples:
                row = {
                    "id": s.id,
                    "dataset_id": s.dataset_id,
                    "clip_id": s.clip_id,
                    "ts": s.ts,
                    "range_l": s.range_l,
                    "range_r": s.range_r,
                    "ts_origin": s.ts_origin,
                    "training_type": s.training_type,
                    "extra_meta": s.extra_meta,
                }
                fh.write(json.dumps(row, ensure_ascii=False) + "\n")
        kv("artifact", out_path)
        kv("rows", len(samples))
        kv("size", f"{out_path.stat().st_size} bytes")

        # ─── Step 5：登记 Asset（derived，交付物） ────────────
        step(5, "register Asset(derived)",
             "把 jsonl 文件登记成 asset，algorithm engineer 就能反查血缘")
        asset = Asset(
            name=f"official-dataset-{ds_off_id[:8]}.jsonl",
            asset_kind="derived",
            uri=str(out_path),
            format="jsonl",
            producer_event_id=release_ev_id,  # 反查到 release event
            x_trace_id=trace_id,
            byte_size=out_path.stat().st_size,
            row_count=len(samples),
            payload={
                "dataset_id": ds_off_id,
                "dataset_version_id": version_id,
                "delivered_to": "algorithm_engineer",
            },
        )
        db.add(asset)
        db.flush()
        kv("asset.id", asset.id)

        # ─── Step 6：seal manifest with artifact ───────────────
        step(6, "seal manifest", "attach_export_artifact 落 sealed_at + 写 e2e-snapshot json")
        snapshot_service.attach_export_artifact(
            db,
            x_trace_id=trace_id,
            export_job_id=None,
            export_artifact_uri=str(out_path),
            export_format="jsonl",
        )
        db.commit()
        receipt_path = EXPORTS_DIR / f"e2e-snapshot-{trace_id}.json"
        kv("receipt path", receipt_path)
        kv("exists?", receipt_path.exists())

        # ─── Step 7：跨表反查（trace receipt） ────────────────
        step(7, "全链路反查", "用 trace_id 把刚刚写过的对象都拉出来")
        ev_count = db.query(LineageEvent).filter(
            LineageEvent.x_trace_id == trace_id
        ).count()
        ds_count = (
            db.query(Dataset)
            .filter(Dataset.id.in_([ds_cust.id, ds_off_id]))
            .count()
        )
        sample_count = (
            db.query(DatasetSample)
            .filter(DatasetSample.dataset_id.in_([ds_cust.id, ds_off_id]))
            .count()
        )
        asset_count = db.query(Asset).filter(Asset.x_trace_id == trace_id).count()
        manifest_seal = (
            db.query(DatasetSnapshotManifest)
            .filter(DatasetSnapshotManifest.x_trace_id == trace_id)
            .first()
        )

        kv("Datasets (cust + off)", ds_count)
        kv("DatasetSamples (合计)", sample_count)
        kv("LineageEvents", ev_count)
        kv("Assets", asset_count)
        kv("manifest.sealed_at",
           manifest_seal.sealed_at.isoformat() if manifest_seal and manifest_seal.sealed_at else "<not sealed>")

        # ─── 总结 ───────────────────────────────────────────────
        hr()
        info("📐 关键认知：")
        info("  - Promote 是「复制」不是「移动」：customized 改了不会自动同步到 official")
        info("  - official 想要 v2 → 重新 Promote 一次（会写新 Dataset 行 dataset_version+1）")
        info("  - jsonl 是默认交付格式（每行一 sample），dataloader 直接 readline")
        info("  - DatasetSnapshotManifest = trace 端到端 receipt，DB 行 + JSON 文件双写")

        info("🐛 算法工程师消费入口：")
        info(f"  curl 'http://localhost:8000/api/v1/datasets/{ds_off_id}'")
        info(f"  curl 'http://localhost:8000/api/v1/datasets/{ds_off_id}/samples?limit=200'")
        info(f"  cat  {out_path}")
        info(f"  open http://localhost:5173/catalog/v2/{ds_off_id}")

        done(f"official dataset {ds_off_id[:8]}… 已发版，artifact = {out_path.name}")
        info("恭喜🎉 你已经走完所有 onboarding 步骤")
        info("一次性串起来跑：make e2e-demo")
        end_banner("Promote & Export ✓ — Onboarding Complete!")

    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Onboarding 07: promote & export")
    parser.add_argument("--lance-root", default=str(DEFAULT_LANCE_ROOT))
    parser.add_argument("--reset", action="store_true")
    args = parser.parse_args()
    try:
        main(Path(args.lance_root), args.reset)
    except Exception as exc:  # noqa: BLE001
        print(f"\n❌ {type(exc).__name__}: {exc}", file=sys.stderr)
        raise
