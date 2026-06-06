"""Pydantic schemas 校验 + 默认值。"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from src.models.base import Priority, RequirementSource, TaskType, TriggerSource, RunPurpose
from src.schemas.requirement import (
    DataTaskCreate,
    PipelineRunCreate,
    ReconstructionCreate,
    RequirementCreate,
    RequirementDetail,
    SignOffRequest,
)


def test_requirement_create_defaults_and_required():
    rc = RequirementCreate(title="t", source=RequirementSource.DRE, dre_owner="a@x.com")
    assert rc.priority == Priority.MEDIUM
    assert rc.scene_tags is None


def test_requirement_create_missing_required_raises():
    with pytest.raises(ValidationError):
        RequirementCreate(title="t")  # 缺 source / dre_owner


def test_requirement_create_title_maxlength():
    with pytest.raises(ValidationError):
        RequirementCreate(
            title="x" * 257, source=RequirementSource.DRE, dre_owner="a@x.com"
        )


def test_estimated_volume_must_be_non_negative():
    with pytest.raises(ValidationError):
        RequirementCreate(
            title="t",
            source=RequirementSource.DRE,
            dre_owner="a@x.com",
            estimated_data_volume=-1,
        )


def test_data_task_create_defaults():
    dt = DataTaskCreate(requirement_id="r1", title="t", task_type=TaskType.LABELING)
    assert dt.target_count == 0


def test_reconstruction_priority_bounds():
    with pytest.raises(ValidationError):
        ReconstructionCreate(
            data_task_id="d1",
            reconstruction_layer="raw_perception",
            sensor_target="camera",
            priority=6,
        )


def test_pipeline_run_create_trace_defaults():
    p = PipelineRunCreate(
        data_task_id="d1", pipeline_name="p", stage="collect", input_uri="s3://x"
    )
    assert p.trigger_source == TriggerSource.DATA_TASK
    assert p.run_purpose == RunPurpose.INITIAL_BUILD


def test_signoff_request_required():
    s = SignOffRequest(approved=True, sign_off_by="bob")
    assert s.approved is True
    with pytest.raises(ValidationError):
        SignOffRequest(approved=True)  # 缺 sign_off_by


def test_requirement_detail_rebuild_supports_nested_data_tasks():
    # model_rebuild 已解决前向引用：可空列表实例化
    d = RequirementDetail(
        id="r1",
        title="t",
        description=None,
        priority=Priority.LOW,
        source=RequirementSource.PRODUCT,
        status="draft",
        dre_owner="a@x.com",
        feishu_doc_id=None,
        target_scene=None,
        estimated_data_volume=None,
        due_date=None,
        created_at="2026-01-01T00:00:00Z",
        updated_at="2026-01-01T00:00:00Z",
    )
    assert d.data_tasks == []
