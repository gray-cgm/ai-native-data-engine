"""``make lance`` — inspect clip-level Lance directories end-to-end.

Dumps schema and row counts for every ``*.lance`` table under each clip so that
operators can quickly sanity-check ingestion output and the on-disk contract
described in ``docs/architecture/clip-lance-data-model.md``.
"""

from __future__ import annotations

import sys
from pathlib import Path
from pprint import pprint

import lance

from adapters import clip_reader


DEFAULT_LANCE_ROOT = Path('data/lance')


def _describe_table(path: Path) -> dict:
    ds = lance.dataset(str(path))
    return {
        'path': str(path),
        'row_count': ds.count_rows(),
        'schema': [
            {'name': f.name, 'type': str(f.type)}
            for f in ds.schema
        ],
    }


def inspect_clips(lance_root: Path = DEFAULT_LANCE_ROOT, clip_id: str | None = None) -> dict:
    clip_ids = clip_reader.list_clip_ids(lance_root)
    if not clip_ids:
        return {'error': f'No clips found under {lance_root}'}
    if clip_id is not None and clip_id not in clip_ids:
        return {'error': f'Clip {clip_id} not found', 'available': clip_ids}

    targets = [clip_id] if clip_id else clip_ids
    clips: list[dict] = []
    for cid in targets:
        clip_dir = clip_reader.clip_path(lance_root, cid)
        summary = clip_reader.load_summary(clip_dir)
        tables = []
        for child in sorted(clip_dir.glob('*.lance')):
            try:
                tables.append(_describe_table(child))
            except Exception as exc:  # noqa: BLE001 — report and continue
                tables.append({'path': str(child), 'error': str(exc)})
        clips.append(
            {
                'clip_id': cid,
                'keyframe_count': summary.keyframe_count,
                'vehicle_name': summary.vehicle_name,
                'city': summary.city,
                'scenario': summary.scenario,
                'tables': tables,
            }
        )
    return {'lance_root': str(lance_root.resolve()), 'clips': clips}


if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else None
    pprint(inspect_clips(clip_id=target), width=120)
