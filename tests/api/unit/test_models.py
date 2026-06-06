"""ORM 关系 / 默认值 / 枚举（不接框架，纯 sqlalchemy）。"""

from __future__ import annotations

from datetime import datetime, timezone

from src.models.asset import Asset, AssetKind
from src.models.base import (
    OperationsModule,
    Priority,
    RequirementSource,
    TaskStatus,
    TaskType,
)
from src.models.clip_tag import ClipTag, TagSource
from src.models.dataset import Dataset, DatasetSample
from src.models.requirement import DataTask, Requirement


def test_requirement_defaults_persist(db_session):
    r = Requirement(title="t", source=RequirementSource.DRE, dre_owner="a@x.com")
    db_session.add(r)
    db_session.commit()
    db_session.refresh(r)
    assert r.id and len(r.id) == 36  # uuid
    assert r.priority == Priority.MEDIUM
    assert r.status == "draft"
    assert r.created_at is not None
    assert r.updated_at is not None


def test_requirement_datatask_relationship_and_cascade(db_session):
    r = Requirement(title="t", source=RequirementSource.DRE, dre_owner="a@x.com")
    db_session.add(r)
    db_session.flush()
    dt = DataTask(requirement_id=r.id, title="dt", task_type=TaskType.COLLECTION)
    db_session.add(dt)
    db_session.commit()
    db_session.refresh(r)
    assert len(r.data_tasks) == 1
    assert r.data_tasks[0].status == TaskStatus.DRAFT
    assert dt.requirement is r
    # delete-orphan cascade
    db_session.delete(r)
    db_session.commit()
    assert db_session.query(DataTask).count() == 0


def test_dataset_sample_unique_constraint_and_relationship(db_session):
    ds = Dataset(
        name="ds1",
        dataset_type="customized",
        source_type="csv",
        slice_strategy="flexible",
        ts_policy="read_from_csv",
    )
    db_session.add(ds)
    db_session.flush()
    s = DatasetSample(
        dataset_id=ds.id, clip_id="c1", ts=100, ts_origin="flexible"
    )
    db_session.add(s)
    db_session.commit()
    assert s.range_l == -1 and s.range_r == 3
    assert s.training_type == "train"
    db_session.refresh(ds)
    assert ds.samples[0].clip_id == "c1"


def test_asset_kind_enum(db_session):
    a = Asset(name="raw1", asset_kind=AssetKind.RAW, uri="s3://x")
    db_session.add(a)
    db_session.commit()
    db_session.refresh(a)
    assert a.asset_kind == AssetKind.RAW


def test_clip_tag_persist_with_trace(db_session):
    tag = ClipTag(
        clip_id="c1",
        name="scene-night",
        source=TagSource.AUTO_TAGGING,
        source_version="auto-tagger@v3.2",
        confidence=0.9,
        applied_at=datetime.now(timezone.utc),
        x_trace_id="trace_x",
    )
    db_session.add(tag)
    db_session.commit()
    db_session.refresh(tag)
    assert tag.x_trace_id == "trace_x"
    assert tag.source == TagSource.AUTO_TAGGING


def test_enums_value_mapping():
    assert TaskType.LABELING.value == "labeling"
    assert OperationsModule.RELEASE.value == "release"
    # 已删枚举不应存在
    assert not hasattr(TaskType, "ANNOTATION")
    assert not hasattr(TaskType, "QUALITY_CHECK")
    assert not hasattr(TaskType, "PIPELINE")
