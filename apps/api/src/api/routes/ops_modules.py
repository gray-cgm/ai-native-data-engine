"""Ops 子模块 REST 路由（labeling / tagging / checking / mining / privacy / release）

历史背景：原先 `_InMemoryStore` 进程内存版本（重启全丢）。本次升级到 SQLAlchemy
持久化（`OpsItem` 表），HTTP 契约保持不变；同时新增 `x_trace_id` / `operations_task_id`
等链路字段，让 demo 跑完后刷新页面也看得见。

每个子模块共享同一张 `ops_items` 表 + 一组开放词表。模块间逻辑差异（status 词、kind 词）
仍由本文件维护，让前端继续用 `/vocab` 自我描述。
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.models.base import OperationsModule
from src.models.ops_item import OpsItem


ModuleKey = Literal[
    "labeling", "tagging", "checking", "mining", "privacy", "release",
]


_STATUS_BY_MODULE: dict[ModuleKey, list[str]] = {
    "labeling": ["draft", "assigned", "in_progress", "review", "done", "blocked"],
    "tagging": ["draft", "applied", "rolled_back"],
    "checking": ["draft", "running", "passed", "failed", "waived"],
    "mining": ["queued", "running", "candidates_ready", "cancelled", "failed"],
    "privacy": ["queued", "processing", "processed", "failed"],
    "release": ["drafted", "gated", "approved", "published", "archived"],
}


_KIND_BY_MODULE: dict[ModuleKey, list[str]] = {
    "labeling": ["human", "auto", "hybrid"],
    "tagging": ["manual", "rule", "model"],
    "checking": ["gating", "qc_human", "qc_auto", "calibration"],
    "mining": ["hard_case", "active_learning", "similarity"],
    "privacy": ["face", "plate", "audio", "multi"],
    "release": ["internal", "training", "external"],
}


_MODULE_TO_ENUM: dict[ModuleKey, OperationsModule] = {
    "labeling": OperationsModule.LABELING,
    "tagging": OperationsModule.TAGGING,
    "checking": OperationsModule.CHECKING,
    "mining": OperationsModule.MINING,
    "privacy": OperationsModule.PRIVACY,
    "release": OperationsModule.RELEASE,
}


# ── Pydantic schemas（HTTP 契约保持向后兼容） ─────────────────────────────


class OpsItemDTO(BaseModel):
    model_config = ConfigDict(extra="allow", from_attributes=True)

    id: str
    module: ModuleKey
    title: str
    status: str
    kind: str | None = None
    owner: str | None = None
    clip_ids: list[str] = Field(default_factory=list)
    dataset_id: str | None = None
    scenario: str | None = None
    requirement_id: str | None = None
    data_task_id: str | None = None
    operations_task_id: str | None = None
    x_trace_id: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    created_at: str
    updated_at: str


class OpsItemCreate(BaseModel):
    title: str
    status: str | None = None
    kind: str | None = None
    owner: str | None = None
    clip_ids: list[str] = Field(default_factory=list)
    dataset_id: str | None = None
    scenario: str | None = None
    requirement_id: str | None = None
    data_task_id: str | None = None
    operations_task_id: str | None = None
    x_trace_id: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class OpsItemPatch(BaseModel):
    title: str | None = None
    status: str | None = None
    kind: str | None = None
    owner: str | None = None
    clip_ids: list[str] | None = None
    dataset_id: str | None = None
    scenario: str | None = None
    requirement_id: str | None = None
    data_task_id: str | None = None
    operations_task_id: str | None = None
    x_trace_id: str | None = None
    payload: dict[str, Any] | None = None


def _to_dto(row: OpsItem) -> OpsItemDTO:
    return OpsItemDTO(
        id=row.id,
        module=row.module.lower() if isinstance(row.module, str) else row.module.value,
        title=row.title,
        status=row.status,
        kind=row.kind,
        owner=row.owner,
        clip_ids=list(row.clip_ids or []),
        dataset_id=row.dataset_id,
        scenario=row.scenario,
        requirement_id=row.requirement_id,
        data_task_id=row.data_task_id,
        operations_task_id=row.operations_task_id,
        x_trace_id=row.x_trace_id,
        payload=dict(row.payload or {}),
        created_at=row.created_at.isoformat() if row.created_at else "",
        updated_at=row.updated_at.isoformat() if row.updated_at else "",
    )


# ── 查询 / 修改的核心实现 ─────────────────────────────────────────────


def _query_items(
    db: Session,
    module: ModuleKey,
    *,
    status: str | None = None,
    kind: str | None = None,
    dataset_id: str | None = None,
    scenario: str | None = None,
    requirement_id: str | None = None,
    data_task_id: str | None = None,
    operations_task_id: str | None = None,
    x_trace_id: str | None = None,
    keyword: str | None = None,
):
    enum_val = _MODULE_TO_ENUM[module]
    q = db.query(OpsItem).filter(
        OpsItem.module == enum_val,
        OpsItem.deleted_at.is_(None),
    )
    if status:
        q = q.filter(OpsItem.status == status)
    if kind:
        q = q.filter(OpsItem.kind == kind)
    if dataset_id:
        q = q.filter(OpsItem.dataset_id == dataset_id)
    if scenario:
        q = q.filter(OpsItem.scenario == scenario)
    if requirement_id:
        q = q.filter(OpsItem.requirement_id == requirement_id)
    if data_task_id:
        q = q.filter(OpsItem.data_task_id == data_task_id)
    if operations_task_id:
        q = q.filter(OpsItem.operations_task_id == operations_task_id)
    if x_trace_id:
        q = q.filter(OpsItem.x_trace_id == x_trace_id)
    if keyword:
        like = f"%{keyword}%"
        q = q.filter(
            (OpsItem.id.ilike(like))
            | (OpsItem.title.ilike(like))
            | (OpsItem.owner.ilike(like))
            | (OpsItem.kind.ilike(like))
        )
    return q.order_by(OpsItem.updated_at.desc())


def _stats(db: Session, module: ModuleKey) -> dict[str, int]:
    counts: dict[str, int] = {s: 0 for s in _STATUS_BY_MODULE[module]}
    rows = (
        db.query(OpsItem.status, OpsItem)
        .filter(OpsItem.module == _MODULE_TO_ENUM[module], OpsItem.deleted_at.is_(None))
    )
    total = 0
    for status, _ in rows:
        counts[status] = counts.get(status, 0) + 1
        total += 1
    counts["total"] = total
    return counts


# ── Router factory ──────────────────────────────────────────────────────


def _build_router(module: ModuleKey) -> APIRouter:
    r = APIRouter(prefix=f"/api/v1/ops/{module}", tags=[f"ops:{module}"])

    @r.get("/vocab")
    def vocab() -> dict:
        return {
            "module": module,
            "status_options": _STATUS_BY_MODULE[module],
            "kind_options": _KIND_BY_MODULE[module],
        }

    @r.get("/stats")
    def stats(db: Session = Depends(get_db)) -> dict:
        return {"module": module, "counts": _stats(db, module)}

    @r.get("")
    def list_items(
        status: str | None = Query(default=None),
        kind: str | None = Query(default=None),
        dataset_id: str | None = Query(default=None),
        scenario: str | None = Query(default=None),
        requirement_id: str | None = Query(default=None),
        data_task_id: str | None = Query(default=None),
        operations_task_id: str | None = Query(default=None),
        x_trace_id: str | None = Query(default=None),
        keyword: str | None = Query(default=None),
        limit: int = Query(default=50, ge=1, le=500),
        offset: int = Query(default=0, ge=0),
        db: Session = Depends(get_db),
    ) -> dict:
        q = _query_items(
            db, module,
            status=status, kind=kind, dataset_id=dataset_id, scenario=scenario,
            requirement_id=requirement_id, data_task_id=data_task_id,
            operations_task_id=operations_task_id, x_trace_id=x_trace_id,
            keyword=keyword,
        )
        total = q.count()
        page = q.offset(offset).limit(limit).all()
        return {
            "items": [_to_dto(r).model_dump() for r in page],
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    @r.post("")
    def create_item(body: OpsItemCreate, db: Session = Depends(get_db)) -> dict:
        default_status = _STATUS_BY_MODULE[module][0]
        item = OpsItem(
            module=_MODULE_TO_ENUM[module],
            title=body.title,
            status=body.status or default_status,
            kind=body.kind,
            owner=body.owner,
            clip_ids=list(body.clip_ids),
            dataset_id=body.dataset_id,
            scenario=body.scenario,
            requirement_id=body.requirement_id,
            data_task_id=body.data_task_id,
            operations_task_id=body.operations_task_id,
            x_trace_id=body.x_trace_id,
            payload=dict(body.payload),
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return _to_dto(item).model_dump()

    @r.get("/{item_id}")
    def get_item(item_id: str, db: Session = Depends(get_db)) -> dict:
        item = db.query(OpsItem).filter(
            OpsItem.id == item_id,
            OpsItem.module == _MODULE_TO_ENUM[module],
            OpsItem.deleted_at.is_(None),
        ).first()
        if item is None:
            raise HTTPException(404, detail=f"{module}:{item_id} not found")
        return _to_dto(item).model_dump()

    @r.patch("/{item_id}")
    def patch_item(
        item_id: str, body: OpsItemPatch, db: Session = Depends(get_db)
    ) -> dict:
        item = db.query(OpsItem).filter(
            OpsItem.id == item_id,
            OpsItem.module == _MODULE_TO_ENUM[module],
            OpsItem.deleted_at.is_(None),
        ).first()
        if item is None:
            raise HTTPException(404, detail=f"{module}:{item_id} not found")
        for field, value in body.model_dump(exclude_unset=True).items():
            setattr(item, field, value)
        db.commit()
        db.refresh(item)
        return _to_dto(item).model_dump()

    @r.delete("/{item_id}")
    def delete_item(item_id: str, db: Session = Depends(get_db)) -> dict:
        item = db.query(OpsItem).filter(
            OpsItem.id == item_id,
            OpsItem.module == _MODULE_TO_ENUM[module],
            OpsItem.deleted_at.is_(None),
        ).first()
        if item is None:
            raise HTTPException(404, detail=f"{module}:{item_id} not found")
        item.deleted_at = datetime.now(timezone.utc)
        db.commit()
        return {"ok": True}

    return r


router = APIRouter()
for _m in ("labeling", "tagging", "checking", "mining", "privacy", "release"):
    router.include_router(_build_router(_m))  # type: ignore[arg-type]


# ── Aggregate Overview ──────────────────────────────────────────────────

_OVERVIEW = APIRouter(prefix="/api/v1/ops", tags=["ops"])


@_OVERVIEW.get("/overview")
def ops_overview(db: Session = Depends(get_db)) -> dict:
    return {
        "modules": [
            {"module": m, "counts": _stats(db, m)}  # type: ignore[arg-type]
            for m in _STATUS_BY_MODULE
        ]
    }


router.include_router(_OVERVIEW)
