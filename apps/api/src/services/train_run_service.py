"""TrainRun 注册服务。

封装 train_run 的注册 / 完成回写，并同步维护 dataset_snapshot_manifests 上的
train_run_count / last_consumed_at 计数。

P0 阶段只支持显式 register（dlkit SDK 或人工 POST）；P1 SDK 上线后 register
由 SDK 在 dataset() 首次迭代时自动调用。
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from src.models.dataset_snapshot import DatasetSnapshotManifest
from src.models.train_run import TrainRun


def _bump_snapshot_counters(
    db: Session, snapshot_traces: list[str], now: datetime
) -> list[DatasetSnapshotManifest]:
    """命中的 snapshot 行 train_run_count + 1，刷新 last_consumed_at。"""
    if not snapshot_traces:
        return []
    rows = (
        db.query(DatasetSnapshotManifest)
        .filter(DatasetSnapshotManifest.x_trace_id.in_(snapshot_traces))
        .all()
    )
    for r in rows:
        r.train_run_count = (r.train_run_count or 0) + 1
        r.last_consumed_at = now
    return rows


def register(
    db: Session,
    *,
    snapshot_ids: list[str],
    name: str | None = None,
    consumer: str | None = None,
    external_run_id: str | None = None,
    model_version: str | None = None,
    started_at: datetime | None = None,
    notes: str | None = None,
) -> TrainRun:
    """注册一个 TrainRun。snapshot_ids 是 dataset_snapshot_manifests.x_trace_id 列表。

    主 trace 取列表第 0 个；其余进入 parent_trace_ids。空列表会抛 ValueError。
    """
    if not snapshot_ids:
        raise ValueError("snapshot_ids must contain at least one trace_id")
    primary = snapshot_ids[0]
    rest = snapshot_ids[1:]
    now = datetime.now(timezone.utc)

    run = TrainRun(
        name=name,
        consumer=consumer,
        external_run_id=external_run_id,
        model_version=model_version,
        started_at=started_at or now,
        status="running",
        snapshot_ids=list(snapshot_ids),
        parent_trace_ids=rest,
        x_trace_id=primary,
        notes=notes,
    )
    db.add(run)
    _bump_snapshot_counters(db, list(snapshot_ids), now)
    db.flush()
    return run


def finish(
    db: Session,
    *,
    run_id: str,
    status: str = "completed",
    finished_at: datetime | None = None,
    notes: str | None = None,
) -> TrainRun | None:
    run = db.query(TrainRun).filter(TrainRun.id == run_id).first()
    if run is None:
        return None
    run.status = status
    run.finished_at = finished_at or datetime.now(timezone.utc)
    if notes is not None:
        run.notes = notes
    db.flush()
    return run


def serialize(run: TrainRun) -> dict[str, Any]:
    return {
        "id": run.id,
        "name": run.name,
        "consumer": run.consumer,
        "external_run_id": run.external_run_id,
        "model_version": run.model_version,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "finished_at": run.finished_at.isoformat() if run.finished_at else None,
        "status": run.status,
        "snapshot_ids": run.snapshot_ids or [],
        "parent_trace_ids": run.parent_trace_ids or [],
        "x_trace_id": run.x_trace_id,
        "notes": run.notes,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "updated_at": run.updated_at.isoformat() if run.updated_at else None,
    }
