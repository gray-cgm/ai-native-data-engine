"""events / assets / snapshots 路由。"""

from __future__ import annotations


# ── events ───────────────────────────────────────────────────────────


def test_create_event_with_results_and_get(client):
    r = client.post(
        "/api/v1/events",
        json={
            "event_type": "tagging",
            "x_trace_id": "trace_ev_1",
            "requirement_id": None,
            "results": [
                {"clip_id": "c1", "payload_type": "tag", "tags": "night"},
            ],
        },
    )
    assert r.status_code == 200
    ev = r.json()
    assert ev["x_trace_id"] == "trace_ev_1"
    assert len(ev["results"]) == 1
    pk = ev["id"]
    got = client.get(f"/api/v1/events/{pk}")
    assert got.status_code == 200
    assert got.json()["results"][0]["clip_id"] == "c1"


def test_create_event_missing_type_400(client):
    assert client.post("/api/v1/events", json={"results": []}).status_code == 400


def test_get_event_404(client):
    assert client.get("/api/v1/events/nope").status_code == 404


def test_list_events_filter(client):
    client.post(
        "/api/v1/events",
        json={"event_type": "mining", "x_trace_id": "trace_m", "results": []},
    )
    r = client.get("/api/v1/events", params={"event_type": "mining"})
    assert r.json()["total"] == 1
    r2 = client.get("/api/v1/events", params={"x_trace_id": "trace_m"})
    assert r2.json()["total"] == 1


def test_dimension_view_and_unknown_404(client):
    client.post(
        "/api/v1/events",
        json={
            "event_type": "tagging",
            "results": [{"clip_id": "c1", "payload_type": "tag", "tags": "night"}],
        },
    )
    r = client.get("/api/v1/events/dimensions/tagging")
    assert r.status_code == 200
    assert r.json()["total"] == 1
    assert client.get("/api/v1/events/dimensions/bogus").status_code == 404


# ── assets ───────────────────────────────────────────────────────────


def test_asset_create_list_get(client):
    r = client.post(
        "/api/v1/assets",
        json={
            "name": "raw1",
            "asset_kind": "raw",
            "uri": "s3://raw",
            "x_trace_id": "trace_a",
            "clip_id": "c1",
        },
    )
    assert r.status_code == 200
    aid = r.json()["id"]
    assert client.get("/api/v1/assets", params={"asset_kind": "raw"}).json()["total"] == 1
    assert client.get("/api/v1/assets", params={"x_trace_id": "trace_a"}).json()["total"] == 1
    assert client.get("/api/v1/assets", params={"clip_id": "c1"}).json()["total"] == 1
    assert client.get(f"/api/v1/assets/{aid}").json()["name"] == "raw1"


def test_asset_create_missing_fields_400(client):
    assert client.post("/api/v1/assets", json={"name": "x"}).status_code == 400


def test_asset_create_bad_kind_400(client):
    assert client.post(
        "/api/v1/assets", json={"name": "x", "asset_kind": "weird", "uri": "u"}
    ).status_code == 400


def test_asset_get_404(client):
    assert client.get("/api/v1/assets/nope").status_code == 404


# ── snapshots ────────────────────────────────────────────────────────


def test_snapshots_list_empty_and_get_404(client):
    assert client.get("/api/v1/snapshots").json()["total"] == 0
    assert client.get("/api/v1/snapshots/nope").status_code == 404


def test_snapshots_list_and_get(client, db_session):
    from src.models.dataset_snapshot import DatasetSnapshotManifest

    m = DatasetSnapshotManifest(
        x_trace_id="trace_snap_1", scenario="night", title="t"
    )
    db_session.add(m)
    db_session.commit()
    r = client.get("/api/v1/snapshots", params={"scenario": "night"})
    assert r.json()["total"] == 1
    got = client.get("/api/v1/snapshots/trace_snap_1")
    assert got.status_code == 200
    assert got.json()["scenario"] == "night"
