from __future__ import annotations

import os
from datetime import UTC, datetime
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import APIRouter

router = APIRouter(tags=['tools'])


TOOL_DEFINITIONS = {
    'dagster': {
        'default_base_url': 'http://127.0.0.1:3001',
        'health_path': '/server_info',
    },
    'superset': {
        'default_base_url': 'http://127.0.0.1:8088',
        'health_path': '/health',
    },
    'jupyter': {
        'default_base_url': 'http://127.0.0.1:8888',
        'health_path': '/api/status',
    },
    # provectus/kafka-ui — observable streaming console (Kafka analogue of Dagster UI).
    'kafka-ui': {
        'default_base_url': 'http://127.0.0.1:8085',
        'health_path': '/actuator/health',
    },
}


def _tool_base_url(tool_id: str) -> str:
    # Hyphens and dots are not legal in env var names, so normalize them to `_`.
    safe_key = tool_id.upper().replace('-', '_').replace('.', '_')
    env_key = f'TOOL_{safe_key}_BASE_URL'
    default_url = TOOL_DEFINITIONS[tool_id]['default_base_url']
    return (os.environ.get(env_key) or default_url).rstrip('/')

@router.get('/tools/{tool_id}/health')
def get_tool_health(tool_id: str) -> dict:
    if tool_id not in TOOL_DEFINITIONS:
        return {
            'tool_id': tool_id,
            'status': 'down',
            'endpoint': '',
            'checked_at': datetime.now(UTC).isoformat(),
            'status_code': None,
            'detail': 'Unknown tool id',
        }

    base_url = _tool_base_url(tool_id)
    health_path = TOOL_DEFINITIONS[tool_id]['health_path']
    endpoint = f"{base_url}{health_path}"
    checked_at = datetime.now(UTC).isoformat()

    request = Request(endpoint, method='GET')

    try:
        with urlopen(request, timeout=2) as response:
            status_code = int(response.status)
            status = 'healthy' if 200 <= status_code < 400 else 'degraded'
            return {
                'tool_id': tool_id,
                'status': status,
                'endpoint': endpoint,
                'checked_at': checked_at,
                'status_code': status_code,
                'detail': None,
            }
    except HTTPError as exc:
        status_code = int(getattr(exc, 'code', 0) or 0)
        return {
            'tool_id': tool_id,
            'status': 'degraded' if status_code else 'down',
            'endpoint': endpoint,
            'checked_at': checked_at,
            'status_code': status_code or None,
            'detail': str(exc),
        }
    except URLError as exc:
        return {
            'tool_id': tool_id,
            'status': 'down',
            'endpoint': endpoint,
            'checked_at': checked_at,
            'status_code': None,
            'detail': str(exc.reason),
        }
    except Exception as exc:  # noqa: BLE001
        return {
            'tool_id': tool_id,
            'status': 'down',
            'endpoint': endpoint,
            'checked_at': checked_at,
            'status_code': None,
            'detail': str(exc),
        }
