"""ExportConsumptionEvent 批量入库服务。

dlkit SDK 把若干 sample 消费事件批量 POST 上来；本服务负责：
1. 批量插入事件
2. 按 snapshot_trace 聚合后，一次性 bump 对应 snapshot 的 consumed_count /
   last_consumed_at，避免 N+1 update。

故意保持简单：不去重（重复 POST 计入；客户端 buffer 自负责），不开事务隔离
（默认 read-committed 即可），不做 schema 校验外的额外验证。
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from src.models.consumption_event import ExportConsumptionEvent
from src.models.dataset_snapshot import DatasetSnapshotManifest


def ingest_batch(
    db: Session,
    *,
    events: list[dict[str, Any]],
) -> dict[str, Any]:
    """批量入库 + bump snapshot 计数。

    每条 event 必填字段：snapshot_trace, sample_uid, train_run_id, ts。
    可选：epoch, step, loss, x_trace_id（缺省取 snapshot_trace）。

    返回 {accepted: int, snapshots_bumped: int}。
    """
    if not events:
        return {"accepted": 0, "snapshots_bumped": 0}

    rows: list[ExportConsumptionEvent] = []
    by_snapshot: dict[str, list[datetime]] = defaultdict(list)

    for ev in events:
        snapshot_trace = ev["snapshot_trace"]
        ts_raw = ev["ts"]
        ts = ts_raw if isinstance(ts_raw, datetime) else datetime.fromisoformat(ts_raw)
        rows.append(ExportConsumptionEvent(
            id=str(uuid.uuid4()),
            snapshot_trace=snapshot_trace,
            sample_uid=ev["sample_uid"],
            train_run_id=ev["train_run_id"],
            epoch=ev.get("epoch"),
            step=ev.get("step"),
            loss=ev.get("loss"),
            ts=ts,
            x_trace_id=ev.get("x_trace_id") or snapshot_trace,
        ))
        by_snapshot[snapshot_trace].append(ts)

    db.bulk_save_objects(rows)

    # 按 snapshot 一次性 bump 计数 + 更新 last_consumed_at
    snapshot_traces = list(by_snapshot.keys())
    snapshots = (
        db.query(DatasetSnapshotManifest)
        .filter(DatasetSnapshotManifest.x_trace_id.in_(snapshot_traces))
        .all()
    )
    for snap in snapshots:
        batch_ts = by_snapshot[snap.x_trace_id]
        snap.consumed_count = (snap.consumed_count or 0) + len(batch_ts)
        max_ts = max(batch_ts)
        if max_ts.tzinfo is None:
            max_ts = max_ts.replace(tzinfo=timezone.utc)
        # SQLite returns naive datetimes even when column is timezone=True; normalize
        existing = snap.last_consumed_at
        if existing is not None and existing.tzinfo is None:
            existing = existing.replace(tzinfo=timezone.utc)
        if existing is None or existing < max_ts:
            snap.last_consumed_at = max_ts

    return {"accepted": len(rows), "snapshots_bumped": len(snapshots)}


def list_events(
    db: Session,
    *,
    snapshot_trace: str | None = None,
    train_run_id: str | None = None,
    sample_uid: str | None = None,
    sample_uid_prefix: str | None = None,
    limit: int = 100,
) -> list[ExportConsumptionEvent]:
    q = db.query(ExportConsumptionEvent).order_by(ExportConsumptionEvent.ts.desc())
    if snapshot_trace:
        q = q.filter(ExportConsumptionEvent.snapshot_trace == snapshot_trace)
    if train_run_id:
        q = q.filter(ExportConsumptionEvent.train_run_id == train_run_id)
    if sample_uid:
        q = q.filter(ExportConsumptionEvent.sample_uid == sample_uid)
    if sample_uid_prefix:
        # Clip-level lookup: sample_uid 形如 "<dataset>:<clip>:<ts>"，按 dataset:clip:* 找
        q = q.filter(ExportConsumptionEvent.sample_uid.like(f"{sample_uid_prefix}%"))
    return q.limit(limit).all()


def serialize(ev: ExportConsumptionEvent) -> dict[str, Any]:
    return {
        "id": ev.id,
        "snapshot_trace": ev.snapshot_trace,
        "sample_uid": ev.sample_uid,
        "train_run_id": ev.train_run_id,
        "epoch": ev.epoch,
        "step": ev.step,
        "loss": ev.loss,
        "ts": ev.ts.isoformat() if ev.ts else None,
        "x_trace_id": ev.x_trace_id,
        "created_at": ev.created_at.isoformat() if ev.created_at else None,
    }
