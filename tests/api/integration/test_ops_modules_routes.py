"""ops_modules 工厂路由（6 子模块共享 OpsItem 表）+ overview。"""

from __future__ import annotations

import pytest

MODULES = ["labeling", "tagging", "checking", "mining", "privacy", "release"]


@pytest.mark.parametrize("module", MODULES)
def test_vocab_each_module(client, module):
    r = client.get(f"/api/v1/ops/{module}/vocab")
    assert r.status_code == 200
    assert r.json()["module"] == module
    assert r.json()["status_options"]


def test_create_list_get_patch_delete_flow(client):
    # create
    r = client.post(
        "/api/v1/ops/labeling",
        json={"title": "标注项", "owner": "bob", "clip_ids": ["c1"], "x_trace_id": "trace_op"},
    )
    assert r.status_code == 200
    item = r.json()
    iid = item["id"]
    assert item["status"] == "draft"  # 默认取第一个 status
    assert item["x_trace_id"] == "trace_op"

    # list + filter
    lst = client.get("/api/v1/ops/labeling", params={"x_trace_id": "trace_op"})
    assert lst.json()["total"] == 1
    assert client.get("/api/v1/ops/labeling", params={"keyword": "bob"}).json()["total"] == 1

    # get
    assert client.get(f"/api/v1/ops/labeling/{iid}").json()["id"] == iid

    # patch
    patched = client.patch(f"/api/v1/ops/labeling/{iid}", json={"status": "done"})
    assert patched.json()["status"] == "done"

    # stats
    stats = client.get("/api/v1/ops/labeling/stats").json()
    assert stats["counts"]["done"] == 1
    assert stats["counts"]["total"] == 1

    # delete (soft)
    assert client.delete(f"/api/v1/ops/labeling/{iid}").json()["ok"] is True
    assert client.get(f"/api/v1/ops/labeling/{iid}").status_code == 404


def test_get_patch_delete_404(client):
    assert client.get("/api/v1/ops/mining/nope").status_code == 404
    assert client.patch("/api/v1/ops/mining/nope", json={"status": "x"}).status_code == 404
    assert client.delete("/api/v1/ops/mining/nope").status_code == 404


def test_ops_overview(client):
    client.post("/api/v1/ops/tagging", json={"title": "t1"})
    r = client.get("/api/v1/ops/overview")
    assert r.status_code == 200
    modules = {m["module"]: m for m in r.json()["modules"]}
    assert modules["tagging"]["counts"]["total"] == 1
    assert modules["labeling"]["counts"]["total"] == 0
