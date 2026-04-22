"""Clip-centric Lance reader.

This module treats a clip directory under ``data/lance/c-<uuid>/`` as the unit
of traversal. It produces typed, UI-friendly structures suitable for both the
CLI demos (``make ingest|query|lance|stream-demo``) and the Platform API
``/clips`` routes.

The on-disk contract is documented in
``docs/architecture/clip-lance-data-model.md``.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import lance
import pyarrow as pa


CLIP_ID_PATTERN = re.compile(r'^c-[0-9a-fA-F-]{8,}$')
META_TABLE = 'meta.lance'
TOPIC_TABLE = 'topic.lance'
WM_TABLE = 'wm.lance'


@dataclass
class CameraIndexColumn:
    """A ``cam*`` struct column discovered inside ``topic.lance``."""

    name: str
    frame_count: int = 0  # number of keyframes that carry a real video frame


@dataclass
class TopicColumn:
    """A ``<TopicName>`` struct column discovered inside ``topic.lance``."""

    name: str
    non_null_count: int = 0


@dataclass
class StandaloneTopic:
    """A ``<TopicName>.lance`` directory sibling of ``topic.lance``."""

    name: str
    path: Path
    row_count: int


@dataclass
class ClipSchema:
    topics: list[TopicColumn] = field(default_factory=list)
    cameras: list[CameraIndexColumn] = field(default_factory=list)
    standalone_topics: list[StandaloneTopic] = field(default_factory=list)
    has_wm: bool = False


@dataclass
class ClipSummary:
    clip_id: str
    path: Path
    keyframe_count: int
    start_time: int | None
    end_time: int | None
    vehicle_name: str | None
    city: str | None
    district: str | None
    scenario: str | None
    tags: str | None
    da_tags: str | None
    schema: ClipSchema


def _is_clip_dir(p: Path) -> bool:
    return (
        p.is_dir()
        and CLIP_ID_PATTERN.match(p.name) is not None
        and (p / TOPIC_TABLE).exists()
    )


def list_clip_ids(lance_root: Path) -> list[str]:
    """Return every clip directory name under ``lance_root`` sorted ascending."""

    if not lance_root.exists():
        return []
    return sorted(p.name for p in lance_root.iterdir() if _is_clip_dir(p))


def clip_path(lance_root: Path, clip_id: str) -> Path:
    path = lance_root / clip_id
    if not _is_clip_dir(path):
        raise FileNotFoundError(f'Clip not found: {clip_id}')
    return path


def load_meta(clip_dir: Path) -> dict[str, Any]:
    """Return the single ``meta.lance`` row as a plain dict.

    ``calibration_info`` is parsed into a dict when it is valid JSON; ``map``
    columns are converted to plain dicts. Missing tables return ``{}``.
    """

    meta_path = clip_dir / META_TABLE
    if not meta_path.exists():
        return {}
    ds = lance.dataset(str(meta_path))
    table = ds.to_table()
    if table.num_rows == 0:
        return {}
    row: dict[str, Any] = {}
    for field_ in table.schema:
        raw = table.column(field_.name)[0].as_py()
        if isinstance(raw, list) and all(
            isinstance(e, tuple) and len(e) == 2 for e in raw
        ):
            raw = dict(raw)
        row[field_.name] = raw
    calib = row.get('calibration_info')
    if isinstance(calib, str):
        try:
            row['calibration_info'] = json.loads(calib)
        except json.JSONDecodeError:
            pass
    return row


def _classify_topic_schema(schema: pa.Schema) -> tuple[list[TopicColumn], list[CameraIndexColumn]]:
    topics: list[TopicColumn] = []
    cams: list[CameraIndexColumn] = []
    for field_ in schema:
        if field_.name == 'timestamp':
            continue
        if not pa.types.is_struct(field_.type):
            continue
        child_names = {f.name for f in field_.type}
        if {'video_frame_timestamp', 'video_frame_index'} <= child_names:
            cams.append(CameraIndexColumn(name=field_.name))
        elif {'timestamp', 'data'} <= child_names:
            topics.append(TopicColumn(name=field_.name))
    return topics, cams


def discover_schema(clip_dir: Path) -> ClipSchema:
    schema = ClipSchema()
    topic_path = clip_dir / TOPIC_TABLE
    if topic_path.exists():
        topic_ds = lance.dataset(str(topic_path))
        topics, cams = _classify_topic_schema(topic_ds.schema)
        # Fill non-null counts by scanning once (small tables).
        cols_needed = [t.name for t in topics] + [c.name for c in cams]
        if cols_needed:
            tbl = topic_ds.to_table(columns=cols_needed)
            for t in topics:
                t.non_null_count = _count_non_null_struct(tbl.column(t.name))
            for c in cams:
                c.frame_count = _count_non_null_field(tbl.column(c.name), 'video_frame_timestamp')
        schema.topics = topics
        schema.cameras = cams
    schema.has_wm = (clip_dir / WM_TABLE).exists()
    for child in sorted(clip_dir.glob('*.lance')):
        name = child.name.removesuffix('.lance')
        if name in {'meta', 'topic', 'wm'}:
            continue
        try:
            ds = lance.dataset(str(child))
            schema.standalone_topics.append(
                StandaloneTopic(name=name, path=child, row_count=ds.count_rows())
            )
        except Exception:  # noqa: BLE001 — tolerate broken child tables
            continue
    return schema


def _count_non_null_struct(col: pa.ChunkedArray) -> int:
    total = 0
    for chunk in col.chunks:
        total += len(chunk) - chunk.null_count
    return total


def _count_non_null_field(col: pa.ChunkedArray, child: str) -> int:
    total = 0
    for chunk in col.chunks:
        child_arr = chunk.field(child)
        total += len(child_arr) - child_arr.null_count
    return total


def load_summary(clip_dir: Path) -> ClipSummary:
    topic_path = clip_dir / TOPIC_TABLE
    if not topic_path.exists():
        raise FileNotFoundError(f'Missing topic.lance under {clip_dir}')
    topic_ds = lance.dataset(str(topic_path))
    meta = load_meta(clip_dir)
    schema = discover_schema(clip_dir)
    return ClipSummary(
        clip_id=clip_dir.name,
        path=clip_dir,
        keyframe_count=topic_ds.count_rows(),
        start_time=_as_int(meta.get('start_time')),
        end_time=_as_int(meta.get('end_time')),
        vehicle_name=meta.get('vehicle_name'),
        city=meta.get('city'),
        district=meta.get('district'),
        scenario=meta.get('scenario'),
        tags=meta.get('tags'),
        da_tags=meta.get('da_tags'),
        schema=schema,
    )


def _as_int(value: Any) -> int | None:
    if isinstance(value, (int, float)):
        return int(value)
    return None


def list_clips(lance_root: Path) -> list[ClipSummary]:
    return [load_summary(lance_root / cid) for cid in list_clip_ids(lance_root)]


def read_topic_frames(
    clip_dir: Path,
    *,
    topic: str | None = None,
    camera: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """Read up to ``limit`` keyframe rows from ``topic.lance``.

    When ``topic`` is provided, returns rows keyed by timestamp plus the topic's
    inner ``timestamp`` and parsed (when possible) ``data`` JSON.

    When ``camera`` is provided, filters to rows where that camera has a real
    ``video_frame_timestamp``.
    """

    topic_ds = lance.dataset(str(clip_dir / TOPIC_TABLE))
    columns = ['timestamp']
    if topic:
        columns.append(topic)
    if camera:
        columns.append(camera)
    # Load all rows for the requested columns, then filter/slice in Python —
    # the clip scale (~hundreds of keyframes) makes this safe.
    tbl = topic_ds.to_table(columns=columns)
    rows = tbl.to_pylist()
    if camera:
        rows = [
            r for r in rows
            if (r.get(camera) or {}).get('video_frame_timestamp') is not None
        ]
    rows = rows[offset : offset + limit]
    for r in rows:
        if topic and r.get(topic):
            data = r[topic].get('data')
            if isinstance(data, str):
                try:
                    r[topic]['data_json'] = json.loads(data)
                except json.JSONDecodeError:
                    r[topic]['data_json'] = None
    return rows


def read_standalone_topic(
    clip_dir: Path, name: str, *, limit: int = 50, offset: int = 0
) -> list[dict[str, Any]]:
    path = clip_dir / f'{name}.lance'
    if not path.exists():
        raise FileNotFoundError(f'Standalone topic not found: {name}')
    ds = lance.dataset(str(path))
    tbl = ds.to_table()
    rows = tbl.to_pylist()[offset : offset + limit]
    for r in rows:
        data = r.get('data')
        if isinstance(data, str):
            try:
                r['data_json'] = json.loads(data)
            except json.JSONDecodeError:
                r['data_json'] = None
    return rows


def iter_aligned_frames(
    clip_dir: Path, camera: str, *, limit: int | None = None
) -> list[dict[str, Any]]:
    """Yield rows ``{timestamp, video_frame_timestamp, video_frame_index}`` for
    every keyframe that carries a real frame on ``camera``.

    Used by the streaming demo and the Web video scrubber.
    """

    topic_ds = lance.dataset(str(clip_dir / TOPIC_TABLE))
    tbl = topic_ds.to_table(columns=['timestamp', camera])
    out: list[dict[str, Any]] = []
    for row in tbl.to_pylist():
        cam = row.get(camera) or {}
        ts = cam.get('video_frame_timestamp')
        if ts is None:
            continue
        out.append(
            {
                'timestamp': row['timestamp'],
                'video_frame_timestamp': ts,
                'video_frame_index': cam.get('video_frame_index'),
            }
        )
        if limit is not None and len(out) >= limit:
            break
    return out


def extract_camera_catalog(meta: dict[str, Any]) -> list[dict[str, Any]]:
    """Collapse ``calibration_info`` + ``mp4_path`` + ``mp4_resize_path`` into a
    single per-camera descriptor list for the UI."""

    calib = meta.get('calibration_info') or {}
    mp4_paths = meta.get('mp4_path') or {}
    mp4_resize = meta.get('mp4_resize_path') or {}
    cameras: list[dict[str, Any]] = []
    for name, info in calib.items():
        if not isinstance(info, dict):
            continue
        props = info.get('properties') or {}
        if props.get('type') and props['type'] != 'Camera':
            continue
        extrinsic = info.get('extrinsic') or {}
        cameras.append(
            {
                'name': name,
                'position': info.get('pos'),
                'ros_topic': info.get('ros_topic'),
                'model': props.get('model'),
                'vendor': props.get('vendor'),
                'width': props.get('width'),
                'height': props.get('height'),
                'hfov': props.get('hfov'),
                'vfov': props.get('vfov'),
                'is_avm': bool(props.get('is_avm')),
                'extrinsic_xyz': [
                    extrinsic.get('x'),
                    extrinsic.get('y'),
                    extrinsic.get('z'),
                ] if extrinsic else None,
                'mp4_path': mp4_paths.get(name),
                'mp4_resize_paths': mp4_resize.get(name) or [],
            }
        )
    cameras.sort(key=lambda c: c['name'])
    return cameras


def local_video_path(data_root: Path, clip_id: str, camera: str) -> Path:
    """Return the expected local (thumbnail) MP4 cache path for a given
    clip+camera. The platform plays the downscaled variant produced from
    ``meta.mp4_resize_path`` so large OSS originals never have to leave the
    cloud; cache them under ``data/raw/thumbnail_video/<clip>/<camera>.mp4``.
    """

    return data_root / 'raw' / 'thumbnail_video' / clip_id / f'{camera}.mp4'
