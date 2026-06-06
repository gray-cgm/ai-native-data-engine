"""samples 分布 / search-preview + streaming summary 路由。

走真实 demo workflow（scenario triage / local streaming），进程内、零外部 broker。
"""

from __future__ import annotations


def test_sample_distribution(client):
    r = client.get("/samples/distribution")
    assert r.status_code == 200
    assert "distribution" in r.json()
    assert "scenario" in r.json()


def test_search_preview(client):
    r = client.get("/samples/search-preview")
    assert r.status_code == 200
    assert "rows" in r.json()


def test_streaming_summary(client):
    r = client.get("/streaming/summary")
    assert r.status_code == 200
    assert "summary" in r.json()
