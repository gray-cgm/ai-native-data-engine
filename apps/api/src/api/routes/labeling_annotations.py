"""Labeling 标注保存闭环 REST API（labeling 子域）

- POST /api/v1/ops/labeling/annotations   保存一组标注 → labeling event + N label results
- GET  /api/v1/ops/labeling/annotations    取某 clip 最近一次标注（回写 viewport）

注意：本路由必须在通用 ops_modules_router 之前注册，否则 `GET /annotations`
会被 `GET /api/v1/ops/labeling/{item_id}` 抢匹配（item_id="annotations"）。
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.services import event_service, labeling_annotation_service
from src.services.labeling_annotation_service import AnnotationInput


router = APIRouter(prefix="/api/v1/ops/labeling", tags=["ops:labeling"])


@router.post("/annotations")
def save_annotations(
    body: dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    clip_id = body.get("clip_id")
    if not clip_id:
        raise HTTPException(status_code=400, detail="clip_id is required")

    raw = body.get("annotations") or []
    if not isinstance(raw, list):
        raise HTTPException(status_code=400, detail="annotations must be a list")

    annotations = [
        AnnotationInput(
            uid=str(a.get("uid", "")),
            tool=str(a.get("tool", "unknown")),
            label=a.get("label"),
            data=a.get("data"),
            ts=a.get("ts"),
        )
        for a in raw
    ]

    try:
        ev, item = labeling_annotation_service.save_annotations(
            db,
            clip_id=clip_id,
            annotations=annotations,
            ops_item_id=body.get("ops_item_id"),
            operations_task_id=body.get("operations_task_id"),
            requirement_id=body.get("requirement_id"),
            x_trace_id=body.get("x_trace_id"),
            image_id=body.get("image_id"),
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    db.commit()
    return {
        "event": event_service.serialize_event(ev, with_results=True),
        "ops_item": None if item is None else {"id": item.id, "status": item.status},
    }


@router.get("/annotations")
def load_annotations(
    clip_id: str = Query(...),
    x_trace_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    event = labeling_annotation_service.load_latest(
        db, clip_id=clip_id, x_trace_id=x_trace_id
    )
    return {"clip_id": clip_id, "event": event}
