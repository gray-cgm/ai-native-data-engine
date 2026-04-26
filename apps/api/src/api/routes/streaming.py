from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter

from services import get_local_streaming_summary, run_local_streaming
from src.core.runtime import get_runtime_container

router = APIRouter(prefix='/streaming', tags=['streaming'])


def _project_root() -> Path:
    # Anchor relative paths to the monorepo root (marker: pnpm-workspace.yaml),
    # not to the API process cwd. Without this, the consumer (launched from
    # apps/orchestrator/) and the API (launched from repo root) write/read
    # different files and the Overview tab perpetually shows "consumer idle".
    here = Path(__file__).resolve()
    for parent in (here, *here.parents):
        if (parent / 'pnpm-workspace.yaml').exists():
            return parent
    return Path.cwd()


_override = os.environ.get('STREAMING_LAG_PATH')
_LAG_SNAPSHOT_PATH = (
    Path(_override).expanduser() if _override
    else _project_root() / 'data' / 'streaming' / 'kafka_lag.json'
)


@router.post('/bootstrap')
def bootstrap_streaming_demo() -> dict:
    container = get_runtime_container()
    return run_local_streaming(container)


@router.get('/summary')
def get_streaming_summary() -> dict:
    container = get_runtime_container()
    summary = get_local_streaming_summary(container)
    if summary is None:
        summary = run_local_streaming(container)['summary']
    return {'summary': summary}


@router.get('/health')
def get_streaming_health() -> dict:
    """Aggregate streaming health for the Pipelines Overview tab.

    Combines three signals:
      - **broker**: bootstrap/topic config + reachability hint (the BFF probes
        the kafka-ui ``/actuator/health`` endpoint and merges the result).
      - **consumer**: counters + per-partition lag snapshot written by the
        Kafka consumer (`apps/orchestrator/src/streaming/kafka_trigger.py`).
        Falls back to ``status: idle`` when the consumer hasn't started yet.
      - **summary**: the same StreamingSummary used by ``/streaming/summary``,
        so the Overview can show batch counts + lag side by side.
    """
    container = get_runtime_container()
    summary = get_local_streaming_summary(container)

    consumer_state: dict
    if _LAG_SNAPSHOT_PATH.exists():
        try:
            consumer_state = json.loads(_LAG_SNAPSHOT_PATH.read_text())
        except (OSError, ValueError) as exc:
            consumer_state = {
                'status': 'unknown',
                'detail': f'failed to read lag snapshot: {exc}',
            }
        else:
            counters = consumer_state.get('counters') or {}
            total_lag = consumer_state.get('total_lag', 0)
            if counters.get('parse_errors', 0) or counters.get('process_errors', 0) or counters.get('dlq', 0):
                consumer_state['status'] = 'degraded'
            elif total_lag > 0:
                consumer_state['status'] = 'lagging'
            else:
                consumer_state['status'] = 'healthy'
    else:
        consumer_state = {
            'status': 'idle',
            'detail': (
                'No consumer snapshot found yet. Start the consumer with '
                '`make stream-kafka-consumer` once kafka is running.'
            ),
        }

    broker_info = {
        'bootstrap_servers': os.environ.get('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092'),
        'topic_events': os.environ.get('KAFKA_TOPIC_EVENTS', 'streaming.events.raw'),
        'topic_dlq': os.environ.get('KAFKA_TOPIC_DLQ', 'streaming.events.dlq'),
        'consumer_group': os.environ.get('KAFKA_CONSUMER_GROUP', 'ad-loop-streaming-consumer'),
    }

    return {
        'checked_at': datetime.now(UTC).isoformat(),
        'broker': broker_info,
        'consumer': consumer_state,
        'summary': summary,
    }