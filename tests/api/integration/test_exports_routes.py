"""exports 路由 —— snapshots / train-runs / usage / contributions。

export_dataset 触发依赖 runtime container 的 table.export（写盘 + catalog），
打 integration mark 并跳过真出仓；其余 DB 型端点默认跑。
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest


@pytest.fixture
def snapshot(db_session):
    from src.models.dataset_snapshot import DatasetSnapshotManifest

    m = DatasetSnapshotManifest(
        x_trace_id="trace_exp_1", scenario="night", title="t", dataset_id="ds1"
    )
    db_session.add(m)
    db_session.commit()
    return m


def test_list_snapshots_and_consumed_filter(client, snapshot):
    assert client.get("/api/v1/exports/snapshots").json()["total"] == 1
    assert client.get("/api/v1/exports/snapshots", params={"consumed": "no"}).json()["total"] == 1
    assert client.get("/api/v1/exports/snapshots", params={"consumed": "yes"}).json()["total"] == 0
    assert client.get("/api/v1/exports/snapshots", params={"dataset_id": "ds1"}).json()["total"] == 1


def test_snapshot_detail_with_train_runs(client, snapshot):
    r = client.get("/api/v1/exports/snapshots/trace_exp_1")
    assert r.status_code == 200
    assert r.json()["train_runs"] == []
    assert client.get("/api/v1/exports/snapshots/nope").status_code == 404


def test_train_run_register_bumps_snapshot_and_lifecycle(client, snapshot):
    r = client.post(
        "/api/v1/exports/train-runs",
        json={"snapshot_ids": ["trace_exp_1"], "consumer": "team-a"},
    )
    assert r.status_code == 201
    run_id = r.json()["id"]
    assert r.json()["x_trace_id"] == "trace_exp_1"
    # snapshot 的 train_run_count 被 +1 → consumed=yes
    assert client.get("/api/v1/exports/snapshots", params={"consumed": "yes"}).json()["total"] == 1

    assert client.get("/api/v1/exports/train-runs", params={"consumer": "team-a"}).json()["total"] == 1
    assert client.get(f"/api/v1/exports/train-runs/{run_id}").status_code == 200

    patched = client.patch(
        f"/api/v1/exports/train-runs/{run_id}", json={"status": "completed"}
    )
    assert patched.json()["status"] == "completed"


def test_train_run_get_404_and_patch_404(client):
    assert client.get("/api/v1/exports/train-runs/nope").status_code == 404
    assert client.patch(
        "/api/v1/exports/train-runs/nope", json={"status": "completed"}
    ).status_code == 404


def test_train_run_register_empty_snapshots_422(client):
    # min_length=1 → 422
    assert client.post(
        "/api/v1/exports/train-runs", json={"snapshot_ids": []}
    ).status_code == 422


def test_usage_ingest_and_list_and_contributions(client, snapshot):
    run_id = client.post(
        "/api/v1/exports/train-runs",
        json={"snapshot_ids": ["trace_exp_1"]},
    ).json()["id"]
    ts = datetime.now(timezone.utc).isoformat()
    r = client.post(
        "/api/v1/exports/usage",
        json={
            "events": [
                {
                    "snapshot_trace": "trace_exp_1",
                    "sample_uid": "ds1:c1:100",
                    "train_run_id": run_id,
                    "loss": 0.8,
                    "epoch": 1,
                    "ts": ts,
                },
                {
                    "snapshot_trace": "trace_exp_1",
                    "sample_uid": "ds1:c1:100",
                    "train_run_id": run_id,
                    "loss": 0.9,
                    "epoch": 2,
                    "ts": ts,
                },
            ]
        },
    )
    assert r.status_code == 202
    assert r.json()["accepted"] == 2
    assert r.json()["snapshots_bumped"] == 1

    usage = client.get("/api/v1/exports/usage", params={"snapshot_trace": "trace_exp_1"})
    assert usage.json()["total"] == 2
    pref = client.get("/api/v1/exports/usage", params={"sample_uid_prefix": "ds1:c1:"})
    assert pref.json()["total"] == 2

    top = client.get("/api/v1/exports/contributions")
    assert top.json()["total"] == 1
    assert top.json()["items"][0]["sample_uid"] == "ds1:c1:100"

    rollup = client.get("/api/v1/exports/contributions/rollup", params={"dataset_id": "ds1"})
    assert rollup.json()["total"] == 1

    detail = client.get("/api/v1/exports/contributions/ds1:c1:100")
    assert detail.json()["consumed_count"] == 2
    assert detail.json()["mean_loss"] is not None


def test_contribution_sample_summary_empty(client):
    r = client.get("/api/v1/exports/contributions/ds:none:1")
    assert r.json()["consumed_count"] == 0


@pytest.mark.integration
def test_export_dataset_requires_runtime_export(client):
    # 触发 dataset 出仓依赖 runtime container 的 table.export（写盘）。
    # 这里仅验证"无 version 的 dataset 早退"分支不需外部资源。
    r = client.post("/api/v1/exports/datasets/unknown-ds")
    assert r.status_code == 200
    assert "error" in r.json()
