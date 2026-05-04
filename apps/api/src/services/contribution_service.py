"""contribution_service —— sample 贡献度查询。

P2 阶段刻意 **不做物化**：每次 GET 都跑 GROUP BY；MVP 量级（< 100k events）
SQLite 跑得动。当真实训练量逼近百万事件时，参考 P3 路线把这里的查询结果
搬到 sample_contributions 表（接口契约不变）。

hard_score 公式（MVP 简化版，P3 配置化）：
    hard_score = mean_loss * log(1 + consumed_count)

不带 time_decay；不带 framework 偏置；不区分 train_run。够 demo 阶段用。
"""

from __future__ import annotations

import math
from typing import Any

from sqlalchemy import distinct, func
from sqlalchemy.orm import Session

from src.models.consumption_event import ExportConsumptionEvent


def _split_sample_uid(uid: str) -> tuple[str | None, str | None, str | None]:
    """sample_uid 约定：dataset_id:clip_id:ts。第一个 ":" 后只 split 2 次。"""
    parts = uid.split(":", 2)
    if len(parts) == 3:
        return parts[0], parts[1], parts[2]
    if len(parts) == 2:
        return parts[0], parts[1], None
    return None, None, None


def top_hard_samples(
    db: Session,
    *,
    dataset_id: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """返回 hard_score 倒序的 sample 列表（仅含有 loss 的事件）。"""
    q = (
        db.query(
            ExportConsumptionEvent.sample_uid,
            func.count(ExportConsumptionEvent.id).label("consumed_count"),
            func.count(distinct(ExportConsumptionEvent.train_run_id)).label("train_run_count"),
            func.avg(ExportConsumptionEvent.loss).label("mean_loss"),
            func.max(ExportConsumptionEvent.loss).label("max_loss"),
            func.max(ExportConsumptionEvent.ts).label("last_used_at"),
        )
        .filter(ExportConsumptionEvent.loss.isnot(None))
        .group_by(ExportConsumptionEvent.sample_uid)
    )
    if dataset_id:
        # sample_uid 形如 "<dataset_id>:..." 用 LIKE 前缀匹配
        q = q.filter(ExportConsumptionEvent.sample_uid.like(f"{dataset_id}:%"))
    rows = q.all()

    out: list[dict[str, Any]] = []
    for r in rows:
        if r.mean_loss is None:
            continue
        score = float(r.mean_loss) * math.log(1 + r.consumed_count)
        ds, clip, ts = _split_sample_uid(r.sample_uid)
        out.append({
            "sample_uid": r.sample_uid,
            "dataset_id": ds,
            "clip_id": clip,
            "ts": ts,
            "consumed_count": int(r.consumed_count),
            "train_run_count": int(r.train_run_count),
            "mean_loss": float(r.mean_loss),
            "max_loss": float(r.max_loss),
            "hard_score": score,
            "last_used_at": r.last_used_at.isoformat() if r.last_used_at else None,
        })
    out.sort(key=lambda x: x["hard_score"], reverse=True)
    return out[:limit]


_HARD_SCORE_THRESHOLD = 0.5  # MVP 经验值；高于此视为 hard sample


def dataset_rollup(db: Session) -> list[dict[str, Any]]:
    """按 dataset_id 聚合：消费量 / 唯一 train_run / 平均 loss / hard 占比。

    dataset_id 从 sample_uid 前缀解析；不依赖 dataset 表 join（跨库字符串引用）。
    """
    # 拉所有"含 loss"的事件级聚合，再 Python 端 group by dataset
    rows = (
        db.query(
            ExportConsumptionEvent.sample_uid,
            func.count(ExportConsumptionEvent.id).label("consumed_count"),
            func.count(distinct(ExportConsumptionEvent.train_run_id)).label("train_run_count"),
            func.count(distinct(ExportConsumptionEvent.snapshot_trace)).label("snapshot_count"),
            func.avg(ExportConsumptionEvent.loss).label("mean_loss"),
        )
        .group_by(ExportConsumptionEvent.sample_uid)
        .all()
    )

    by_dataset: dict[str, dict[str, Any]] = {}
    for r in rows:
        ds, _, _ = _split_sample_uid(r.sample_uid)
        if not ds:
            continue
        bucket = by_dataset.setdefault(ds, {
            "dataset_id": ds,
            "sample_count": 0,
            "consumed_count": 0,
            "train_run_ids": set(),
            "snapshot_traces": set(),
            "loss_sum": 0.0,
            "loss_n": 0,
            "hard_sample_count": 0,
        })
        bucket["sample_count"] += 1
        bucket["consumed_count"] += int(r.consumed_count)
        if r.mean_loss is not None:
            bucket["loss_sum"] += float(r.mean_loss) * int(r.consumed_count)
            bucket["loss_n"] += int(r.consumed_count)
            score = float(r.mean_loss) * math.log(1 + int(r.consumed_count))
            if score >= _HARD_SCORE_THRESHOLD:
                bucket["hard_sample_count"] += 1

    # train_run_count / snapshot_count 用第二趟纯 SQL 比较快，但 MVP 直接拉一次
    pairs = (
        db.query(
            ExportConsumptionEvent.sample_uid,
            ExportConsumptionEvent.train_run_id,
            ExportConsumptionEvent.snapshot_trace,
        ).all()
    )
    for sample_uid, run_id, snap in pairs:
        ds, _, _ = _split_sample_uid(sample_uid)
        if not ds or ds not in by_dataset:
            continue
        by_dataset[ds]["train_run_ids"].add(run_id)
        by_dataset[ds]["snapshot_traces"].add(snap)

    results: list[dict[str, Any]] = []
    for bucket in by_dataset.values():
        loss_n = bucket.pop("loss_n")
        loss_sum = bucket.pop("loss_sum")
        bucket["mean_loss"] = (loss_sum / loss_n) if loss_n else None
        bucket["train_run_count"] = len(bucket.pop("train_run_ids"))
        bucket["snapshot_count"] = len(bucket.pop("snapshot_traces"))
        bucket["hard_ratio"] = (
            bucket["hard_sample_count"] / bucket["sample_count"]
            if bucket["sample_count"] else 0.0
        )
        results.append(bucket)

    results.sort(key=lambda b: b["consumed_count"], reverse=True)
    return results


def sample_summary(db: Session, sample_uid: str) -> dict[str, Any]:
    """单 sample 详情（loss 时间序列 + 关联 train_runs）。"""
    events = (
        db.query(ExportConsumptionEvent)
        .filter(ExportConsumptionEvent.sample_uid == sample_uid)
        .order_by(ExportConsumptionEvent.ts.asc())
        .all()
    )
    if not events:
        return {"sample_uid": sample_uid, "consumed_count": 0, "events": []}

    losses = [e.loss for e in events if e.loss is not None]
    train_runs: set[str] = {e.train_run_id for e in events}
    snapshots: set[str] = {e.snapshot_trace for e in events}
    mean_loss = (sum(losses) / len(losses)) if losses else None
    hard_score = (mean_loss * math.log(1 + len(events))) if mean_loss is not None else None
    ds, clip, ts = _split_sample_uid(sample_uid)

    return {
        "sample_uid": sample_uid,
        "dataset_id": ds,
        "clip_id": clip,
        "ts": ts,
        "consumed_count": len(events),
        "train_run_count": len(train_runs),
        "snapshot_count": len(snapshots),
        "mean_loss": mean_loss,
        "max_loss": max(losses) if losses else None,
        "hard_score": hard_score,
        "train_run_ids": sorted(train_runs),
        "snapshot_traces": sorted(snapshots),
        "events": [
            {
                "ts": e.ts.isoformat() if e.ts else None,
                "epoch": e.epoch,
                "step": e.step,
                "loss": e.loss,
                "train_run_id": e.train_run_id,
            }
            for e in events
        ],
    }
