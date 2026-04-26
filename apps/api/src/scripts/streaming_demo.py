"""``make stream-demo`` — simulate streaming keyframes out of a clip.

We replay ``topic.lance`` in timestamp order at a configurable rate and emit
one record per keyframe combining:

- the pose-like topic payload (first non-null topic per row),
- the per-camera video_frame_index map,
- the clip id and wall-clock offset,
- a stable ``event_id`` + propagated ``x_trace_id`` / ``requirement_id`` so the
  Kafka consumer can dedup and trace.

Two emission targets are supported via ``STREAMING_DEMO_TARGET``:

- ``file`` (default) — write JSONL to ``data/exports/clip-stream-events.jsonl``.
  Consumable by Dagster / Jupyter notebooks as a stand-in for a live topic.
- ``kafka`` — publish the same records to ``KAFKA_TOPIC_EVENTS`` (default
  ``streaming.events.raw``). Used by ``make stream-demo-kafka``.

Both modes share a single event payload shape, so the orchestrator's Kafka
consumer (`apps/orchestrator/src/streaming/kafka_trigger.py`) and the existing
file-mode workflow stay byte-compatible.
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
import time
import uuid
from pathlib import Path
from pprint import pprint
from typing import Any

import lance

from adapters import clip_reader


DEFAULT_LANCE_ROOT = Path('data/lance')
DEFAULT_OUTPUT = Path('data/exports/clip-stream-events.jsonl')
SUMMARY_PATH = Path('data/exports/clip-stream-summary.json')

KAFKA_TARGET = os.environ.get('STREAMING_DEMO_TARGET', 'file').strip().lower()
KAFKA_BOOTSTRAP = os.environ.get('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092')
KAFKA_TOPIC = os.environ.get('KAFKA_TOPIC_EVENTS', 'streaming.events.raw')


# ─────────────────────────────────────────────────────────────────────────────
# Sinks
# ─────────────────────────────────────────────────────────────────────────────


class _FileSink:
    """Write JSONL events to a local file. Default and offline-friendly."""

    def __init__(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self._path = path
        self._handle = path.open('w', encoding='utf-8')

    def emit(self, event: dict[str, Any]) -> None:
        self._handle.write(json.dumps(event, default=str, ensure_ascii=False) + '\n')

    def close(self) -> dict[str, Any]:
        self._handle.close()
        return {'mode': 'file', 'output_path': str(self._path.resolve())}


class _KafkaSink:
    """Publish events to a Kafka topic with the trace key as the message key.

    Using ``x_trace_id`` as the partition key keeps all events for the same
    trace on the same partition, which guarantees ordering within a trace and
    makes downstream consumer state simpler.
    """

    def __init__(self, bootstrap: str, topic: str) -> None:
        try:
            from kafka import KafkaProducer  # noqa: WPS433
            from kafka.errors import NoBrokersAvailable  # noqa: WPS433
        except ImportError as exc:  # pragma: no cover
            raise SystemExit(
                'kafka-python is required for STREAMING_DEMO_TARGET=kafka. '
                'Run `uv sync` to install dependencies.'
            ) from exc

        try:
            self._producer = KafkaProducer(
                bootstrap_servers=bootstrap,
                value_serializer=lambda v: json.dumps(v, default=str, ensure_ascii=False).encode('utf-8'),
                key_serializer=lambda v: (v or '').encode('utf-8'),
                acks='all',
                retries=3,
                linger_ms=20,
            )
        except NoBrokersAvailable as exc:
            raise SystemExit(
                f'Kafka broker not reachable at {bootstrap}. '
                'Run `make kafka-up && make kafka-topics-init` first.'
            ) from exc
        self._topic = topic
        self._bootstrap = bootstrap
        self._sent = 0

    def emit(self, event: dict[str, Any]) -> None:
        key = event.get('x_trace_id') or event.get('event_id') or ''
        # Header propagation mirrors the trace contract from the ADR.
        headers = []
        if event.get('x_trace_id'):
            headers.append(('x-trace-id', str(event['x_trace_id']).encode('utf-8')))
        if event.get('requirement_id'):
            headers.append(('x-requirement-id', str(event['requirement_id']).encode('utf-8')))
        self._producer.send(self._topic, key=key, value=event, headers=headers)
        self._sent += 1

    def close(self) -> dict[str, Any]:
        self._producer.flush(timeout=10)
        self._producer.close()
        return {
            'mode': 'kafka',
            'bootstrap_servers': self._bootstrap,
            'topic': self._topic,
            'events_published': self._sent,
        }


def _build_sink(output_path: Path):
    if KAFKA_TARGET == 'kafka':
        return _KafkaSink(KAFKA_BOOTSTRAP, KAFKA_TOPIC)
    return _FileSink(output_path)


# ─────────────────────────────────────────────────────────────────────────────
# Event shape
# ─────────────────────────────────────────────────────────────────────────────


def _stable_event_id(clip_id: str, sequence: int, timestamp: int) -> str:
    """Deterministic id so the dedup ledger collapses replays of the same clip."""
    digest = hashlib.sha1(f'{clip_id}|{sequence}|{timestamp}'.encode('utf-8')).hexdigest()
    return f'clip-stream-{digest[:16]}'


def _make_x_trace_id(clip_id: str) -> str:
    """Generate a per-run trace id; ``CLIP_STREAM_TRACE_ID`` overrides for re-tries."""
    override = os.environ.get('CLIP_STREAM_TRACE_ID')
    if override:
        return override
    suffix = uuid.uuid4().hex[:12]
    return f'trace_clipstream_{suffix}'


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────


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

    sink = _build_sink(output_path)
    x_trace_id = _make_x_trace_id(clip_id)
    requirement_id = os.environ.get('CLIP_STREAM_REQUIREMENT_ID')

    t0 = rows[0]['timestamp'] if rows else 0
    emitted = 0
    sleep_s = 1.0 / throttle_hz if throttle_hz > 0 else 0.0

    try:
        for sequence, row in enumerate(rows, start=1):
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
                'event_id': _stable_event_id(clip_id, sequence, row['timestamp']),
                'x_trace_id': x_trace_id,
                'requirement_id': requirement_id,
                'source': 'clip-stream-replay',
                'clip_id': clip_id,
                'sequence': sequence,
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
            sink.emit(event)
            emitted += 1
            if sleep_s:
                time.sleep(sleep_s)
    finally:
        sink_meta = sink.close()

    summary_out: dict[str, Any] = {
        'clip_id': clip_id,
        'x_trace_id': x_trace_id,
        'requirement_id': requirement_id,
        'events_written': emitted,
        'duration_seconds': (
            (rows[-1]['timestamp'] - rows[0]['timestamp']) / 1e9
            if rows
            else 0
        ),
        'topics': topic_names,
        'cameras': camera_names,
    }
    summary_out.update(sink_meta)
    SUMMARY_PATH.parent.mkdir(parents=True, exist_ok=True)
    SUMMARY_PATH.write_text(json.dumps(summary_out, indent=2), encoding='utf-8')
    return summary_out


if __name__ == '__main__':
    clip_id = sys.argv[1] if len(sys.argv) > 1 else None
    pprint(run_clip_stream(clip_id=clip_id))
