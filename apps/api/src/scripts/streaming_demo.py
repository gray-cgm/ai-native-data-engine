"""``make stream-demo`` — simulate streaming keyframes out of a clip.

We replay ``topic.lance`` in timestamp order at a configurable rate and emit
one JSONL record per keyframe combining:
- the pose-like topic payload (first non-null topic per row),
- the per-camera video_frame_index map,
- the clip id and wall-clock offset.

The output file is consumable by Dagster / Jupyter notebooks as a stand-in for
a live Kafka topic.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from pprint import pprint

import lance

from adapters import clip_reader


DEFAULT_LANCE_ROOT = Path('data/lance')
DEFAULT_OUTPUT = Path('data/exports/clip-stream-events.jsonl')


def run_clip_stream(
    lance_root: Path = DEFAULT_LANCE_ROOT,
    clip_id: str | None = None,
    output_path: Path = DEFAULT_OUTPUT,
    max_events: int = 50,
    throttle_hz: float = 0.0,
) -> dict:
    clip_ids = clip_reader.list_clip_ids(lance_root)
    if not clip_ids:
        return {'error': f'No clips found under {lance_root}'}
    if clip_id is None:
        clip_id = clip_ids[0]
    if clip_id not in clip_ids:
        return {'error': f'Clip {clip_id} not found', 'available': clip_ids}

    clip_dir = clip_reader.clip_path(lance_root, clip_id)
    summary = clip_reader.load_summary(clip_dir)
    topic_names = [t.name for t in summary.schema.topics]
    camera_names = [c.name for c in summary.schema.cameras]

    ds = lance.dataset(str(clip_dir / 'topic.lance'))
    tbl = ds.to_table(columns=['timestamp', *topic_names, *camera_names])
    rows = tbl.to_pylist()
    rows.sort(key=lambda r: r['timestamp'])
    if max_events:
        rows = rows[:max_events]

    output_path.parent.mkdir(parents=True, exist_ok=True)
    t0 = rows[0]['timestamp'] if rows else 0
    emitted = 0
    sleep_s = 1.0 / throttle_hz if throttle_hz > 0 else 0.0
    with output_path.open('w', encoding='utf-8') as fh:
        for row in rows:
            topic_payload = None
            topic_name = None
            for t in topic_names:
                if row.get(t):
                    topic_name = t
                    topic_payload = row[t]
                    break
            cameras = {
                name: {
                    'video_frame_timestamp': (row.get(name) or {}).get('video_frame_timestamp'),
                    'video_frame_index': (row.get(name) or {}).get('video_frame_index'),
                }
                for name in camera_names
            }
            event = {
                'clip_id': clip_id,
                'timestamp': row['timestamp'],
                'offset_ns': row['timestamp'] - t0,
                'topic_name': topic_name,
                'topic_timestamp': (topic_payload or {}).get('timestamp'),
                'topic_payload_preview': (
                    (topic_payload or {}).get('data', '')[:200]
                    if topic_payload
                    else None
                ),
                'cameras': cameras,
            }
            fh.write(json.dumps(event, default=str) + '\n')
            emitted += 1
            if sleep_s:
                time.sleep(sleep_s)

    summary_out = {
        'clip_id': clip_id,
        'events_written': emitted,
        'output_path': str(output_path.resolve()),
        'duration_seconds': (
            (rows[-1]['timestamp'] - rows[0]['timestamp']) / 1e9
            if rows
            else 0
        ),
        'topics': topic_names,
        'cameras': camera_names,
    }
    Path('data/exports/clip-stream-summary.json').write_text(
        json.dumps(summary_out, indent=2), encoding='utf-8'
    )
    return summary_out


if __name__ == '__main__':
    clip_id = sys.argv[1] if len(sys.argv) > 1 else None
    pprint(run_clip_stream(clip_id=clip_id))
