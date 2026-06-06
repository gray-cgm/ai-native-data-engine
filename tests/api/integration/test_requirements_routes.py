"""requirements 路由请求级测试。"""

from __future__ import annotations


def _create(client, **kw):
    body = {"title": "需求A", "source": "dre", "dre_owner": "a@x.com"}
    body.update(kw)
    return client.post("/api/v1/requirements", json=body)


def test_create_and_get_requirement(client):
    r = _create(client, priority="high", scene_tags=["夜间"])
    assert r.status_code == 201
    rid = r.json()["id"]
    assert r.json()["status"] == "draft"

    got = client.get(f"/api/v1/requirements/{rid}")
    assert got.status_code == 200
    assert got.json()["title"] == "需求A"
    assert got.json()["data_tasks"] == []


def test_get_requirement_404(client):
    assert client.get("/api/v1/requirements/nope").status_code == 404


def test_list_requirements_filters_and_pagination(client):
    _create(client, title="夜间路口", source="dre", priority="high")
    _create(client, title="雨天高速", source="product", priority="low")
    r = client.get("/api/v1/requirements", params={"source": "dre"})
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    assert body["items"][0]["task_count"] == 0
    # keyword
    r2 = client.get("/api/v1/requirements", params={"keyword": "雨天"})
    assert r2.json()["total"] == 1
    # priority filter
    r3 = client.get("/api/v1/requirements", params={"priority": "low"})
    assert r3.json()["total"] == 1


def test_requirement_stats(client):
    _create(client, source="dre")
    _create(client, source="product")
    r = client.get("/api/v1/requirements/stats")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 2
    assert body["by_source"]["dre"] == 1


def test_update_requirement(client):
    rid = _create(client).json()["id"]
    r = client.patch(f"/api/v1/requirements/{rid}", json={"status": "approved", "title": "改名"})
    assert r.status_code == 200
    assert r.json()["status"] == "approved"
    assert r.json()["title"] == "改名"


def test_update_requirement_404(client):
    assert client.patch("/api/v1/requirements/nope", json={"title": "x"}).status_code == 404
