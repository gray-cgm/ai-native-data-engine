"""Lightweight Ops-module routers (Labeling / Tagging / Checking / Mining /
Privacy / Release).

This file exposes a uniform REST surface for six operational modules that
backstop the Web Operations module. Each module shares the same ``OpsItem``
shape and persists to an in-memory store — enough to unblock end-to-end UI
and BFF flows without locking us into a concrete schema.

Routes (per module, prefix ``/api/v1/ops/<module>``)::

    GET    /              — list items (with optional filters)
    POST   /              — create new item
    GET    /{item_id}     — get detail
    PATCH  /{item_id}     — partial update (status, assignee, payload)
    DELETE /{item_id}     — soft delete
    GET    /stats         — simple counters per status

When a proper persistence layer lands, swap ``_InMemoryStore`` for a SQLite /
SQLAlchemy backed adapter without changing the HTTP contract.
"""

from __future__ import annotations

import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field


ModuleKey = Literal[
    'labeling',
    'tagging',
    'checking',
    'mining',
    'privacy',
    'release',
]


# Default status vocabularies per module. Kept permissive — the UI uses these
# purely for filter chips and colouring.
_STATUS_BY_MODULE: dict[ModuleKey, list[str]] = {
    'labeling': ['draft', 'assigned', 'in_progress', 'review', 'done', 'blocked'],
    'tagging': ['draft', 'applied', 'rolled_back'],
    'checking': ['draft', 'running', 'passed', 'failed', 'waived'],
    'mining': ['queued', 'running', 'candidates_ready', 'cancelled', 'failed'],
    'privacy': ['queued', 'processing', 'processed', 'failed'],
    'release': ['drafted', 'gated', 'approved', 'published', 'archived'],
}

# Default "kind" enumerations shown as a secondary dimension in the UI.
_KIND_BY_MODULE: dict[ModuleKey, list[str]] = {
    'labeling': ['human', 'auto', 'hybrid'],
    'tagging': ['manual', 'rule', 'model'],
    'checking': ['gating', 'qc_human', 'qc_auto', 'calibration'],
    'mining': ['hard_case', 'active_learning', 'similarity'],
    'privacy': ['face', 'plate', 'audio', 'multi'],
    'release': ['internal', 'training', 'external'],
}


# ── Schemas ─────────────────────────────────────────────────────────────────

class OpsItem(BaseModel):
    """Unified shape for every ops-module item."""

    model_config = ConfigDict(extra='allow')

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
    payload: dict[str, Any] | None = None


# ── Store ───────────────────────────────────────────────────────────────────

class _InMemoryStore:
    """Per-process in-memory store keyed by (module, id)."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._items: dict[ModuleKey, dict[str, OpsItem]] = {
            key: {} for key in _STATUS_BY_MODULE
        }

    def list(
        self,
        module: ModuleKey,
        *,
        status: str | None = None,
        kind: str | None = None,
        dataset_id: str | None = None,
        scenario: str | None = None,
        requirement_id: str | None = None,
        data_task_id: str | None = None,
        keyword: str | None = None,
    ) -> list[OpsItem]:
        rows = list(self._items[module].values())
        if status:
            rows = [r for r in rows if r.status == status]
        if kind:
            rows = [r for r in rows if r.kind == kind]
        if dataset_id:
            rows = [r for r in rows if r.dataset_id == dataset_id]
        if scenario:
            rows = [r for r in rows if r.scenario == scenario]
        if requirement_id:
            rows = [r for r in rows if r.requirement_id == requirement_id]
        if data_task_id:
            rows = [r for r in rows if r.data_task_id == data_task_id]
        if keyword:
            k = keyword.lower()
            rows = [
                r for r in rows
                if k in r.id.lower()
                or k in r.title.lower()
                or k in (r.owner or '').lower()
                or k in (r.kind or '').lower()
            ]
        rows.sort(key=lambda r: r.updated_at, reverse=True)
        return rows

    def get(self, module: ModuleKey, item_id: str) -> OpsItem | None:
        return self._items[module].get(item_id)

    def create(self, module: ModuleKey, payload: OpsItemCreate) -> OpsItem:
        now = datetime.now(timezone.utc).isoformat()
        default_status = _STATUS_BY_MODULE[module][0]
        item = OpsItem(
            id=f'{module[:3]}-{uuid.uuid4().hex[:10]}',
            module=module,
            title=payload.title,
            status=payload.status or default_status,
            kind=payload.kind,
            owner=payload.owner,
            clip_ids=list(payload.clip_ids),
            dataset_id=payload.dataset_id,
            scenario=payload.scenario,
            requirement_id=payload.requirement_id,
            data_task_id=payload.data_task_id,
            payload=dict(payload.payload),
            created_at=now,
            updated_at=now,
        )
        with self._lock:
            self._items[module][item.id] = item
        return item

    def patch(
        self, module: ModuleKey, item_id: str, payload: OpsItemPatch
    ) -> OpsItem | None:
        with self._lock:
            current = self._items[module].get(item_id)
            if current is None:
                return None
            updates = payload.model_dump(exclude_unset=True)
            updates['updated_at'] = datetime.now(timezone.utc).isoformat()
            merged = current.model_copy(update=updates)
            self._items[module][item_id] = merged
            return merged

    def delete(self, module: ModuleKey, item_id: str) -> bool:
        with self._lock:
            return self._items[module].pop(item_id, None) is not None

    def stats(self, module: ModuleKey) -> dict[str, int]:
        counts: dict[str, int] = {s: 0 for s in _STATUS_BY_MODULE[module]}
        for item in self._items[module].values():
            counts[item.status] = counts.get(item.status, 0) + 1
        counts['total'] = sum(counts.values())
        return counts


_STORE = _InMemoryStore()


# ── Router factory ──────────────────────────────────────────────────────────

def _build_router(module: ModuleKey) -> APIRouter:
    router = APIRouter(prefix=f'/api/v1/ops/{module}', tags=[f'ops:{module}'])

    @router.get('/vocab')
    def vocab() -> dict:
        return {
            'module': module,
            'status_options': _STATUS_BY_MODULE[module],
            'kind_options': _KIND_BY_MODULE[module],
        }

    @router.get('/stats')
    def stats() -> dict:
        return {'module': module, 'counts': _STORE.stats(module)}

    @router.get('')
    def list_items(
        status: str | None = Query(default=None),
        kind: str | None = Query(default=None),
        dataset_id: str | None = Query(default=None),
        scenario: str | None = Query(default=None),
        requirement_id: str | None = Query(default=None),
        data_task_id: str | None = Query(default=None),
        keyword: str | None = Query(default=None),
        limit: int = Query(default=50, ge=1, le=500),
        offset: int = Query(default=0, ge=0),
    ) -> dict:
        rows = _STORE.list(
            module,
            status=status,
            kind=kind,
            dataset_id=dataset_id,
            scenario=scenario,
            requirement_id=requirement_id,
            data_task_id=data_task_id,
            keyword=keyword,
        )
        page = rows[offset : offset + limit]
        return {
            'items': [r.model_dump() for r in page],
            'total': len(rows),
            'limit': limit,
            'offset': offset,
        }

    @router.post('')
    def create_item(body: OpsItemCreate) -> dict:
        item = _STORE.create(module, body)
        return item.model_dump()

    @router.get('/{item_id}')
    def get_item(item_id: str) -> dict:
        item = _STORE.get(module, item_id)
        if item is None:
            raise HTTPException(status_code=404, detail=f'{module}:{item_id} not found')
        return item.model_dump()

    @router.patch('/{item_id}')
    def patch_item(item_id: str, body: OpsItemPatch) -> dict:
        item = _STORE.patch(module, item_id, body)
        if item is None:
            raise HTTPException(status_code=404, detail=f'{module}:{item_id} not found')
        return item.model_dump()

    @router.delete('/{item_id}')
    def delete_item(item_id: str) -> dict:
        ok = _STORE.delete(module, item_id)
        if not ok:
            raise HTTPException(status_code=404, detail=f'{module}:{item_id} not found')
        return {'ok': True}

    return router


# ── Aggregate router (single include_router target) ─────────────────────────

router = APIRouter()
for _module in ('labeling', 'tagging', 'checking', 'mining', 'privacy', 'release'):
    router.include_router(_build_router(_module))  # type: ignore[arg-type]


# Aggregate stats across every module — consumed by the Overview page.
_OVERVIEW_ROUTER = APIRouter(prefix='/api/v1/ops', tags=['ops'])


@_OVERVIEW_ROUTER.get('/overview')
def ops_overview() -> dict:
    """Return per-module counters for the Overview page."""
    return {
        'modules': [
            {'module': m, 'counts': _STORE.stats(m)}
            for m in _STATUS_BY_MODULE
        ]
    }


router.include_router(_OVERVIEW_ROUTER)
