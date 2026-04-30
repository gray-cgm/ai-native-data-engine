"""05 · 数据集与样本（Customized Dataset + Flexible Cut）

🎯 目标
   学会写 DatasetSample 的三种切割策略，理解 Dataset / DatasetSample / Clip 三者关系。

📖 知识点
   - Dataset 只有 customized + official 两类（详见 docs/architecture/glossary-...）
   - DatasetSample = (dataset_id, clip_id, ts) 三元组唯一约束
   - 切割策略 slice_strategy：
     · flexible       —— 用户在 Explorer 拖动选 [start,end]，ts 取中点
     · one_to_four    —— clip 等分 4 段，每段中点为 ts
     · random_sample  —— 随机窗口
   - ts 取自 Lance metadata 的 start_time / end_time（ns）
   - 服务函数：apps/api/src/services/dataset_slice_service.py

🚀 跑法
   uv run --package api python -m src.scripts.onboarding.s05_dataset_sample
   uv run --package api python -m src.scripts.onboarding.s05_dataset_sample --reset
"""

from __future__ import annotations

import argparse
import sys
import uuid
from pathlib import Path

from adapters import clip_reader
from src.core.database import SessionLocal, init_db
from src.models.dataset import Dataset, DatasetSample
from src.services import dataset_slice_service as slicer

from src.scripts.onboarding._console import banner, done, end_banner, hr, info, kv, step, warn


DEFAULT_LANCE_ROOT = Path("data/lance")


def main(lance_root: Path, reset: bool) -> None:
    banner(
        "05 · 数据集与样本",
        "create_dataset → flexible_cut/one_to_four/random_sample 三策略",
    )

    init_db()
    db = SessionLocal()

    try:
        if reset:
            removed = (
                db.query(Dataset).filter(Dataset.name.like("ds_onb_05_%")).all()
            )
            for d in removed:
                db.delete(d)
            db.commit()
            warn(f"reset：清掉 {len(removed)} 个旧 demo dataset（cascade 删 sample）")

        # ─── Step 1：拿候选 clip ────────────────────────────────
        step(1, "选 3 个 clip 当 demo 候选")
        clip_ids = clip_reader.list_clip_ids(lance_root)
        if not clip_ids:
            warn(f"{lance_root} 下没有 clip。先跑 s01 / make ingest")
            return
        candidates = clip_ids[:3]
        for cid in candidates:
            kv("clip_id", cid)

        trace_id = f"trace_onb_{uuid.uuid4().hex[:8]}"
        info(f"x_trace_id = {trace_id}（贯穿后续 sample / event）")

        # ─── Step 2：create_dataset ────────────────────────────
        step(2, "create customized dataset",
             "强约束：customized.allow_train 必为 false；source_type=csv ⇒ customized")
        ds = slicer.create_dataset(
            db,
            name=f"ds_onb_05_{trace_id[-6:]}",
            dataset_type="customized",
            source_type="other",
            allow_train=False,
            tag_expr="onboarding-demo",
            slice_strategy="flexible",
            ts_policy="flexible_window",
            default_range_l=-1,
            default_range_r=3,
            created_by="onboarding",
        )
        db.commit()
        kv("dataset.id", ds.id)
        kv("dataset.name", ds.name)
        kv("dataset.type", ds.dataset_type)
        kv("dataset.allow_train", ds.allow_train)
        kv("default_range", f"[{ds.default_range_l}, {ds.default_range_r}] (frames)")

        # ─── Step 3：flexible_cut（Explorer 切片入口） ─────────
        step(3, "flexible_cut clip[0]",
             "模拟 Explorer Mark in / Mark out：用 Lance meta 的 start/end 当 in/out")
        clip0 = candidates[0]
        meta0 = clip_reader.load_meta(lance_root / clip0)
        start_ns, end_ns = int(meta0.get("start_time", 0)), int(meta0.get("end_time", 0))
        kv("clip start (ns)", start_ns)
        kv("clip end (ns)", end_ns)
        kv("clip duration", f"{(end_ns - start_ns) / 1e9:.2f} s")

        # 选中段 30%-70% 作为 in/out（模拟用户拖手柄）
        cut_start = start_ns + int((end_ns - start_ns) * 0.3)
        cut_end = start_ns + int((end_ns - start_ns) * 0.7)
        result = slicer.flexible_cut(
            db,
            dataset=ds,
            clip_id=clip0,
            ts_start=cut_start,
            ts_end=cut_end,
            x_trace_id=trace_id,
            note="onboarding-demo-flexible",
        )
        db.commit()
        info(f"flexible_cut 写入：sample={result['sample'] is not None}, "
             f"deduplicated={result['deduplicated']}")
        if result["sample"]:
            kv("sample.ts", result["sample"]["ts"])
            kv("sample.ts_origin", result["sample"]["ts_origin"])
            kv("sample.training_type", result["sample"]["training_type"])

        # ─── Step 4：one_to_four（official 默认策略） ──────────
        step(4, "cut_one_to_four clip[1]",
             "把 clip 等分 4 段，写 4 条 sample（ts 是每段中点）")
        clip1 = candidates[1] if len(candidates) > 1 else clip0
        meta1 = clip_reader.load_meta(lance_root / clip1)
        rows = slicer.cut_one_to_four(
            db,
            dataset=ds,
            clip_id=clip1,
            clip_start_ts=int(meta1.get("start_time", 0)),
            clip_end_ts=int(meta1.get("end_time", 0)),
        )
        db.commit()
        info(f"写 {len(rows)} 条 sample（part 1..4）")
        for r in rows:
            kv("ts", f'{r["ts"]} ({r["ts_origin"]}, part={r.get("origin_ref")})')

        # ─── Step 5：random_sample（mining 场景） ─────────────
        step(5, "random_sample clip[2]",
             "n 次随机窗口：mining 工作流的 hard-case 探索常用")
        clip2 = candidates[2] if len(candidates) > 2 else clip0
        meta2 = clip_reader.load_meta(lance_root / clip2)
        rows = slicer.random_sample(
            db,
            dataset=ds,
            clip_id=clip2,
            clip_start_ts=int(meta2.get("start_time", 0)),
            clip_end_ts=int(meta2.get("end_time", 0)),
            n=2,
            seed=42,  # 固定 seed 让 demo 可复现
        )
        db.commit()
        info(f"写 {len(rows)} 条随机 sample")
        for r in rows:
            kv("ts", f'{r["ts"]} ({r["ts_origin"]})')

        # ─── Step 6：唯一约束实测 ──────────────────────────────
        step(6, "幂等校验",
             "同 (dataset, clip, ts) 重写应该被 UNIQUE 约束兜回")
        # 重跑同一个 flexible_cut，应该 deduplicated=True
        result2 = slicer.flexible_cut(
            db, dataset=ds, clip_id=clip0,
            ts_start=cut_start, ts_end=cut_end,
            x_trace_id=trace_id,
        )
        db.commit()
        info(f"重复切割：deduplicated={result2['deduplicated']}, "
             f"sample={result2['sample']}")

        # ─── Step 7：聚合查询 ──────────────────────────────────
        step(7, "看本 dataset 的 sample 分布")
        from sqlalchemy import func  # noqa: PLC0415 — 局部用一次

        total = db.query(func.count(DatasetSample.id)).filter(
            DatasetSample.dataset_id == ds.id
        ).scalar()
        kv("total samples", total)

        rows = (
            db.query(DatasetSample.training_type, func.count(DatasetSample.id))
            .filter(DatasetSample.dataset_id == ds.id)
            .group_by(DatasetSample.training_type)
            .all()
        )
        for tt, n in rows:
            kv(f"  {tt}", n)

        rows = (
            db.query(DatasetSample.ts_origin, func.count(DatasetSample.id))
            .filter(DatasetSample.dataset_id == ds.id)
            .group_by(DatasetSample.ts_origin)
            .all()
        )
        info("by ts_origin：")
        for o, n in rows:
            kv(f"  {o}", n)

        # ─── 总结 ───────────────────────────────────────────────
        hr()
        info("📐 关键认知：")
        info("  - Dataset 是「容器」，DatasetSample 才是「事实行」")
        info("  - 一个 clip 可在多个 dataset 里以不同 ts 出现")
        info("  - training_type 入库即随机分配（默认权重 train:test:holdout = 7:2:1）")

        info("🐛 调试：")
        info(f"  curl 'http://localhost:8000/api/v1/datasets/{ds.id}'")
        info(f"  curl 'http://localhost:8000/api/v1/datasets/{ds.id}/samples?limit=10'")
        info(f"  open  http://localhost:5173/catalog/v2/{ds.id}")

        done(f"customized dataset {ds.id[:8]}… 写入 {total} 条 sample")
        info("下一步：s06_snowflake_lineage.py 看 mining / labeling 事件怎么落库")
        end_banner("Dataset & Sample ✓")

    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Onboarding 05: dataset & sample")
    parser.add_argument("--lance-root", default=str(DEFAULT_LANCE_ROOT))
    parser.add_argument("--reset", action="store_true")
    args = parser.parse_args()
    try:
        main(Path(args.lance_root), args.reset)
    except Exception as exc:  # noqa: BLE001
        print(f"\n❌ {type(exc).__name__}: {exc}", file=sys.stderr)
        raise
