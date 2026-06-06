"""容器/元数据型路由：health / root / catalog / operations / tools / streaming.health。

这些走真实 local-dev RuntimeContainer，但都是只读 sqlite 元数据 + 进程内逻辑，
零外部服务依赖，默认跑。需要 Kafka/对象存储真服务的路径单独打 integration。
"""

from __future__ import annotations


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_root_reports_profile(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["name"] == "ai-native-data-engine-api"
    assert r.json()["profile"] == "local-dev"
    assert "capabilities" in r.json()


def test_operations_listings(client):
    assert "items" in client.get("/tasks").json()
    assert "items" in client.get("/runs").json()
    assert "items" in client.get("/exports").json()


def test_catalog_listings(client):
    assert "items" in client.get("/workspaces").json()
    assert "items" in client.get("/datasets").json()


def test_catalog_dataset_detail_and_versions(client):
    datasets = client.get("/datasets").json()["items"]
    if not datasets:
        import pytest

        pytest.skip("no demo dataset in catalog")
    did = datasets[0].get("dataset_id") or datasets[0].get("id")
    detail = client.get(f"/datasets/{did}")
    assert detail.status_code == 200
    assert "item" in detail.json() and "versions" in detail.json()
    versions = client.get(f"/datasets/{did}/versions")
    assert "items" in versions.json()


def test_tools_unknown_tool(client):
    r = client.get("/tools/unknown-xyz/health")
    assert r.status_code == 200
    assert r.json()["status"] == "down"
    assert r.json()["detail"] == "Unknown tool id"


def test_tools_known_tool_unreachable(client):
    # dagster 默认端口大概率不可达 → down/degraded，但不抛 500
    r = client.get("/tools/dagster/health")
    assert r.status_code == 200
    assert r.json()["tool_id"] == "dagster"
    assert r.json()["status"] in {"down", "degraded", "healthy"}


def test_streaming_health_idle_or_snapshot(client):
    r = client.get("/streaming/health")
    assert r.status_code == 200
    body = r.json()
    assert "broker" in body
    assert "consumer" in body
    assert body["consumer"]["status"] in {"idle", "healthy", "lagging", "degraded", "unknown"}
