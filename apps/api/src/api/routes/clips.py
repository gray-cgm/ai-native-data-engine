"""Clip-centric REST routes backed by ``adapters.clip_reader`` +
``adapters.catalog.ClipCatalogIndex``.

The Web Explorer reaches these endpoints (through the BFF) to render clip list,
clip detail, topic previews, camera catalog and streaming video.

List and point-query endpoints (``GET /clips``, ``GET /clips/{id}``,
``GET /clips/scenarios``, ``GET /clips/datasets``) are served from a
SQLite catalog index that is kept in sync with ``data/lance/`` via per-clip
mtime checks, so the API no longer rescans every Lance file on every request.
"""

from __future__ import annotations

import asyncio
import json
import re
from pathlib import Path
from threading import Lock

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse, Response, StreamingResponse

from adapters import clip_reader
from adapters.catalog import ClipCatalogIndex
from core.domain.models import ClipCatalogQuery
from src.core.runtime import get_runtime_container


router = APIRouter(prefix='/clips', tags=['clips'])


LANCE_ROOT = Path('data/lance')
DATA_ROOT = Path('data')
INDEX_PATH = Path('data/metadata/clip_catalog.sqlite')


# ── index singleton ─────────────────────────────────────────────────────────

_INDEX: ClipCatalogIndex | None = None
_INDEX_LOCK = Lock()


def _index() -> ClipCatalogIndex:
    global _INDEX
    if _INDEX is None:
        with _INDEX_LOCK:
            if _INDEX is None:
                _INDEX = ClipCatalogIndex(db_path=INDEX_PATH, lance_root=LANCE_ROOT)
    return _INDEX


def _require_clip(clip_id: str) -> Path:
    try:
        return clip_reader.clip_path(LANCE_ROOT, clip_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


# ── list / point-query (index-backed) ───────────────────────────────────────

@router.get('')
def list_clips(
    scenario: str | None = Query(default=None, description="Exact scenario match; use 'unassigned' for empty scenario"),
    vehicle_name: str | None = Query(default=None),
    city: str | None = Query(default=None),
    district: str | None = Query(default=None),
    tag: list[str] = Query(default=[], description='AND-matched tag values'),
    da_tag: list[str] = Query(default=[], description='AND-matched da_tag values'),
    has_wm: bool | None = Query(default=None),
    start_after: int | None = Query(default=None),
    start_before: int | None = Query(default=None),
    keyword: str | None = Query(default=None, description='Substring over clip_id/vehicle/city/district/scenario/tags'),
    clip_id: list[str] = Query(default=[], description='Batch point-query'),
    sort: str = Query(default='start_time_desc'),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict:
    query = ClipCatalogQuery(
        scenario=scenario,
        vehicle_name=vehicle_name,
        city=city,
        district=district,
        tags=list(tag),
        da_tags=list(da_tag),
        has_wm=has_wm,
        start_after=start_after,
        start_before=start_before,
        keyword=keyword,
        clip_ids=list(clip_id),
        sort=sort,  # type: ignore[arg-type]
        limit=limit,
        offset=offset,
    )
    page = _index().query(query)
    return {
        'items': [s.model_dump() for s in page.items],
        'total': page.total,
        'limit': page.limit,
        'offset': page.offset,
    }


@router.get('/scenarios')
def list_scenarios() -> dict:
    """Scenario aggregate for Catalog / filter suggestions."""
    return {'items': [s.model_dump() for s in _index().scenarios()]}


@router.get('/datasets')
def list_clip_datasets() -> dict:
    """Scenario-grouped virtual dataset list consumed by Catalog."""
    return {'items': [d.model_dump() for d in _index().datasets()]}


@router.post('/refresh')
def refresh_index(full: bool = Query(default=False)) -> dict:
    """Force the catalog index to re-scan. ``full=true`` also prunes rows for
    clips that no longer exist under ``data/lance/``."""
    return _index().refresh(full=full)


@router.get('/{clip_id}')
def get_clip(clip_id: str) -> dict:
    got = _index().get(clip_id)
    if got is None:
        # Fall back to disk to produce a 404 consistent with legacy behaviour.
        _require_clip(clip_id)
        raise HTTPException(status_code=404, detail=f'Clip not indexed: {clip_id}')
    summary, meta = got
    # Camera catalog is derived from calibration_info; compute on demand rather
    # than bloating the index blob. load_meta is cheap for a single clip.
    clip_dir = _require_clip(clip_id)
    raw_meta = clip_reader.load_meta(clip_dir)
    camera_catalog = clip_reader.extract_camera_catalog(raw_meta)
    for cam in camera_catalog:
        cam['has_local_video'] = clip_reader.local_video_path(
            DATA_ROOT, clip_id, cam['name']
        ).exists()
    return {
        'item': summary.model_dump(),
        'meta': {
            'vehicle_name': meta.get('vehicle_name'),
            'vehicle_model': meta.get('vehicle_model'),
            'vehicle_info': meta.get('vehicle_info'),
            'city': meta.get('city'),
            'district': meta.get('district'),
            'scenario': meta.get('scenario'),
            'tags': meta.get('tags'),
            'da_tags': meta.get('da_tags'),
            'jira_id': meta.get('jira_id'),
            'start_time': meta.get('start_time'),
            'end_time': meta.get('end_time'),
            'calibration_version': meta.get('calibration_version'),
        },
        'camera_catalog': camera_catalog,
    }


@router.get('/{clip_id}/frames')
def get_frames(
    clip_id: str,
    topic: str | None = Query(default=None),
    camera: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict:
    clip_dir = _require_clip(clip_id)
    try:
        rows = clip_reader.read_topic_frames(
            clip_dir, topic=topic, camera=camera, limit=limit, offset=offset
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {'items': rows, 'limit': limit, 'offset': offset}


@router.get('/{clip_id}/standalone/{name}')
def get_standalone_topic(
    clip_id: str,
    name: str,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict:
    clip_dir = _require_clip(clip_id)
    try:
        rows = clip_reader.read_standalone_topic(
            clip_dir, name, limit=limit, offset=offset
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {'items': rows, 'limit': limit, 'offset': offset}


@router.get('/{clip_id}/cameras/{camera}/aligned')
def get_aligned_frames(
    clip_id: str,
    camera: str,
    limit: int = Query(default=200, ge=1, le=5000),
) -> dict:
    clip_dir = _require_clip(clip_id)
    rows = clip_reader.iter_aligned_frames(clip_dir, camera, limit=limit)
    return {'items': rows, 'camera': camera}


# ── Video playback ────────────────────────────────────────────────────────────

_CONTENT_RANGE_RE = re.compile(r'^bytes=(\d+)-(\d*)$')


def _parse_range(header: str | None, file_size: int) -> tuple[int, int] | None:
    if not header:
        return None
    m = _CONTENT_RANGE_RE.match(header.strip())
    if not m:
        return None
    start = int(m.group(1))
    end = int(m.group(2)) if m.group(2) else file_size - 1
    if start >= file_size:
        return None
    end = min(end, file_size - 1)
    return start, end


@router.get('/{clip_id}/cameras/{camera}/video')
def stream_video(clip_id: str, camera: str, request: Request):
    clip_dir = _require_clip(clip_id)
    meta = clip_reader.load_meta(clip_dir)
    mp4_paths = meta.get('mp4_path') or {}
    if camera not in mp4_paths:
        raise HTTPException(status_code=404, detail=f'Camera {camera} has no mp4 mapping')
    local_path = clip_reader.local_video_path(DATA_ROOT, clip_id, camera)
    if not local_path.exists():
        # Tell caller we only have the remote URI; UI renders a placeholder.
        return Response(
            status_code=409,
            content=json.dumps(
                {
                    'detail': 'Video not cached locally',
                    'camera': camera,
                    'clip_id': clip_id,
                    'remote_uri': mp4_paths[camera],
                    'expected_local_path': str(local_path),
                }
            ),
            media_type='application/json',
        )
    # Byte streaming goes through the StorageAdapter so the same range path
    # serves local-fs and (OpenDAL) object-backed clips unchanged: seek() over an
    # OpenDAL Reader issues an HTTP Range request under the hood.
    storage = get_runtime_container().storage
    video_uri = str(local_path)
    file_size = storage.size(video_uri)
    range_ = _parse_range(request.headers.get('range'), file_size)
    if range_ is None:
        return FileResponse(
            str(local_path), media_type='video/mp4', filename=f'{camera}.mp4'
        )
    start, end = range_
    length = end - start + 1

    def iter_chunk(chunk_size: int = 1024 * 1024):
        with storage.open(video_uri, 'rb') as fh:
            fh.seek(start)
            remaining = length
            while remaining > 0:
                buf = fh.read(min(chunk_size, remaining))
                if not buf:
                    break
                remaining -= len(buf)
                yield buf

    headers = {
        'Content-Range': f'bytes {start}-{end}/{file_size}',
        'Accept-Ranges': 'bytes',
        'Content-Length': str(length),
    }
    return StreamingResponse(
        iter_chunk(), status_code=206, media_type='video/mp4', headers=headers
    )
