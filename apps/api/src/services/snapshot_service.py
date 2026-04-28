"""DatasetSnapshotManifest 写入服务

封装一个 trace 的 receipt 生命周期：
- ``open_or_create``：release 阶段调用，先把 requirement / release-run / clip 列
  锁定下来；如果已存在则 idempotent 更新。
- ``attach_dataset_version``：把 catalog 库里新建的 dataset_version 字符串 ID
  挂回来。catalog 与 apps/api 是异构 DB，**只存 ID 字符串、不建 FK**。
- ``attach_export_artifact``：export 完成后回写 export_job_id / artifact uri；
  同时把完整 manifest JSON 写到 ``data/exports/e2e-snapshot-<trace>.json``
  作为离线"链路 receipt"。
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from src.models.dataset_snapshot import DatasetSnapshotManifest


SNAPSHOT_DIR = Path("data/exports")


def _receipt_path(trace_id: str) -> Path:
    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    return SNAPSHOT_DIR / f"e2e-snapshot-{trace_id}.json"


def _by_trace(db: Session, trace_id: str) -> DatasetSnapshotManifest | None:
    return (
        db.query(DatasetSnapshotManifest)
        .filter(DatasetSnapshotManifest.x_trace_id == trace_id)
        .first()
    )


def _serialize(m: DatasetSnapshotManifest) -> dict[str, Any]:
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


def open_or_create(
    db: Session,
    *,
    x_trace_id: str,
    requirement_id: str | None = None,
    data_task_id: str | None = None,
    operations_task_id: str | None = None,
    gold_pipeline_run_id: str | None = None,
    pipeline_run_count: int = 0,
    clip_ids: list[str] | None = None,
    scenario: str | None = None,
    title: str | None = None,
    summary: str | None = None,
) -> DatasetSnapshotManifest:
    """release 阶段调用，幂等。"""
    m = _by_trace(db, x_trace_id)
    if m is None:
        m = DatasetSnapshotManifest(x_trace_id=x_trace_id)
        db.add(m)
    # 仅当传入非 None 时覆盖，避免后续步骤把已写好的字段意外清空
    if requirement_id is not None:
        m.requirement_id = requirement_id
    if data_task_id is not None:
        m.data_task_id = data_task_id
    if operations_task_id is not None:
        m.operations_task_id = operations_task_id
    if gold_pipeline_run_id is not None:
        m.gold_pipeline_run_id = gold_pipeline_run_id
    if pipeline_run_count:
        m.pipeline_run_count = pipeline_run_count
    if clip_ids is not None:
        m.clip_ids = list(clip_ids)
    if scenario is not None:
        m.scenario = scenario
    if title is not None:
        m.title = title
    if summary is not None:
        m.summary = summary
    db.flush()
    return m


def attach_dataset_version(
    db: Session,
    *,
    x_trace_id: str,
    dataset_id: str,
    dataset_version_id: str,
) -> DatasetSnapshotManifest | None:
    m = _by_trace(db, x_trace_id)
    if m is None:
        return None
    m.dataset_id = dataset_id
    m.dataset_version_id = dataset_version_id
    db.flush()
    return m


def attach_export_artifact(
    db: Session,
    *,
    x_trace_id: str,
    export_job_id: str | None,
    export_artifact_uri: str,
    export_format: str,
) -> DatasetSnapshotManifest | None:
    """export 落盘后回写并 seal manifest。同时把全 receipt 写到磁盘。"""
    m = _by_trace(db, x_trace_id)
    if m is None:
        return None
    m.export_job_id = export_job_id
    m.export_artifact_uri = export_artifact_uri
    m.export_format = export_format
    m.sealed_at = datetime.now(timezone.utc)
    payload = _serialize(m)
    m.manifest_json = payload
    _receipt_path(x_trace_id).write_text(
        json.dumps(payload, indent=2, default=str, ensure_ascii=False),
        encoding="utf-8",
    )
    db.flush()
    return m


def find_trace_by_dataset_version(
    db: Session, dataset_version_id: str
) -> str | None:
    """export 路由没有直接拿到 trace_id，只有 dataset_version_id；用它反查。"""
    m = (
        db.query(DatasetSnapshotManifest)
        .filter(DatasetSnapshotManifest.dataset_version_id == dataset_version_id)
        .order_by(DatasetSnapshotManifest.created_at.desc())
        .first()
    )
    return m.x_trace_id if m else None
