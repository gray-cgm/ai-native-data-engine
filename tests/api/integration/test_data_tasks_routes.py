"""data_tasks + sign-off 路由测试。"""

from __future__ import annotations

import pytest


@pytest.fixture
def req_id(client):
    r = client.post(
        "/api/v1/requirements",
        json={"title": "需求", "source": "dre", "dre_owner": "a@x.com"},
    )
    return r.json()["id"]


def _make_task(client, req_id, **kw):
    body = {"requirement_id": req_id, "title": "采集", "task_type": "collection"}
    body.update(kw)
    return client.post("/api/v1/data-tasks", json=body)


def test_create_data_task(client, req_id):
    r = _make_task(client, req_id, task_type="labeling")
    assert r.status_code == 201
    assert r.json()["sign_off_status"] == "pending"
    assert r.json()["status"] == "draft"


def test_create_data_task_requirement_missing(client):
    r = client.post(
        "/api/v1/data-tasks",
        json={"requirement_id": "nope", "title": "t", "task_type": "collection"},
    )
    assert r.status_code == 404


def test_get_and_list_and_update(client, req_id):
    tid = _make_task(client, req_id).json()["id"]
    assert client.get(f"/api/v1/data-tasks/{tid}").status_code == 200
    assert client.get("/api/v1/data-tasks", params={"requirement_id": req_id}).json()
    lst = client.get("/api/v1/data-tasks", params={"task_type": "collection"})
    assert len(lst.json()) == 1
    upd = client.patch(f"/api/v1/data-tasks/{tid}", json={"actual_count": 5})
    assert upd.json()["actual_count"] == 5


def test_get_update_404(client):
    assert client.get("/api/v1/data-tasks/nope").status_code == 404
    assert client.patch("/api/v1/data-tasks/nope", json={"title": "x"}).status_code == 404


def test_sign_off_approve_then_double_signoff_400(client, req_id):
    tid = _make_task(client, req_id).json()["id"]
    r = client.post(
        f"/api/v1/data-tasks/{tid}/sign-off",
        json={"approved": True, "sign_off_by": "boss", "comment": "ok"},
    )
    assert r.status_code == 200
    assert r.json()["sign_off_status"] == "approved"
    assert r.json()["status"] == "in_progress"
    # 重复审批 400
    again = client.post(
        f"/api/v1/data-tasks/{tid}/sign-off",
        json={"approved": True, "sign_off_by": "boss"},
    )
    assert again.status_code == 400


def test_sign_off_reject_then_reset(client, req_id):
    tid = _make_task(client, req_id).json()["id"]
    client.post(
        f"/api/v1/data-tasks/{tid}/sign-off",
        json={"approved": False, "sign_off_by": "boss"},
    )
    got = client.get(f"/api/v1/data-tasks/{tid}").json()
    assert got["sign_off_status"] == "rejected"
    assert got["status"] == "blocked"
    # reset 仅 rejected 可
    reset = client.post(f"/api/v1/data-tasks/{tid}/reset-sign-off")
    assert reset.status_code == 200
    assert reset.json()["sign_off_status"] == "pending"


def test_reset_signoff_invalid_state_400(client, req_id):
    tid = _make_task(client, req_id).json()["id"]
    # pending 状态不能 reset
    assert client.post(f"/api/v1/data-tasks/{tid}/reset-sign-off").status_code == 400


def test_signoff_404(client):
    assert client.post(
        "/api/v1/data-tasks/nope/sign-off",
        json={"approved": True, "sign_off_by": "b"},
    ).status_code == 404
    assert client.post("/api/v1/data-tasks/nope/reset-sign-off").status_code == 404


def test_batch_sign_off_approves_and_skips(client, req_id):
    # 两个 body 参数（task_ids + payload）→ FastAPI 嵌入式 body
    t1 = _make_task(client, req_id).json()["id"]
    t2 = _make_task(client, req_id).json()["id"]
    # 先单独把 t2 审批掉，触发 batch 里的 skipped 分支
    client.post(
        f"/api/v1/data-tasks/{t2}/sign-off",
        json={"approved": True, "sign_off_by": "boss"},
    )
    r = client.post(
        "/api/v1/data-tasks/batch-sign-off",
        json={
            "task_ids": [t1, t2],
            "payload": {"approved": True, "sign_off_by": "boss"},
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["processed"] == 2
    statuses = {x["id"]: x for x in body["results"]}
    assert statuses[t1]["skipped"] is False
    assert statuses[t2]["skipped"] is True


def test_batch_sign_off_missing_task_404(client, req_id):
    t1 = _make_task(client, req_id).json()["id"]
    resp = client.post(
        "/api/v1/data-tasks/batch-sign-off",
        json={
            "task_ids": [t1, "nope"],
            "payload": {"approved": True, "sign_off_by": "b"},
        },
    )
    assert resp.status_code == 404
