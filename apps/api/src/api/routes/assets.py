"""Asset REST API

- POST   /api/v1/assets              登记一个 Asset（raw 或 derived）
- GET    /api/v1/assets              列表（asset_kind / clip_id / requirement_id / x_trace_id 过滤）
- GET    /api/v1/assets/{asset_id}   单条详情

Asset 取代旧 ingest/curate/publish 三段：所有原始与派生数据资产统一登记。
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.models.asset import Asset


router = APIRouter(prefix="/api/v1/assets", tags=["assets"])


def _serialize(a: Asset) -> dict[str, Any]:
    return {
        "id": a.id,
        "name": a.name,
        "asset_kind": a.asset_kind,
        "uri": a.uri,
        "format": a.format,
        "clip_id": a.clip_id,
        "producer_pipeline_run_id": a.producer_pipeline_run_id,
        "producer_event_id": a.producer_event_id,
        "requirement_id": a.requirement_id,
        "x_trace_id": a.x_trace_id,
        "byte_size": a.byte_size,
        "row_count": a.row_count,
        "payload": a.payload,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


@router.post("")
def create_asset(
    body: dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    required = {"name", "asset_kind", "uri"}
    missing = required - set(body.keys())
    if missing:
        raise HTTPException(400, detail=f"missing fields: {sorted(missing)}")
    if body["asset_kind"] not in {"raw", "derived"}:
        raise HTTPException(400, detail="asset_kind must be 'raw' or 'derived'")
    a = Asset(**body)
    db.add(a)
    db.commit()
    return _serialize(a)


@router.get("")
def list_assets(
    asset_kind: Optional[str] = Query(default=None),
    clip_id: Optional[str] = Query(default=None),
    requirement_id: Optional[str] = Query(default=None),
    x_trace_id: Optional[str] = Query(default=None),
    producer_pipeline_run_id: Optional[str] = Query(default=None),
    producer_event_id: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    q = db.query(Asset).order_by(Asset.created_at.desc())
    if asset_kind:
        q = q.filter(Asset.asset_kind == asset_kind)
    if clip_id:
        q = q.filter(Asset.clip_id == clip_id)
    if requirement_id:
        q = q.filter(Asset.requirement_id == requirement_id)
    if x_trace_id:
        q = q.filter(Asset.x_trace_id == x_trace_id)
    if producer_pipeline_run_id:
        q = q.filter(Asset.producer_pipeline_run_id == producer_pipeline_run_id)
    if producer_event_id:
        q = q.filter(Asset.producer_event_id == producer_event_id)
    rows = q.limit(limit).all()
    return {"items": [_serialize(r) for r in rows], "total": len(rows)}


@router.get("/{asset_id}")
def get_asset(asset_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    a = db.query(Asset).filter(Asset.id == asset_id).first()
    if not a:
        raise HTTPException(404, detail=f"asset not found: {asset_id}")
    return _serialize(a)
