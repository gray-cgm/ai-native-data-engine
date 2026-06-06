"""datasets v2 路由 —— 创建 / 切割 / promote / samples。"""

from __future__ import annotations

import pytest


def _new_dataset(client, **kw):
    body = {"name": "ds1", "dataset_type": "customized", "source_type": "csv"}
    body.update(kw)
    return client.post("/api/v1/datasets", json=body)


def test_create_dataset_missing_fields_400(client):
    assert client.post("/api/v1/datasets", json={"name": "x"}).status_code == 400


def test_create_and_get_and_list(client):
    r = _new_dataset(client)
    assert r.status_code == 200
    did = r.json()["id"]
    assert r.json()["allow_train"] is False  # customized 强制 false
    got = client.get(f"/api/v1/datasets/{did}")
    assert got.json()["sample_count"] == 0
    lst = client.get("/api/v1/datasets", params={"dataset_type": "customized"})
    assert lst.json()["total"] == 1


def test_get_dataset_404(client):
    assert client.get("/api/v1/datasets/nope").status_code == 404


def test_cut_clip_and_trace_inheritance(client):
    did = _new_dataset(client).json()["id"]
    r = client.post(
        f"/api/v1/datasets/{did}/cut",
        headers={"X-Trace-Id": "trace_cut_1"},
        json={"clip_id": "c1", "ts_start": 100, "ts_end": 200},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["sample"]["ts"] == 150
    # event 继承 header 的 x_trace_id（未中途新生成）
    assert body["event"]["x_trace_id"] == "trace_cut_1"
    # 幂等：同 ts 再切返回 deduplicated
    again = client.post(
        f"/api/v1/datasets/{did}/cut",
        json={"clip_id": "c1", "ts_start": 100, "ts_end": 200},
    )
    assert again.json()["deduplicated"] is True


def test_cut_clip_missing_fields_400(client):
    did = _new_dataset(client).json()["id"]
    assert client.post(
        f"/api/v1/datasets/{did}/cut", json={"clip_id": "c1"}
    ).status_code == 400


def test_cut_clip_bad_window_400(client):
    did = _new_dataset(client).json()["id"]
    r = client.post(
        f"/api/v1/datasets/{did}/cut",
        json={"clip_id": "c1", "ts_start": 200, "ts_end": 100},
    )
    assert r.status_code == 400


def test_cut_dataset_404(client):
    assert client.post(
        "/api/v1/datasets/nope/cut",
        json={"clip_id": "c1", "ts_start": 1, "ts_end": 2},
    ).status_code == 404


@pytest.mark.parametrize(
    "body",
    [
        {"mode": "flexible", "clip_id": "c2", "ts_start": 0, "ts_end": 40},
        {"mode": "one_to_four", "clip_id": "c2", "clip_start_ts": 0, "clip_end_ts": 40},
        {"mode": "random_sample", "clip_id": "c2", "clip_start_ts": 0, "clip_end_ts": 40, "n": 2, "seed": 1},
    ],
)
def test_add_samples_modes(client, body):
    did = _new_dataset(client).json()["id"]
    r = client.post(f"/api/v1/datasets/{did}/samples", json=body)
    assert r.status_code == 200
    assert r.json()["total"] >= 1


def test_add_samples_unknown_mode_400(client):
    did = _new_dataset(client).json()["id"]
    assert client.post(
        f"/api/v1/datasets/{did}/samples", json={"mode": "bogus"}
    ).status_code == 400


def test_add_samples_missing_field_400(client):
    did = _new_dataset(client).json()["id"]
    # one_to_four 缺 clip_start_ts → KeyError → 400
    assert client.post(
        f"/api/v1/datasets/{did}/samples", json={"mode": "one_to_four", "clip_id": "c"}
    ).status_code == 400


def test_list_samples(client):
    did = _new_dataset(client).json()["id"]
    client.post(
        f"/api/v1/datasets/{did}/cut",
        json={"clip_id": "c9", "ts_start": 10, "ts_end": 30},
    )
    r = client.get(f"/api/v1/datasets/{did}/samples", params={"clip_id": "c9"})
    assert r.status_code == 200
    assert r.json()["total"] == 1


def test_promote_to_official(client):
    did = _new_dataset(client).json()["id"]
    client.post(
        f"/api/v1/datasets/{did}/cut",
        json={"clip_id": "c1", "ts_start": 0, "ts_end": 100},
    )
    r = client.post(
        f"/api/v1/datasets/{did}/promote",
        headers={"X-Trace-Id": "trace_promote_1"},
        json={"name": "ds1_official", "allow_train": True},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["official_dataset"]["dataset_type"] == "official"
    assert body["samples_copied"] == 1
    assert body["event"]["x_trace_id"] == "trace_promote_1"


def test_promote_non_customized_400(client):
    # 直接造一个 official 再 promote → 400
    did = _new_dataset(
        client, dataset_type="official", source_type="tags", tag_expr="t"
    ).json()["id"]
    r = client.post(f"/api/v1/datasets/{did}/promote", json={})
    assert r.status_code == 400


def test_promote_404(client):
    assert client.post("/api/v1/datasets/nope/promote", json={}).status_code == 404
