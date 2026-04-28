"""Dataset v2 REST API

- POST   /api/v1/datasets                       创建 Dataset
- GET    /api/v1/datasets                       列表（status / dataset_type / requirement_id 过滤）
- GET    /api/v1/datasets/{id}                  详情 + 最近 N 条 sample 摘要
- POST   /api/v1/datasets/{id}/cut              灵活切割（核心入口，Explorer 用）
- POST   /api/v1/datasets/{id}/samples          通用样本写入（支持三策略）
- GET    /api/v1/datasets/{id}/samples          列样本（分页）
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.models.dataset import Dataset, DatasetSample
from src.services import dataset_slice_service as slicer


router = APIRouter(prefix="/api/v1/datasets", tags=["datasets-v2"])


@router.post("")
def create_dataset(
    body: dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    required = {"name", "dataset_type", "source_type"}
    missing = required - set(body.keys())
    if missing:
        raise HTTPException(400, detail=f"missing fields: {sorted(missing)}")
    ds = slicer.create_dataset(db, **body)
    db.commit()
    return slicer.serialize_dataset(ds)


@router.get("")
def list_datasets(
    status: Optional[str] = Query(default=None),
    dataset_type: Optional[str] = Query(default=None),
    requirement_id: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    q = db.query(Dataset).order_by(Dataset.created_at.desc())
    if status:
        q = q.filter(Dataset.status == status)
    if dataset_type:
        q = q.filter(Dataset.dataset_type == dataset_type)
    if requirement_id:
        q = q.filter(Dataset.requirement_id == requirement_id)
    rows = q.limit(limit).all()
    return {"items": [slicer.serialize_dataset(r) for r in rows], "total": len(rows)}


def _require_dataset(db: Session, dataset_id: str) -> Dataset:
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(404, detail=f"dataset not found: {dataset_id}")
    return ds


@router.get("/{dataset_id}")
def get_dataset(dataset_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    ds = _require_dataset(db, dataset_id)
    sample_total = (
        db.query(DatasetSample).filter(DatasetSample.dataset_id == ds.id).count()
    )
    return {
        "item": slicer.serialize_dataset(ds),
        "sample_count": sample_total,
    }


@router.post("/{dataset_id}/cut")
def cut_clip(
    dataset_id: str,
    body: dict[str, Any] = Body(...),
    request: Request = None,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    ds = _require_dataset(db, dataset_id)
    required = {"clip_id", "ts_start", "ts_end"}
    missing = required - set(body.keys())
    if missing:
        raise HTTPException(400, detail=f"missing fields: {sorted(missing)}")

    x_trace_id = (
        request.headers.get("X-Trace-Id") if request is not None else None
    ) or body.get("x_trace_id")

    try:
        result = slicer.flexible_cut(
            db,
            dataset=ds,
            clip_id=str(body["clip_id"]),
            ts_start=int(body["ts_start"]),
            ts_end=int(body["ts_end"]),
            ts_center=body.get("ts_center"),
            range_l=body.get("range_l"),
            range_r=body.get("range_r"),
            requirement_id=body.get("requirement_id"),
            operations_task_id=body.get("operations_task_id"),
            x_trace_id=x_trace_id,
            note=body.get("note"),
        )
    except ValueError as exc:
        raise HTTPException(400, detail=str(exc)) from exc
    db.commit()
    return result


@router.post("/{dataset_id}/samples")
def add_samples(
    dataset_id: str,
    body: dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """通用样本写入路由：通过 ``mode`` 选择策略。

    body 形态：
    - {"mode": "flexible", "clip_id": ..., "ts_start": ..., "ts_end": ...}
    - {"mode": "one_to_four", "clip_id": ..., "clip_start_ts": ..., "clip_end_ts": ...}
    - {"mode": "random_sample", "clip_id": ..., "clip_start_ts": ..., "clip_end_ts": ..., "n": 3}
    """
    ds = _require_dataset(db, dataset_id)
    mode = body.get("mode")
    try:
        if mode == "flexible":
            result = slicer.flexible_cut(
                db,
                dataset=ds,
                clip_id=str(body["clip_id"]),
                ts_start=int(body["ts_start"]),
                ts_end=int(body["ts_end"]),
                ts_center=body.get("ts_center"),
                range_l=body.get("range_l"),
                range_r=body.get("range_r"),
            )
            samples = [result["sample"]] if result.get("sample") else []
        elif mode == "one_to_four":
            samples = slicer.cut_one_to_four(
                db,
                dataset=ds,
                clip_id=str(body["clip_id"]),
                clip_start_ts=int(body["clip_start_ts"]),
                clip_end_ts=int(body["clip_end_ts"]),
            )
        elif mode == "random_sample":
            samples = slicer.random_sample(
                db,
                dataset=ds,
                clip_id=str(body["clip_id"]),
                clip_start_ts=int(body["clip_start_ts"]),
                clip_end_ts=int(body["clip_end_ts"]),
                n=int(body.get("n", 1)),
                seed=body.get("seed"),
            )
        else:
            raise HTTPException(400, detail=f"unknown mode: {mode}")
    except (KeyError, ValueError) as exc:
        raise HTTPException(400, detail=str(exc)) from exc
    db.commit()
    return {"items": samples, "total": len(samples)}


@router.post("/{dataset_id}/promote")
def promote_dataset(
    dataset_id: str,
    body: dict[str, Any] = Body(default_factory=dict),
    request: Request = None,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Operations · Release：把 customized 数据集提级为 official。

    业务规则见 docs/architecture/dataset-snowflake-redesign.md §7.2。
    """
    ds = _require_dataset(db, dataset_id)
    x_trace_id = (
        request.headers.get("X-Trace-Id") if request is not None else None
    ) or body.get("x_trace_id")
    try:
        result = slicer.promote_to_official(
            db,
            customized=ds,
            name=body.get("name"),
            tag_expr=body.get("tag_expr"),
            allow_train=bool(body.get("allow_train", True)),
            requirement_id=body.get("requirement_id"),
            ops_item_id=body.get("ops_item_id"),
            x_trace_id=x_trace_id,
            pipeline_run_id=body.get("pipeline_run_id"),
            created_by=body.get("created_by", "system"),
        )
    except ValueError as exc:
        raise HTTPException(400, detail=str(exc)) from exc
    db.commit()
    return result


@router.get("/{dataset_id}/samples")
def list_samples(
    dataset_id: str,
    clip_id: Optional[str] = Query(default=None),
    training_type: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=2000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    _require_dataset(db, dataset_id)
    q = db.query(DatasetSample).filter(DatasetSample.dataset_id == dataset_id)
    if clip_id:
        q = q.filter(DatasetSample.clip_id == clip_id)
    if training_type:
        q = q.filter(DatasetSample.training_type == training_type)
    total = q.count()
    rows = q.order_by(DatasetSample.created_at.desc()).offset(offset).limit(limit).all()
    return {
        "items": [slicer._serialize_sample(r) for r in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }
