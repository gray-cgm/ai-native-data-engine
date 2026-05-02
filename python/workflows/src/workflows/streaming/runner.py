"""local streaming demo 的对外入口（框架中立）。

历史上这一段位于 ``python/services/__init__.py``。按 layering 文档，
所有进程内调用方（FastAPI route / Dagster asset / CLI）都应直接 import
:func:`run_local_streaming` / :func:`get_local_streaming_summary`，
不再经过单独的 services 包。
"""

from __future__ import annotations

import json
from pathlib import Path
from threading import Lock
from typing import Any

from core.profiles.runtime import RuntimeContainer

from .local_demo import DEFAULT_SUMMARY_PATH, run_local_streaming_demo


_STREAMING_DEMO_LOCK = Lock()


def get_local_streaming_summary(container: RuntimeContainer) -> dict[str, Any] | None:
    summary_path = Path(DEFAULT_SUMMARY_PATH)
    if not container.storage.exists(str(summary_path)):
        return None
    with container.storage.open(str(summary_path), 'r') as handle:
        return json.load(handle)


def run_local_streaming(container: RuntimeContainer) -> dict[str, Any]:
    """跑一次 local streaming demo（含锁，防止并发重写产物）。"""
    with _STREAMING_DEMO_LOCK:
        summary = run_local_streaming_demo(container)
        return {
            'summary': summary,
            'capabilities': container.capabilities.model_dump(),
        }


__all__ = [
    'get_local_streaming_summary',
    'run_local_streaming',
]
