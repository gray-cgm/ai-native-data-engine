"""``make query`` — pick a clip, run a set of showcase queries against its
Lance tables and print a concise report.

Queries demonstrated:
- Clip summary (vehicle, city, duration, keyframe count).
- First N keyframes with topic payload preview for the densest topic.
- First N frames for each camera with real video frame indices.
- Standalone topic sample (compare native-rate to keyframe-rate).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from pprint import pprint

from adapters import clip_reader


DEFAULT_LANCE_ROOT = Path('data/lance')


def run_query(lance_root: Path = DEFAULT_LANCE_ROOT, clip_id: str | None = None, limit: int = 3) -> dict:
    clip_ids = clip_reader.list_clip_ids(lance_root)
    if not clip_ids:
        return {'error': f'No clips found under {lance_root}'}
    if clip_id is None:
        clip_id = clip_ids[0]
    elif clip_id not in clip_ids:
        return {'error': f'Clip {clip_id} not found', 'available': clip_ids}

    clip_dir = clip_reader.clip_path(lance_root, clip_id)
    summary = clip_reader.load_summary(clip_dir)
    meta = clip_reader.load_meta(clip_dir)
    cameras_catalog = clip_reader.extract_camera_catalog(meta)

    # Pick the topic with the most non-null payloads for the keyframe preview.
    densest_topic = None
    if summary.schema.topics:
        densest_topic = max(summary.schema.topics, key=lambda t: t.non_null_count).name

    report: dict = {
        'clip_id': clip_id,
        'vehicle_name': summary.vehicle_name,
        'city': summary.city,
        'district': summary.district,
        'scenario': summary.scenario,
        'keyframe_count': summary.keyframe_count,
        'duration_seconds': (
            (summary.end_time - summary.start_time) / 1e9
            if summary.start_time and summary.end_time
            else None
        ),
        'topics': [
            {'name': t.name, 'non_null_count': t.non_null_count}
            for t in summary.schema.topics
        ],
        'cameras': [
            {'name': c.name, 'frame_count': c.frame_count}
            for c in summary.schema.cameras
        ],
        'standalone_topics': [
            {'name': t.name, 'row_count': t.row_count}
            for t in summary.schema.standalone_topics
        ],
        'camera_catalog': cameras_catalog,
        'keyframe_preview': clip_reader.read_topic_frames(
            clip_dir, topic=densest_topic, limit=limit
        ),
        'standalone_preview': (
            clip_reader.read_standalone_topic(
                clip_dir, summary.schema.standalone_topics[0].name, limit=limit
            )
            if summary.schema.standalone_topics
            else []
        ),
    }
    for cam in summary.schema.cameras:
        aligned = clip_reader.iter_aligned_frames(clip_dir, cam.name, limit=limit)
        if aligned:
            report.setdefault('camera_frame_preview', {})[cam.name] = aligned
    out_path = Path('data/exports/clip-query-report.json')
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2, default=str), encoding='utf-8')
    return report


if __name__ == '__main__':
    clip_id = sys.argv[1] if len(sys.argv) > 1 else 'c-36e79cfe-7b6e-39c6-ac80-ae34dc04e8f0'
    pprint(run_query(clip_id=clip_id))
