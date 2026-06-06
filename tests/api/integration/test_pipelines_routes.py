"""pipelines.py（数据加工与治理）路由 —— reconstructions / collection / annotation /
pipeline-runs / stats / operations-tasks / trace。"""

from __future__ import annotations

import pytest


@pytest.fixture
def ctx(client):
    req = client.post(
        "/api/v1/requirements",
        json={"title": "需求", "source": "dre", "dre_owner": "a@x.com"},
    ).json()
    dt = client.post(
        "/api/v1/data-tasks",
        json={"requirement_id": req["id"], "title": "t", "task_type": "labeling"},
    ).json()
    return {"req": req, "dt": dt}


# ── reconstructions ──────────────────────────────────────────────────


def test_reconstruction_crud_and_stats(client, ctx):
    r = client.post(
        "/api/v1/reconstructions",
        json={
            "data_task_id": ctx["dt"]["id"],
            "reconstruction_layer": "raw_perception",
            "sensor_target": "camera",
            "priority": 5,
        },
    )
    assert r.status_code == 201
    rid = r.json()["id"]
    assert client.get("/api/v1/reconstructions", params={"data_task_id": ctx["dt"]["id"]}).json()
    assert client.get("/api/v1/reconstructions", params={"layer": "raw_perception"}).json()
    upd = client.patch(
        f"/api/v1/reconstructions/{rid}", json={"coverage_status": "complete"}
    )
    assert upd.json()["coverage_status"] == "complete"
    stats = client.get("/api/v1/reconstructions/coverage-stats")
    assert stats.status_code == 200
    assert "raw_perception" in stats.json()


def test_reconstruction_create_404(client):
    assert client.post(
        "/api/v1/reconstructions",
        json={
            "data_task_id": "nope",
            "reconstruction_layer": "raw_perception",
            "sensor_target": "camera",
        },
    ).status_code == 404


def test_reconstruction_update_404(client):
    assert client.patch(
        "/api/v1/reconstructions/nope", json={"priority": 2}
    ).status_code == 404


# ── collection jobs ──────────────────────────────────────────────────


def test_collection_job_flow(client, ctx):
    r = client.post(
        "/api/v1/collection-jobs",
        json={"data_task_id": ctx["dt"]["id"], "vehicle_id": "v1"},
    )
    assert r.status_code == 201
    jid = r.json()["id"]
    assert client.get("/api/v1/collection-jobs", params={"status": "scheduled"}).json()
    upd = client.patch(
        f"/api/v1/collection-jobs/{jid}", json={"status": "uploaded", "total_frames": 10}
    )
    assert upd.json()["total_frames"] == 10


def test_collection_job_404(client):
    assert client.post(
        "/api/v1/collection-jobs", json={"data_task_id": "nope", "vehicle_id": "v"}
    ).status_code == 404
    assert client.patch(
        "/api/v1/collection-jobs/nope", json={"total_frames": 1}
    ).status_code == 404


# ── annotation tasks ─────────────────────────────────────────────────


def test_annotation_task_flow_and_tpi(client, ctx):
    r = client.post(
        "/api/v1/annotation-tasks",
        json={
            "data_task_id": ctx["dt"]["id"],
            "clip_uri": "data/lance/c1",
            "annotation_type": "bbox_2d",
            "annotation_vendor": "vendorA",
        },
    )
    assert r.status_code == 201
    aid = r.json()["id"]
    client.patch(f"/api/v1/annotation-tasks/{aid}", json={"tpi_score": 1.5, "total_objects": 8})
    assert client.get("/api/v1/annotation-tasks", params={"status": "pending"}).json()
    tpi = client.get("/api/v1/annotation-tasks/tpi-stats")
    assert tpi.status_code == 200
    assert tpi.json()[0]["vendor"] == "vendorA"


def test_annotation_task_404(client):
    assert client.post(
        "/api/v1/annotation-tasks",
        json={"data_task_id": "nope", "clip_uri": "x", "annotation_type": "bbox_2d"},
    ).status_code == 404
    assert client.patch(
        "/api/v1/annotation-tasks/nope", json={"tpi_score": 1.0}
    ).status_code == 404


# ── pipeline runs ────────────────────────────────────────────────────


def test_pipeline_run_create_and_trace_inheritance(client, ctx):
    r = client.post(
        "/api/v1/pipeline-runs",
        json={
            "data_task_id": ctx["dt"]["id"],
            "pipeline_name": "p1",
            "stage": "collect",
            "input_uri": "s3://in",
            "x_trace_id": "trace_pipe_1",
            "requirement_id": ctx["req"]["id"],
            "metrics": {"gate_result": "pass", "cost_usd": 1.5, "cpu_seconds": 10},
        },
    )
    assert r.status_code == 201
    run = r.json()
    assert run["x_trace_id"] == "trace_pipe_1"
    rid = run["id"]

    # 全链路过滤
    by_trace = client.get("/api/v1/pipeline-runs", params={"x_trace_id": "trace_pipe_1"})
    assert len(by_trace.json()) == 1
    # breadcrumb
    bc = client.get(f"/api/v1/pipeline-runs/{rid}")
    assert bc.status_code == 200
    assert bc.json()["run"]["x_trace_id"] == "trace_pipe_1"
    assert bc.json()["requirement"]["id"] == ctx["req"]["id"]
    # update
    upd = client.patch(f"/api/v1/pipeline-runs/{rid}", json={"status": "success"})
    assert upd.json()["status"] == "success"


def test_pipeline_run_create_404(client):
    assert client.post(
        "/api/v1/pipeline-runs",
        json={"data_task_id": "nope", "pipeline_name": "p", "stage": "s", "input_uri": "u"},
    ).status_code == 404


def test_pipeline_run_breadcrumb_404(client):
    assert client.get("/api/v1/pipeline-runs/nope").status_code == 404
    assert client.patch("/api/v1/pipeline-runs/nope", json={"status": "success"}).status_code == 404


def test_pipeline_stats_endpoints(client, ctx):
    # metrics 只能通过 PATCH 写入（PipelineRunCreate schema 不含 metrics）
    rid = client.post(
        "/api/v1/pipeline-runs",
        json={
            "data_task_id": ctx["dt"]["id"],
            "pipeline_name": "p1",
            "stage": "collect",
            "input_uri": "s3://in",
            "requirement_id": ctx["req"]["id"],
            "x_trace_id": "trace_s1",
        },
    ).json()["id"]
    client.patch(
        f"/api/v1/pipeline-runs/{rid}",
        json={
            "metrics": {
                "gate_result": "pass",
                "gate_reason": "ok",
                "cost_usd": 2.0,
                "cpu_seconds": 5,
                "gpu_seconds": 3,
                "storage_gb": 1,
                "duration_s": 9,
            }
        },
    )
    assert client.get("/api/v1/pipeline-stats/stages").json()
    quality = client.get("/api/v1/pipeline-stats/quality").json()
    assert quality["total_runs"] == 1
    assert quality["by_gate_result"]["pass"] == 1
    cost = client.get("/api/v1/pipeline-stats/cost").json()
    assert cost["totals"]["cost_usd"] == 2.0
    assert cost["by_requirement"][0]["title"] == "需求"
    traces = client.get("/api/v1/traces").json()
    assert traces["items"][0]["x_trace_id"] == "trace_s1"


# ── operations tasks ─────────────────────────────────────────────────


def test_operations_task_flow(client, ctx):
    r = client.post(
        "/api/v1/operations-tasks",
        json={
            "requirement_id": ctx["req"]["id"],
            "data_task_id": ctx["dt"]["id"],
            "module": "labeling",
            "title": "标注任务",
            "x_trace_id": "trace_ops_1",
        },
    )
    assert r.status_code == 201
    oid = r.json()["id"]
    assert r.json()["x_trace_id"] == "trace_ops_1"
    assert client.get("/api/v1/operations-tasks", params={"x_trace_id": "trace_ops_1"}).json()
    upd = client.patch(f"/api/v1/operations-tasks/{oid}", json={"status": "running"})
    assert upd.json()["status"] == "running"


def test_operations_task_create_404(client, ctx):
    assert client.post(
        "/api/v1/operations-tasks",
        json={
            "requirement_id": ctx["req"]["id"],
            "data_task_id": "nope",
            "module": "labeling",
            "title": "t",
        },
    ).status_code == 404
    assert client.patch(
        "/api/v1/operations-tasks/nope", json={"status": "running"}
    ).status_code == 404


# ── trace chain ──────────────────────────────────────────────────────


def test_trace_chain_aggregates_all_layers(client, ctx):
    trace = "trace_full_chain"
    # 给 data_task 打 trace
    client.patch(f"/api/v1/data-tasks/{ctx['dt']['id']}", json={})  # noop ensure exists
    client.post(
        "/api/v1/operations-tasks",
        json={
            "requirement_id": ctx["req"]["id"],
            "data_task_id": ctx["dt"]["id"],
            "module": "labeling",
            "title": "t",
            "x_trace_id": trace,
        },
    )
    client.post(
        "/api/v1/pipeline-runs",
        json={
            "data_task_id": ctx["dt"]["id"],
            "pipeline_name": "p",
            "stage": "s",
            "input_uri": "u",
            "requirement_id": ctx["req"]["id"],
            "x_trace_id": trace,
        },
    )
    chain = client.get(f"/api/v1/trace/{trace}").json()
    assert chain["x_trace_id"] == trace
    assert len(chain["operations_tasks"]) == 1
    assert len(chain["pipeline_runs"]) == 1
    assert any(r["id"] == ctx["req"]["id"] for r in chain["requirements"])
