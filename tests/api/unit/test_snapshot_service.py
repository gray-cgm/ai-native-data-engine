"""snapshot_service 写入服务（receipt 生命周期）。"""

from __future__ import annotations

import json

from src.services import snapshot_service


def test_open_or_create_is_idempotent(db_session):
    m1 = snapshot_service.open_or_create(
        db_session, x_trace_id="trace_s", requirement_id="r1", clip_ids=["c1"], title="t"
    )
    db_session.commit()
    m2 = snapshot_service.open_or_create(
        db_session, x_trace_id="trace_s", scenario="night"
    )
    db_session.commit()
    assert m1.id == m2.id
    # 未传入的字段不被清空
    assert m2.requirement_id == "r1"
    assert m2.title == "t"
    assert m2.scenario == "night"
    assert m2.clip_ids == ["c1"]


def test_attach_dataset_version_and_export_artifact(db_session, tmp_path, monkeypatch):
    monkeypatch.setattr(snapshot_service, "SNAPSHOT_DIR", tmp_path)
    snapshot_service.open_or_create(db_session, x_trace_id="trace_e")
    db_session.commit()

    dv = snapshot_service.attach_dataset_version(
        db_session, x_trace_id="trace_e", dataset_id="ds1", dataset_version_id="v1"
    )
    assert dv.dataset_version_id == "v1"

    sealed = snapshot_service.attach_export_artifact(
        db_session,
        x_trace_id="trace_e",
        export_job_id="job-1",
        export_artifact_uri="data/exports/x.lance",
        export_format="lance",
    )
    db_session.commit()
    assert sealed.sealed_at is not None
    assert sealed.manifest_json["export_format"] == "lance"
    receipt = tmp_path / "e2e-snapshot-trace_e.json"
    assert receipt.exists()
    assert json.loads(receipt.read_text())["export_job_id"] == "job-1"


def test_attach_on_missing_trace_returns_none(db_session):
    assert snapshot_service.attach_dataset_version(
        db_session, x_trace_id="absent", dataset_id="d", dataset_version_id="v"
    ) is None
    assert snapshot_service.attach_export_artifact(
        db_session,
        x_trace_id="absent",
        export_job_id=None,
        export_artifact_uri="u",
        export_format="csv",
    ) is None


def test_find_trace_by_dataset_version(db_session):
    snapshot_service.open_or_create(db_session, x_trace_id="trace_f")
    db_session.commit()
    snapshot_service.attach_dataset_version(
        db_session, x_trace_id="trace_f", dataset_id="ds", dataset_version_id="ver9"
    )
    db_session.commit()
    assert snapshot_service.find_trace_by_dataset_version(db_session, "ver9") == "trace_f"
    assert snapshot_service.find_trace_by_dataset_version(db_session, "none") is None
