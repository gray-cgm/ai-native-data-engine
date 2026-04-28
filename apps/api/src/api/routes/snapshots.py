"""DatasetSnapshotManifest 路由

`GET /api/v1/snapshots/{trace_id}` —— 查一个 trace 的链路 receipt。
`GET /api/v1/snapshots` —— 最近 N 条 manifest（用于演示首页 / Pipelines Overview）。

写入由 services.snapshot_service 完成（release/export 阶段触发）。
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.models.dataset_snapshot import DatasetSnapshotManifest


router = APIRouter(prefix="/api/v1/snapshots", tags=["链路 Receipt"])


def _serialize(m: DatasetSnapshotManifest) -> dict:
    return {
        "id": m.id,
        "x_trace_id": m.x_trace_id,
        "requirement_id": m.requirement_id,
        "data_task_id": m.data_task_id,
        "operations_task_id": m.operations_task_id,
        "gold_pipeline_run_id": m.gold_pipeline_run_id,
        "pipeline_run_count": m.pipeline_run_count,
        "dataset_id": m.dataset_id,
        "dataset_version_id": m.dataset_version_id,
        "export_job_id": m.export_job_id,
        "export_artifact_uri": m.export_artifact_uri,
        "export_format": m.export_format,
        "clip_ids": m.clip_ids or [],
        "scenario": m.scenario,
        "title": m.title,
        "summary": m.summary,
        "manifest_json": m.manifest_json,
        "sealed_at": m.sealed_at.isoformat() if m.sealed_at else None,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "updated_at": m.updated_at.isoformat() if m.updated_at else None,
    }


@router.get("")
def list_snapshots(
    limit: int = Query(20, ge=1, le=200),
    scenario: str | None = Query(None),
    db: Session = Depends(get_db),
) -> dict:
    q = db.query(DatasetSnapshotManifest).order_by(
        DatasetSnapshotManifest.created_at.desc()
    )
    if scenario:
        q = q.filter(DatasetSnapshotManifest.scenario == scenario)
    rows = q.limit(limit).all()
    return {"items": [_serialize(r) for r in rows], "total": len(rows)}


@router.get("/{trace_id}")
def get_snapshot(trace_id: str, db: Session = Depends(get_db)) -> dict:
    m = (
        db.query(DatasetSnapshotManifest)
        .filter(DatasetSnapshotManifest.x_trace_id == trace_id)
        .first()
    )
    if not m:
        raise HTTPException(404, detail=f"snapshot not found for trace {trace_id}")
    return _serialize(m)
