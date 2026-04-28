"""Dataset 创建 + 三种切割策略实现。

设计取舍（参考 docs/architecture/dataset-snowflake-redesign.md §2.2 / §3.2）：
- 三种切割策略并存：one_to_four / flexible / random_sample；no_ts 兼容旧整片消费。
- 写入 DatasetSample 时同步 emit 一条 LineageEvent + EventResult 维度记录，
  让 Snowflake 中心表能反查到样本来源。
- ``flexible_cut`` 服务专门服务 Explorer 拖动时间窗口的灵活切割。
"""

from __future__ import annotations

import random
import uuid
from typing import Any, Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.models.dataset import Dataset, DatasetSample
from src.services import event_service
from src.services.event_service import EventResultPayload


# ── 创建 Dataset ─────────────────────────────────────────────────────


def _infer_strategy(source_type: str, dataset_type: str) -> tuple[str, str]:
    """根据 source_type / dataset_type 推断 slice_strategy + ts_policy。"""
    if source_type == "tags":
        # official 通常是 1切4 或者 ts_from_tag
        if dataset_type == "official":
            return "one_to_four", "compute_1to4"
        return "flexible", "parse_from_tag"
    if source_type == "csv":
        return "flexible", "read_from_csv"
    return "no_ts", "none"


def create_dataset(
    db: Session,
    *,
    name: str,
    dataset_type: str,
    source_type: str,
    requirement_id: Optional[str] = None,
    allow_train: bool = False,
    tag_expr: Optional[str] = None,
    slice_strategy: Optional[str] = None,
    ts_policy: Optional[str] = None,
    default_range_l: int = -1,
    default_range_r: int = 3,
    created_by: str = "system",
    resolved_meta: Optional[dict] = None,
) -> Dataset:
    # API 强约束：customized + csv 必为 not allow_train
    normalized_type = dataset_type
    if source_type == "csv" and dataset_type != "customized":
        normalized_type = "customized"
    final_allow_train = allow_train if normalized_type == "official" else False

    inferred_strategy, inferred_policy = _infer_strategy(source_type, normalized_type)
    ds = Dataset(
        name=name,
        dataset_type=normalized_type,
        dataset_version=0,
        source_type=source_type,
        requirement_id=requirement_id,
        allow_train=final_allow_train,
        status="active",
        tag_expr=tag_expr,
        slice_strategy=slice_strategy or inferred_strategy,
        ts_policy=ts_policy or inferred_policy,
        default_range_l=default_range_l,
        default_range_r=default_range_r,
        created_by=created_by,
        resolved_meta=resolved_meta or {"rules": [f"inferred:{inferred_strategy}"]},
    )
    db.add(ds)
    db.flush()
    return ds


# ── 写入 DatasetSample ───────────────────────────────────────────────


def _add_sample(
    db: Session,
    *,
    dataset: Dataset,
    clip_id: str,
    ts: int,
    range_l: Optional[int],
    range_r: Optional[int],
    ts_origin: str,
    origin_ref: Optional[str] = None,
    extra_meta: Optional[dict] = None,
    training_type: Optional[str] = None,
) -> Optional[DatasetSample]:
    rl = range_l if range_l is not None else dataset.default_range_l
    rr = range_r if range_r is not None else dataset.default_range_r
    tt = training_type or _random_split()
    sample = DatasetSample(
        dataset_id=dataset.id,
        clip_id=clip_id,
        ts=ts,
        range_l=rl,
        range_r=rr,
        ts_origin=ts_origin,
        origin_ref=origin_ref,
        extra_meta=extra_meta,
        training_type=tt,
    )
    db.add(sample)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        # 唯一约束撞了 ⇒ 已有相同 (dataset, clip, ts)，幂等返回 None
        return None
    return sample


def _random_split(rng: Optional[random.Random] = None) -> str:
    rng = rng or random.Random()
    r = rng.random()
    if r < 0.7:
        return "train"
    if r < 0.9:
        return "test"
    return "holdout"


# ── 灵活切割（核心入口） ────────────────────────────────────────────


def flexible_cut(
    db: Session,
    *,
    dataset: Dataset,
    clip_id: str,
    ts_start: int,
    ts_end: int,
    ts_center: Optional[int] = None,
    range_l: Optional[int] = None,
    range_r: Optional[int] = None,
    requirement_id: Optional[str] = None,
    operations_task_id: Optional[str] = None,
    x_trace_id: Optional[str] = None,
    note: Optional[str] = None,
) -> dict[str, Any]:
    """Explorer 拖动选定 [ts_start, ts_end] → 写一条 sample + 一条 LineageEvent。"""
    if ts_end < ts_start:
        raise ValueError("ts_end must be >= ts_start")
    ts = ts_center if ts_center is not None else (ts_start + ts_end) // 2

    sample = _add_sample(
        db,
        dataset=dataset,
        clip_id=clip_id,
        ts=ts,
        range_l=range_l,
        range_r=range_r,
        ts_origin="flexible",
        origin_ref=f"window:{ts_start}-{ts_end}",
        extra_meta={"window": [ts_start, ts_end]},
    )

    # 同步 emit Snowflake 事件
    ev = event_service.emit_event(
        db,
        event_type="flexible_cut",
        source_type="manual_ui",
        requirement_id=requirement_id or dataset.requirement_id,
        operations_task_id=operations_task_id,
        x_trace_id=x_trace_id,
        table_name="dataset_samples_v2",
        payload={
            "dataset_id": dataset.id,
            "ts_start": ts_start,
            "ts_end": ts_end,
            "ts_center": ts,
        },
        results=[
            EventResultPayload(
                clip_id=clip_id,
                payload_type="tag",
                tags="flexible_cut",
                ts=ts,
                extra={"window": [ts_start, ts_end], "range": [
                    range_l if range_l is not None else dataset.default_range_l,
                    range_r if range_r is not None else dataset.default_range_r,
                ]},
                note=note,
            ),
        ],
    )

    return {
        "sample": _serialize_sample(sample) if sample else None,
        "event": event_service.serialize_event(ev),
        "deduplicated": sample is None,
    }


# ── 1切4 / random ──────────────────────────────────────────────────


def cut_one_to_four(
    db: Session,
    *,
    dataset: Dataset,
    clip_id: str,
    clip_start_ts: int,
    clip_end_ts: int,
) -> list[dict[str, Any]]:
    """official 1切4：把 [start, end] 等分为 4 段，取每段中点作 ts。"""
    if clip_end_ts < clip_start_ts:
        raise ValueError("clip_end_ts must be >= clip_start_ts")
    span = clip_end_ts - clip_start_ts
    quarter = span // 4 if span > 0 else 0
    out = []
    for i in range(4):
        ts = clip_start_ts + quarter * i + quarter // 2
        sample = _add_sample(
            db,
            dataset=dataset,
            clip_id=clip_id,
            ts=ts,
            range_l=None,
            range_r=None,
            ts_origin="computed_1to4",
            origin_ref=f"part:{i + 1}",
            extra_meta={"part": i + 1, "raw_span": [clip_start_ts, clip_end_ts]},
        )
        if sample is not None:
            out.append(_serialize_sample(sample))
    return out


# ── Promote customized → official（Operations · Release 工作流） ──


def promote_to_official(
    db: Session,
    *,
    customized: Dataset,
    name: Optional[str] = None,
    tag_expr: Optional[str] = None,
    allow_train: bool = True,
    requirement_id: Optional[str] = None,
    ops_item_id: Optional[str] = None,
    x_trace_id: Optional[str] = None,
    pipeline_run_id: Optional[str] = None,
    created_by: str = "system",
) -> dict[str, Any]:
    """把一个 customized dataset 提级为 official，复制全部 sample，写 LineageEvent。

    幂等约束：
    - 源必须 ``dataset_type='customized'`` 且 ``status='active'``。
    - 复制 sample 时由 ``(dataset_id, clip_id, ts)`` 唯一约束兜底；目标已存在的样本不重写。
    - ops_item_id 给定时，把对应 OpsItem 的 ``status`` 推进到 ``published``，
      ``payload.promoted_dataset_id`` 写入新 dataset id。
    """
    if customized.dataset_type != "customized":
        raise ValueError(
            f"only customized dataset can be promoted, got {customized.dataset_type}"
        )
    if customized.status != "active":
        raise ValueError(
            f"only active dataset can be promoted, got status={customized.status}"
        )

    new_name = name or f"{customized.name}_official"
    resolved_meta = {
        "rules": [f"promoted_from:{customized.id}"],
        "promoted_from": customized.id,
        "promoted_from_name": customized.name,
        "ops_item_id": ops_item_id,
    }

    official = Dataset(
        name=new_name,
        dataset_type="official",
        dataset_version=customized.dataset_version + 1,
        source_type="tags",
        requirement_id=requirement_id or customized.requirement_id,
        allow_train=bool(allow_train),
        status="active",
        tag_expr=tag_expr or f"promoted_from:{customized.id}",
        slice_strategy=customized.slice_strategy,
        ts_policy=customized.ts_policy,
        default_range_l=customized.default_range_l,
        default_range_r=customized.default_range_r,
        created_by=created_by,
        resolved_meta=resolved_meta,
    )
    db.add(official)
    db.flush()

    # 复制 sample
    src_samples = (
        db.query(DatasetSample)
        .filter(DatasetSample.dataset_id == customized.id)
        .all()
    )
    copied = 0
    deduped = 0
    sample_clip_ids: list[str] = []
    for s in src_samples:
        clone = DatasetSample(
            dataset_id=official.id,
            clip_id=s.clip_id,
            ts=s.ts,
            range_l=s.range_l,
            range_r=s.range_r,
            ts_origin=s.ts_origin,
            origin_ref=s.origin_ref,
            extra_meta={
                **(s.extra_meta or {}),
                "promoted_from_sample_id": s.id,
            },
            training_type=s.training_type,
        )
        db.add(clone)
        try:
            db.flush()
            copied += 1
            if s.clip_id not in sample_clip_ids:
                sample_clip_ids.append(s.clip_id)
        except IntegrityError:
            db.rollback()
            deduped += 1

    # 写 LineageEvent + 一条代表性 EventResult
    event_results = []
    for cid in sample_clip_ids[:50]:  # 限制 50 条避免单事件太大
        event_results.append(
            EventResultPayload(
                clip_id=cid,
                payload_type="tag",
                tags="release",
                note=f"promoted from {customized.name}",
            )
        )
    ev = event_service.emit_event(
        db,
        event_type="release",
        source_type="ops_release_promote",
        requirement_id=requirement_id or customized.requirement_id,
        operations_task_id=None,  # ops_item_id 不一定能 join 出 OperationsTask；交给上层填
        pipeline_run_id=pipeline_run_id,
        x_trace_id=x_trace_id,
        table_name="datasets_v2",
        payload={
            "customized_dataset_id": customized.id,
            "official_dataset_id": official.id,
            "ops_item_id": ops_item_id,
            "samples_copied": copied,
            "samples_deduped": deduped,
        },
        results=event_results,
    )

    # 更新 OpsItem（仅当传入）
    ops_item_serialized: Optional[dict[str, Any]] = None
    if ops_item_id:
        from src.models.ops_item import OpsItem
        ops = db.query(OpsItem).filter(OpsItem.id == ops_item_id).first()
        if ops is not None:
            ops.status = "published"
            payload = dict(ops.payload or {})
            payload["promoted_dataset_id"] = official.id
            payload["promoted_event_id"] = ev.id
            ops.payload = payload
            db.flush()
            ops_item_serialized = {
                "id": ops.id,
                "status": ops.status,
                "module": ops.module,
                "title": ops.title,
                "dataset_id": ops.dataset_id,
                "payload": ops.payload,
            }

    return {
        "official_dataset": serialize_dataset(official),
        "samples_copied": copied,
        "samples_deduped": deduped,
        "event": event_service.serialize_event(ev),
        "ops_item": ops_item_serialized,
    }


def random_sample(
    db: Session,
    *,
    dataset: Dataset,
    clip_id: str,
    clip_start_ts: int,
    clip_end_ts: int,
    n: int = 1,
    seed: Optional[int] = None,
) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    out = []
    for _ in range(n):
        if clip_end_ts <= clip_start_ts:
            ts = clip_start_ts
        else:
            ts = rng.randint(clip_start_ts, clip_end_ts)
        sample = _add_sample(
            db,
            dataset=dataset,
            clip_id=clip_id,
            ts=ts,
            range_l=None,
            range_r=None,
            ts_origin="random_window",
            extra_meta={"range_surfix": [dataset.default_range_l, dataset.default_range_r]},
        )
        if sample is not None:
            out.append(_serialize_sample(sample))
    return out


# ── 序列化 ──────────────────────────────────────────────────────────


def _serialize_sample(s: DatasetSample) -> dict[str, Any]:
    return {
        "id": s.id,
        "dataset_id": s.dataset_id,
        "clip_id": s.clip_id,
        "ts": s.ts,
        "range_l": s.range_l,
        "range_r": s.range_r,
        "ts_origin": s.ts_origin,
        "origin_ref": s.origin_ref,
        "extra_meta": s.extra_meta,
        "training_type": s.training_type,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


def serialize_dataset(ds: Dataset) -> dict[str, Any]:
    return {
        "id": ds.id,
        "name": ds.name,
        "dataset_type": ds.dataset_type,
        "dataset_version": ds.dataset_version,
        "source_type": ds.source_type,
        "requirement_id": ds.requirement_id,
        "allow_train": ds.allow_train,
        "status": ds.status,
        "tag_expr": ds.tag_expr,
        "slice_strategy": ds.slice_strategy,
        "ts_policy": ds.ts_policy,
        "default_range_l": ds.default_range_l,
        "default_range_r": ds.default_range_r,
        "created_by": ds.created_by,
        "resolved_meta": ds.resolved_meta,
        "created_at": ds.created_at.isoformat() if ds.created_at else None,
        "updated_at": ds.updated_at.isoformat() if ds.updated_at else None,
    }
