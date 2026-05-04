"""HTTP client + 全局配置。

`configure(base_url=..., token=...)` 之后所有 SDK 调用走同一 client。
没显式 configure 时读环境变量：DLKIT_BASE_URL / DLKIT_TOKEN。
"""

from __future__ import annotations

import os
from typing import Any

import httpx


_DEFAULT_TIMEOUT = 10.0


class Client:
    """thin httpx wrapper —— 故意保持薄，新人不用读底层 httpx 文档也能改。"""

    def __init__(self, base_url: str, token: str | None = None, timeout: float = _DEFAULT_TIMEOUT):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.timeout = timeout
        headers: dict[str, str] = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        self._http = httpx.Client(base_url=self.base_url, headers=headers, timeout=timeout)

    def get(self, path: str, **kwargs: Any) -> dict:
        r = self._http.get(path, **kwargs)
        r.raise_for_status()
        return r.json()

    def post(self, path: str, json: Any = None, **kwargs: Any) -> dict:
        r = self._http.post(path, json=json, **kwargs)
        r.raise_for_status()
        return r.json()

    def patch(self, path: str, json: Any = None, **kwargs: Any) -> dict:
        r = self._http.patch(path, json=json, **kwargs)
        r.raise_for_status()
        return r.json()


_default: Client | None = None


def configure(base_url: str | None = None, token: str | None = None) -> Client:
    """显式或隐式（环境变量）初始化默认 client。"""
    global _default
    base_url = base_url or os.environ.get("DLKIT_BASE_URL", "http://localhost:8000")
    token = token or os.environ.get("DLKIT_TOKEN")
    _default = Client(base_url=base_url, token=token)
    return _default


def get_default_client() -> Client:
    if _default is None:
        configure()
    assert _default is not None
    return _default


def fetch_snapshot(snapshot_trace: str) -> dict:
    """取 export snapshot manifest（含 dataset_id / artifact / clip_ids 等）。"""
    return get_default_client().get(
        f"/api/v1/exports/snapshots/{snapshot_trace}",
    )
