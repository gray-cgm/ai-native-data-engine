"""LineageEvent / EventResult REST API

- POST   /api/v1/events                      写入（一般由内部服务调用）
- GET    /api/v1/events                      列表（event_type / requirement_id / x_trace_id 过滤）
- GET    /api/v1/events/{event_pk}           单条 + 其 results
- GET    /api/v1/events/dimensions/{dim}     维度视图（tagging/labeling/checking/mining）
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.models.lineage_event import LineageEvent
from src.services import event_service


router = APIRouter(prefix="/api/v1/events", tags=["lineage-events"])


@router.post("")
def create_event(
    body: dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    results_payload = [
        event_service.EventResultPayload(**r) for r in body.pop("results", []) or []
    ]
    if "event_type" not in body:
        raise HTTPException(status_code=400, detail="event_type is required")
    ev = event_service.emit_event(db, results=results_payload, **body)
    db.commit()
    return event_service.serialize_event(ev, with_results=True)


@router.get("")
def list_events(
    event_type: Optional[str] = Query(default=None),
    requirement_id: Optional[str] = Query(default=None),
    x_trace_id: Optional[str] = Query(default=None),
    operations_task_id: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    q = db.query(LineageEvent).order_by(LineageEvent.created_at.desc())
    if event_type:
        q = q.filter(LineageEvent.event_type == event_type)
    if requirement_id:
        q = q.filter(LineageEvent.requirement_id == requirement_id)
    if x_trace_id:
        q = q.filter(LineageEvent.x_trace_id == x_trace_id)
    if operations_task_id:
        q = q.filter(LineageEvent.operations_task_id == operations_task_id)
    rows = q.limit(limit).all()
    return {"items": [event_service.serialize_event(r) for r in rows], "total": len(rows)}


@router.get("/dimensions/{dimension}")
def get_dimension(
    dimension: str,
    requirement_id: Optional[str] = Query(default=None),
    x_trace_id: Optional[str] = Query(default=None),
    clip_id: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """4 个 Snowflake 维度：tagging / labeling / checking / mining"""
    try:
        rows = event_service.query_dimension(
            db, dimension,
            requirement_id=requirement_id,
            x_trace_id=x_trace_id,
            clip_id=clip_id,
            limit=limit,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"dimension": dimension, "items": rows, "total": len(rows)}


@router.get("/{event_pk}")
def get_event(event_pk: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    ev = db.query(LineageEvent).filter(LineageEvent.id == event_pk).first()
    if not ev:
        raise HTTPException(status_code=404, detail=f"event not found: {event_pk}")
    return event_service.serialize_event(ev, with_results=True)
