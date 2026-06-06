"""clips 路由（index + clip detail + 404 + range 解析）。

走真实 ClipCatalogIndex（data/lance 下的 demo clip），只读，默认跑。
若本地无 demo clip（total==0），相关详情断言自动跳过对应分支。
"""

from __future__ import annotations

import pytest

from src.api.routes.clips import _parse_range


def test_parse_range_helper():
    assert _parse_range(None, 100) is None
    assert _parse_range("garbage", 100) is None
    assert _parse_range("bytes=0-49", 100) == (0, 49)
    # 开放右端 → 到文件末尾
    assert _parse_range("bytes=10-", 100) == (10, 99)
    # start 越界 → None
    assert _parse_range("bytes=200-", 100) is None
    # end 截断到 file_size-1
    assert _parse_range("bytes=0-9999", 100) == (0, 99)


def test_list_clips(client):
    r = client.get("/clips", params={"limit": 5})
    assert r.status_code == 200
    body = r.json()
    assert "items" in body and "total" in body
    assert body["limit"] == 5


def test_scenarios_and_datasets(client):
    assert "items" in client.get("/clips/scenarios").json()
    assert "items" in client.get("/clips/datasets").json()


def test_get_clip_detail_or_404(client):
    listing = client.get("/clips", params={"limit": 1}).json()
    if not listing["items"]:
        pytest.skip("no demo clip on disk")
    clip_id = listing["items"][0]["clip_id"]
    r = client.get(f"/clips/{clip_id}")
    assert r.status_code == 200
    assert r.json()["item"]["clip_id"] == clip_id
    assert "camera_catalog" in r.json()


def test_get_unknown_clip_404(client):
    assert client.get("/clips/c-does-not-exist").status_code == 404


def test_frames_unknown_clip_404(client):
    assert client.get("/clips/c-does-not-exist/frames").status_code == 404
