"""services 层纯逻辑（无需 DB 或仅需内存 session）。"""

from __future__ import annotations

import random

import pytest

from src.services import dataset_slice_service as slicer
from src.services import contribution_service as contrib
from src.services import event_service


def test_infer_strategy_branches():
    assert slicer._infer_strategy("tags", "official") == ("one_to_four", "compute_1to4")
    assert slicer._infer_strategy("tags", "customized") == ("flexible", "parse_from_tag")
    assert slicer._infer_strategy("csv", "customized") == ("flexible", "read_from_csv")
    assert slicer._infer_strategy("other", "customized") == ("no_ts", "none")


def test_random_split_distribution_buckets():
    # 固定种子的 rng，覆盖三个分支
    assert slicer._random_split(random.Random(1)) in {"train", "test", "holdout"}
    seen = {slicer._random_split(random.Random(s)) for s in range(50)}
    assert seen == {"train", "test", "holdout"}


def test_split_sample_uid():
    assert contrib._split_sample_uid("ds:clip:123") == ("ds", "clip", "123")
    assert contrib._split_sample_uid("ds:clip") == ("ds", "clip", None)
    assert contrib._split_sample_uid("garbage") == (None, None, None)
    # ts 含冒号也只切 2 次
    assert contrib._split_sample_uid("ds:clip:1:2") == ("ds", "clip", "1:2")


def test_build_event_id_format():
    eid = event_service._build_event_id()
    assert eid.startswith("evt_")
    parts = eid.split("_")
    assert len(parts) == 3
    assert len(parts[2]) == 8


def test_query_dimension_unknown_raises(db_session):
    with pytest.raises(ValueError):
        event_service.query_dimension(db_session, "nonsense")


def test_event_result_payload_dataclass_defaults():
    p = event_service.EventResultPayload(clip_id="c1", payload_type="tag")
    assert p.tags is None and p.ts is None
