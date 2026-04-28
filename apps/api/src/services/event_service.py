"""LineageEvent + EventResult 写入服务

设计取舍：
- 提供 ``emit_event`` 一次性写 event + 多个 result，避免上层散落组装。
- ``event_id`` 业务可读 ID（``evt_<yyyymmdd>_<short>``）按需生成；不强制唯一，
  PK 仍是 UUID。
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import desc
from sqlalchemy.orm import Session

from src.models.lineage_event import EventResult, LineageEvent


@dataclass
class EventResultPayload:
    clip_id: str
    payload_type: str  # tag / label / check / mining_candidate
    tags: Optional[str] = None
    da_tags: Optional[str] = None
    trigger_event_tags: Optional[str] = None
    ts: Optional[int] = None
    extra: Optional[dict] = None
    note: Optional[str] = None


# 4 个维度对应的 (event_type 集合, payload_type) 过滤
_DIMENSION_FILTERS: dict[str, tuple[tuple[str, ...], str]] = {
    "tagging": (("tagging", "migration"), "tag"),
    "labeling": (("labeling",), "label"),
    "checking": (("checking",), "check"),
    "mining": (("mining",), "mining_candidate"),
}


def _build_event_id() -> str:
    return f"evt_{datetime.now(timezone.utc).strftime('%Y%m%d')}_{uuid.uuid4().hex[:8]}"


def emit_event(
    db: Session,
    *,
    event_type: str,
    source_type: Optional[str] = None,
    pipeline_commit: Optional[str] = None,
    pipeline_repo: Optional[str] = None,
    branch_name: Optional[str] = None,
    job_id: Optional[str] = None,
    requirement_id: Optional[str] = None,
    operations_task_id: Optional[str] = None,
    pipeline_run_id: Optional[str] = None,
    x_trace_id: Optional[str] = None,
    snapshot_id: Optional[int] = None,
    table_name: Optional[str] = None,
    payload: Optional[dict] = None,
    results: Optional[list[EventResultPayload]] = None,
    event_id: Optional[str] = None,
) -> LineageEvent:
    """写一条 LineageEvent + N 条 EventResult，单事务里完成。"""
    ev = LineageEvent(
        event_id=event_id or _build_event_id(),
        event_type=event_type,
        source_type=source_type,
        pipeline_commit=pipeline_commit,
        pipeline_repo=pipeline_repo,
        branch_name=branch_name,
        job_id=job_id,
        requirement_id=requirement_id,
        operations_task_id=operations_task_id,
        pipeline_run_id=pipeline_run_id,
        x_trace_id=x_trace_id,
        snapshot_id=snapshot_id,
        table_name=table_name,
        payload=payload,
    )
    db.add(ev)
    db.flush()
    for r in results or []:
        db.add(EventResult(
            event_pk=ev.id,
            clip_id=r.clip_id,
            payload_type=r.payload_type,
            tags=r.tags,
            da_tags=r.da_tags,
            trigger_event_tags=r.trigger_event_tags,
            ts=r.ts,
            extra=r.extra,
            note=r.note,
        ))
    db.flush()
    return ev


def serialize_event(ev: LineageEvent, *, with_results: bool = False) -> dict[str, Any]:
    body: dict[str, Any] = {
        "id": ev.id,
        "event_id": ev.event_id,
        "event_type": ev.event_type,
        "job_id": ev.job_id,
        "requirement_id": ev.requirement_id,
        "operations_task_id": ev.operations_task_id,
        "pipeline_run_id": ev.pipeline_run_id,
        "source_type": ev.source_type,
        "snapshot_id": ev.snapshot_id,
        "pipeline_commit": ev.pipeline_commit,
        "pipeline_repo": ev.pipeline_repo,
        "branch_name": ev.branch_name,
        "table_name": ev.table_name,
        "x_trace_id": ev.x_trace_id,
        "payload": ev.payload,
        "created_at": ev.created_at.isoformat() if ev.created_at else None,
    }
    if with_results:
        body["results"] = [serialize_result(r) for r in ev.results]
    return body


def serialize_result(r: EventResult) -> dict[str, Any]:
    return {
        "id": r.id,
        "event_pk": r.event_pk,
        "clip_id": r.clip_id,
        "payload_type": r.payload_type,
        "tags": r.tags,
        "da_tags": r.da_tags,
        "trigger_event_tags": r.trigger_event_tags,
        "ts": r.ts,
        "extra": r.extra,
        "note": r.note,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


def query_dimension(
    db: Session,
    dimension: str,
    *,
    requirement_id: Optional[str] = None,
    x_trace_id: Optional[str] = None,
    clip_id: Optional[str] = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """按维度（tagging/labeling/checking/mining）查询事件结果。"""
    if dimension not in _DIMENSION_FILTERS:
        raise ValueError(f"unknown dimension: {dimension}")
    event_types, payload_type = _DIMENSION_FILTERS[dimension]

    q = (
        db.query(EventResult, LineageEvent)
        .join(LineageEvent, LineageEvent.id == EventResult.event_pk)
        .filter(LineageEvent.event_type.in_(event_types))
        .filter(EventResult.payload_type == payload_type)
    )
    if requirement_id:
        q = q.filter(LineageEvent.requirement_id == requirement_id)
    if x_trace_id:
        q = q.filter(LineageEvent.x_trace_id == x_trace_id)
    if clip_id:
        q = q.filter(EventResult.clip_id == clip_id)
    q = q.order_by(desc(EventResult.created_at)).limit(limit)

    rows = []
    for r, ev in q.all():
        body = serialize_result(r)
        body["event"] = {
            "event_id": ev.event_id,
            "event_type": ev.event_type,
            "x_trace_id": ev.x_trace_id,
            "requirement_id": ev.requirement_id,
            "operations_task_id": ev.operations_task_id,
        }
        rows.append(body)
    return rows
