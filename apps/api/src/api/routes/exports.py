"""Exports 路由——数据交付与训练贡献追踪的统一入口。

`POST /api/v1/exports/datasets/{dataset_id}` —— 触发 dataset 出仓
`GET  /api/v1/exports/snapshots`             —— 列表
`GET  /api/v1/exports/snapshots/{trace}`     —— receipt + 关联 train_runs
`GET  /api/v1/exports/train-runs`            —— TrainRun 列表
`POST /api/v1/exports/train-runs`            —— 注册 TrainRun（SDK / 人工）
`PATCH /api/v1/exports/train-runs/{id}`      —— 标记完成 / 更新状态
`POST /api/v1/exports/usage`                 —— P1：SDK 批量上报 sample 消费事件
`GET  /api/v1/exports/usage`                 —— P1：消费事件查询（按 snapshot/run 过滤）

P2 之后会再加 `/contributions`（聚合查询）。
"""

from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.core.runtime import get_runtime_container
from src.models.dataset_snapshot import DatasetSnapshotManifest
from src.models.train_run import TrainRun
from src.services import (
    consumption_event_service,
    contribution_service,
    snapshot_service,
    train_run_service,
)


router = APIRouter(prefix="/api/v1/exports", tags=["Exports"])

_log = logging.getLogger(__name__)


# ─────────────────────────── Dataset export 触发 ───────────────────────────


@router.post("/datasets/{dataset_id}")
def export_dataset(
    dataset_id: str,
    format: str = Query("lance", description="lance / csv / jsonl"),
    request: Request = None,
    db: Session = Depends(get_db),
) -> dict:
    """触发 dataset 出仓：落 artifact + 回写 snapshot manifest。

    Manifest 回写仅当此 dataset_version 已被 release 阶段挂到某个 trace（snapshot）。
    catalog 与 metadata 是异构 DB——两侧失败都不阻塞主响应，但写日志。
    """
    container = get_runtime_container()
    versions = container.metadata.list_dataset_versions(dataset_id)
    if not versions:
        return {"error": f"dataset {dataset_id} has no versions"}
    latest_version = versions[-1]
    output_path = Path("data/exports") / f'{dataset_id}-{latest_version["version_id"]}.{format}'
    container.table.export(latest_version["table_name"], output_path, format=format)
    export_job = container.metadata.create_export_job({
        "export_id": f'export-{dataset_id}-{latest_version["version_id"]}-{format}',
        "dataset_id": dataset_id,
        "format": format,
        "status": "ready",
        "output_path": str(output_path),
    })

    trace_id = (
        request.headers.get("X-Trace-Id") if request is not None else None
    ) or snapshot_service.find_trace_by_dataset_version(
        db, latest_version["version_id"]
    )
    if trace_id:
        try:
            snapshot_service.attach_export_artifact(
                db,
                x_trace_id=trace_id,
                export_job_id=export_job.get("export_id") if isinstance(export_job, dict) else None,
                export_artifact_uri=str(output_path),
                export_format=format,
            )
            db.commit()
        except Exception as exc:  # noqa: BLE001 — manifest 失败不阻塞导出
            _log.warning("snapshot manifest update failed for trace %s: %s", trace_id, exc)
            db.rollback()

    return export_job


# ─────────────────────────── Snapshots ───────────────────────────


def _serialize_snapshot(m: DatasetSnapshotManifest) -> dict:
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
        "sealed_at": m.sealed_at.isoformat() if m.sealed_at else None,
        "consumed_count": m.consumed_count,
        "train_run_count": m.train_run_count,
        "last_consumed_at": m.last_consumed_at.isoformat() if m.last_consumed_at else None,
        "hard_sample_count": m.hard_sample_count,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "updated_at": m.updated_at.isoformat() if m.updated_at else None,
    }


@router.get("/snapshots")
def list_snapshots(
    limit: int = Query(50, ge=1, le=500),
    scenario: str | None = Query(None),
    dataset_id: str | None = Query(None),
    requirement_id: str | None = Query(None, description="按需求过滤（Requirement Report 用）"),
    consumed: str | None = Query(None, description="yes / no / null=不过滤"),
    db: Session = Depends(get_db),
) -> dict:
    q = db.query(DatasetSnapshotManifest).order_by(
        DatasetSnapshotManifest.created_at.desc()
    )
    if scenario:
        q = q.filter(DatasetSnapshotManifest.scenario == scenario)
    if dataset_id:
        q = q.filter(DatasetSnapshotManifest.dataset_id == dataset_id)
    if requirement_id:
        q = q.filter(DatasetSnapshotManifest.requirement_id == requirement_id)
    # "consumed" 含义：snapshot 已经被某个 TrainRun 注册（P0 信号）或有 sample 级
    # ConsumptionEvent（P1 信号）。两者其一即视为已消费。
    if consumed == "yes":
        q = q.filter(or_(
            DatasetSnapshotManifest.consumed_count > 0,
            DatasetSnapshotManifest.train_run_count > 0,
        ))
    elif consumed == "no":
        q = q.filter(
            DatasetSnapshotManifest.consumed_count == 0,
            DatasetSnapshotManifest.train_run_count == 0,
        )
    rows = q.limit(limit).all()
    return {"items": [_serialize_snapshot(r) for r in rows], "total": len(rows)}


@router.get("/snapshots/{trace_id}")
def get_snapshot(trace_id: str, db: Session = Depends(get_db)) -> dict:
    m = (
        db.query(DatasetSnapshotManifest)
        .filter(DatasetSnapshotManifest.x_trace_id == trace_id)
        .first()
    )
    if not m:
        raise HTTPException(404, detail=f"snapshot not found for trace {trace_id}")
    payload = _serialize_snapshot(m)
    payload["manifest_json"] = m.manifest_json
    runs = (
        db.query(TrainRun)
        .filter(TrainRun.snapshot_ids.contains([trace_id]))
        .order_by(TrainRun.started_at.desc().nullslast())
        .limit(50)
        .all()
    )
    payload["train_runs"] = [train_run_service.serialize(r) for r in runs]
    return payload


# ─────────────────────────── TrainRuns ───────────────────────────


class TrainRunCreate(BaseModel):
    snapshot_ids: list[str] = Field(..., min_length=1,
                                    description="dataset_snapshot_manifests.x_trace_id 列表")
    name: Optional[str] = None
    consumer: Optional[str] = None
    external_run_id: Optional[str] = None
    model_version: Optional[str] = None
    started_at: Optional[datetime] = None
    notes: Optional[str] = None


class TrainRunUpdate(BaseModel):
    status: str = Field("completed", description="completed / failed / unknown")
    finished_at: Optional[datetime] = None
    notes: Optional[str] = None


@router.get("/train-runs")
def list_train_runs(
    limit: int = Query(50, ge=1, le=500),
    snapshot_trace: str | None = Query(None, description="按 snapshot.x_trace_id 过滤"),
    consumer: str | None = Query(None),
    status: str | None = Query(None),
    db: Session = Depends(get_db),
) -> dict:
    q = db.query(TrainRun).order_by(TrainRun.created_at.desc())
    if consumer:
        q = q.filter(TrainRun.consumer == consumer)
    if status:
        q = q.filter(TrainRun.status == status)
    if snapshot_trace:
        q = q.filter(TrainRun.snapshot_ids.contains([snapshot_trace]))
    rows = q.limit(limit).all()
    return {
        "items": [train_run_service.serialize(r) for r in rows],
        "total": len(rows),
    }


@router.get("/train-runs/{run_id}")
def get_train_run(run_id: str, db: Session = Depends(get_db)) -> dict:
    r = db.query(TrainRun).filter(TrainRun.id == run_id).first()
    if not r:
        raise HTTPException(404, detail=f"train_run {run_id} not found")
    return train_run_service.serialize(r)


@router.post("/train-runs", status_code=201)
def create_train_run(
    payload: TrainRunCreate = Body(...),
    db: Session = Depends(get_db),
) -> dict:
    run = train_run_service.register(
        db,
        snapshot_ids=payload.snapshot_ids,
        name=payload.name,
        consumer=payload.consumer,
        external_run_id=payload.external_run_id,
        model_version=payload.model_version,
        started_at=payload.started_at,
        notes=payload.notes,
    )
    db.commit()
    return train_run_service.serialize(run)


@router.patch("/train-runs/{run_id}")
def patch_train_run(
    run_id: str,
    payload: TrainRunUpdate = Body(...),
    db: Session = Depends(get_db),
) -> dict:
    run = train_run_service.finish(
        db,
        run_id=run_id,
        status=payload.status,
        finished_at=payload.finished_at,
        notes=payload.notes,
    )
    if run is None:
        raise HTTPException(404, detail=f"train_run {run_id} not found")
    db.commit()
    return train_run_service.serialize(run)


# ─────────────────────────── Usage（P1：sample 级消费事件）───────────────────────────


class UsageEvent(BaseModel):
    snapshot_trace: str = Field(..., description="dataset_snapshot_manifests.x_trace_id")
    sample_uid: str = Field(..., description="sample 唯一键（一般 dataset_id:clip_id:ts）")
    train_run_id: str
    epoch: Optional[int] = None
    step: Optional[int] = None
    loss: Optional[float] = None
    ts: datetime
    x_trace_id: Optional[str] = None  # 缺省取 snapshot_trace


class UsageBatch(BaseModel):
    events: list[UsageEvent] = Field(..., min_length=1, max_length=10_000)


@router.post("/usage", status_code=202)
def ingest_usage(
    payload: UsageBatch = Body(...),
    db: Session = Depends(get_db),
) -> dict:
    """SDK 批量上报 sample 消费事件。返回 {accepted, snapshots_bumped}。"""
    result = consumption_event_service.ingest_batch(
        db, events=[ev.model_dump() for ev in payload.events]
    )
    db.commit()
    return result


@router.get("/usage")
def list_usage(
    snapshot_trace: str | None = Query(None),
    train_run_id: str | None = Query(None),
    sample_uid: str | None = Query(None),
    sample_uid_prefix: str | None = Query(
        None, description="LIKE 前缀匹配，clip 级查询常用：dataset_id:clip_id:"
    ),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
) -> dict:
    rows = consumption_event_service.list_events(
        db,
        snapshot_trace=snapshot_trace,
        train_run_id=train_run_id,
        sample_uid=sample_uid,
        sample_uid_prefix=sample_uid_prefix,
        limit=limit,
    )
    return {
        "items": [consumption_event_service.serialize(r) for r in rows],
        "total": len(rows),
    }


# ─────────────────────────── Contributions（P2：训练贡献度）───────────────────────────


@router.get("/contributions")
def list_contributions(
    dataset_id: str | None = Query(None, description="按 dataset 前缀过滤"),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
) -> dict:
    """top hard samples（按 hard_score = mean_loss * log(1+consumed_count) 倒序）。"""
    items = contribution_service.top_hard_samples(
        db, dataset_id=dataset_id, limit=limit
    )
    return {"items": items, "total": len(items)}


@router.get("/contributions/rollup")
def contributions_rollup(
    dataset_id: str | None = Query(None, description="只看某个 dataset"),
    db: Session = Depends(get_db),
) -> dict:
    """按 dataset 维度聚合：消费量 / 唯一 train_run / 平均 loss / hard 占比。"""
    rows = contribution_service.dataset_rollup(db)
    if dataset_id:
        rows = [r for r in rows if r["dataset_id"] == dataset_id]
    return {"items": rows, "total": len(rows)}


@router.get("/contributions/{sample_uid:path}")
def get_contribution(sample_uid: str, db: Session = Depends(get_db)) -> dict:
    """单 sample 详情：summary + loss 时间序列。"""
    return contribution_service.sample_summary(db, sample_uid)
