"""labeling 标注保存闭环路由。"""

from __future__ import annotations


def test_save_annotations_missing_clip_400(client):
    assert client.post(
        "/api/v1/ops/labeling/annotations", json={"annotations": []}
    ).status_code == 400


def test_save_annotations_bad_annotations_type_400(client):
    assert client.post(
        "/api/v1/ops/labeling/annotations",
        json={"clip_id": "c1", "annotations": "notalist"},
    ).status_code == 400


def test_save_and_load_annotations_trace_passthrough(client):
    r = client.post(
        "/api/v1/ops/labeling/annotations",
        json={
            "clip_id": "c1",
            "x_trace_id": "trace_lbl_1",
            "image_id": "img-1",
            "annotations": [
                {"uid": "u1", "tool": "RectangleROI", "label": "car", "data": {"x": 1}, "ts": 5},
            ],
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["event"]["event_type"] == "labeling"
    # x_trace_id 透传未被新生成截断
    assert body["event"]["x_trace_id"] == "trace_lbl_1"
    assert len(body["event"]["results"]) == 1

    loaded = client.get("/api/v1/ops/labeling/annotations", params={"clip_id": "c1"})
    assert loaded.status_code == 200
    assert loaded.json()["event"]["results"][0]["clip_id"] == "c1"


def test_save_annotations_unknown_ops_item_404(client):
    r = client.post(
        "/api/v1/ops/labeling/annotations",
        json={
            "clip_id": "c1",
            "ops_item_id": "nope",
            "annotations": [{"uid": "u1", "tool": "t"}],
        },
    )
    assert r.status_code == 404


def test_load_annotations_none(client):
    r = client.get("/api/v1/ops/labeling/annotations", params={"clip_id": "absent"})
    assert r.status_code == 200
    assert r.json()["event"] is None
