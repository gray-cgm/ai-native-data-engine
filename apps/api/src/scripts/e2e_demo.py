"""End-to-end self-driving demo —— ``make e2e-demo`` 主驱动。

按 9 步贯穿 Requirement → DataTask → Mining → Pipeline(batch+streaming) →
Labeling/Tagging/Checking → Explorer → **Build customized Dataset** → **Release
Promote → official Dataset** → **Export Dataset Artifact**。所有对象共享同一个
``x_trace_id``，最终交付物是一个可被算法工程师消费的 **official Dataset**
（datasets_v2 表 + DatasetSample 行 + 导出 parquet/jsonl artifact + LineageEvent
release）；同时落一份 ``DatasetSnapshotManifest`` 作为链路 receipt。

执行方式（直接走 SessionLocal，不依赖 API 在跑）：
    uv run --package api python -m src.scripts.e2e_demo

环境变量（皆可在 Makefile 中透传）：
    SCENARIO            night-vru | highway-cutin | urban-intersection | random
    SEED                整型，复现实验
    INCLUDE_STREAMING   1（默认）| 0
    RESET               1 → 跑前清空"e2e-demo"开头的旧 trace
    LANCE_ROOT          覆盖 data/lance 路径

设计要点：
- **交付终点 = Dataset**：v3 重构后 dataset 只有 customized + official。Step 7
  把通过 checking 的 clip 收成 customized；Step 8 通过 release OpsItem 调
  ``promote_to_official`` 复制 sample → 新建 official Dataset + LineageEvent。
- **直接 SessionLocal**：CI 友好，不需要先 ``make dev-api``。如果 API 已在跑，
  Web UI 与 API 都可立刻看到结果（同一个 SQLite 文件）。
- **Streaming 软依赖**：``streaming_probe`` 探活，broker 不可达自动降级 file-mode。
- **链路 receipt**：snapshot_service 在 release/export 写 manifest，记录
  requirement → ... → official_dataset 的完整产物。
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from src.core.database import SessionLocal, init_db
from src.core.runtime import get_runtime_container
from src.models.base import (
    AnnotationStatus,
    AnnotationType,
    CollectionStatus,
    OperationsModule,
    OperationsTaskStatus,
    PipelineStatus,
    Priority,
    RequirementSource,
    RequirementStatus,
    RunPurpose,
    SignOffStatus,
    TaskStatus,
    TaskType,
    TriggerSource,
)
from src.models.asset import Asset
from src.models.dataset import Dataset, DatasetSample
from src.models.dataset_snapshot import DatasetSnapshotManifest
from src.models.lineage_event import EventResult, LineageEvent
from src.models.ops_item import OpsItem
from src.models.requirement import (
    AnnotationTask,
    CollectionJob,
    DataTask,
    OperationsTask,
    PipelineRun,
    Requirement,
)
from src.scripts.lib import clip_matcher, scenario_loader, streaming_probe
from src.services import dataset_slice_service, snapshot_service

# clip_reader 在 python/adapters；直接导入读 lance meta（start_time / end_time 纳秒）
from adapters import clip_reader


_PRIORITY_MAP = {"high": Priority.HIGH, "medium": Priority.MEDIUM, "low": Priority.LOW}
_SOURCE_MAP = {
    "dre": RequirementSource.DRE,
    "product": RequirementSource.PRODUCT,
    "algorithm": RequirementSource.ALGORITHM,
    "test": RequirementSource.TEST,
}
# Step 名映射（v3）：scenario yaml 里的历史值归一为简单 step 名。
# v3 起 stage 是自由文本，不再做枚举校验；这里只是把同一语义的旧名归并到一个标签。
_STAGE_MAP: dict[str, str] = {
    # identity（当前 yaml 直接用这些 step 名）
    "collect": "collect",
    "clip-extract": "clip-extract",
    "feature-compute": "feature-compute",
    "process": "process",
    "release": "release",
    # legacy ingest/curate/publish 三段
    "ingest": "collect",
    "curate": "process",
    "publish": "release",
    # 更早的 raw_ingest/clip_extraction/...
    "raw_ingest": "collect",
    "clip_extraction": "clip-extract",
    "feature_extraction": "feature-compute",
    "structured_dataset": "release",
}
# release / publish step 用作"终态"判定
_TERMINAL_STAGES = {"release"}


@dataclass
class DemoContext:
    scenario: scenario_loader.Scenario
    rng: random.Random
    x_trace_id: str
    include_streaming: bool
    streaming_mode: str  # "kafka" | "file"
    streaming_detail: str
    lance_root: Path
    candidates: list[clip_matcher.ClipCandidate] = field(default_factory=list)
    requirement_id: str = ""
    pipeline_data_task_id: str = ""
    data_tasks: dict[str, str] = field(default_factory=dict)  # task_type -> id
    pipeline_run_ids: list[str] = field(default_factory=list)
    # release step 的终态 PipelineRun（旧名 gold_run_id / publish_run_id 已弃用）
    release_run_id: str | None = None
    mining_ops_task_id: str = ""
    release_ops_task_id: str = ""
    # ── 交付物：customized + official Dataset（v3） ───────────────────
    customized_dataset_id: str = ""
    customized_dataset_name: str = ""
    customized_sample_count: int = 0
    official_dataset_id: str = ""        # 最终交付给算法工程师的 Dataset
    official_dataset_name: str = ""
    official_sample_count: int = 0
    release_event_id: str | None = None  # promote_to_official 写的 LineageEvent
    # legacy catalog adapter 字段（保留是为了 snapshot manifest 兼容）
    dataset_id: str = ""
    dataset_version_id: str = ""
    export_job_id: str | None = None
    export_artifact_uri: str | None = None
    export_format: str = "parquet"
    asset_id: str | None = None  # 导出 artifact 登记的 Asset 行

    # ── 帮助：按业务语义把对象挂到对的 DataTask 上 ───────────────────
    def data_task_for(self, key: str) -> str:
        """缺省返回 release（PIPELINE）DataTask；找不到时退到任意一个。"""
        return self.data_tasks.get(key) or self.pipeline_data_task_id


# ── stage（step 名） → 业务上归属的 DataTask 类型 ─────────────────────
# 这里 step 名按 v3 的简单字符串建表；老 yaml 名也兼容。
_STAGE_TO_TASK_TYPE: dict[str, str] = {
    "collect": "collection",
    "clip-extract": "annotation",
    "feature-compute": "quality_check",
    "process": "quality_check",
    "release": "pipeline",
    # 兼容旧 yaml / 旧 enum 字符串
    "ingest": "collection",
    "curate": "quality_check",
    "publish": "pipeline",
    "raw_ingest": "collection",
    "clip_extraction": "annotation",
    "feature_extraction": "quality_check",
    "structured_dataset": "pipeline",
}

# 各 ops 模块归属哪条 DataTask
# mining   → 标注（挖出来的候选送去标注）
# labeling → 标注
# tagging  → 标注
# checking → 质检
# release  → 发版
_OPS_TO_TASK_TYPE: dict[str, str] = {
    "mining": "annotation",
    "labeling": "annotation",
    "tagging": "annotation",
    "checking": "quality_check",
    "release": "pipeline",
}


# ─────────────────────────────────────────────────────────────────────
# Step helpers
# ─────────────────────────────────────────────────────────────────────


def _new_trace_id(rng: random.Random) -> str:
    seed = rng.randint(0, 2**48 - 1)
    return f"trace_e2e_{seed:012x}"[:24]


def _section(title: str, body: str = "") -> None:
    bar = "─" * 72
    print(f"\n{bar}\n▶ {title}\n{bar}")
    if body:
        print(body)


def _section_done(message: str) -> None:
    print(f"  ✔ {message}")


def reset_existing(db) -> int:
    """删除以前 e2e-demo 跑出的 trace 数据。靠 ``trace_e2e_`` 前缀识别。"""
    targets = (
        db.query(DatasetSnapshotManifest)
        .filter(DatasetSnapshotManifest.x_trace_id.like("trace_e2e_%"))
        .all()
    )
    trace_ids = {m.x_trace_id for m in targets}
    if not trace_ids:
        return 0

    # 1) 清掉本次 trace 涉及的 customized + official Dataset_v2（顺带 cascade samples）
    dataset_ids_to_drop: set[str] = {m.dataset_id for m in targets if m.dataset_id}
    # 通过 LineageEvent 反查同 trace 还登记过的其它 dataset（promote 出的 official）
    for ev in db.query(LineageEvent).filter(LineageEvent.x_trace_id.in_(trace_ids)).all():
        payload = ev.payload or {}
        for k in ("customized_dataset_id", "official_dataset_id"):
            v = payload.get(k)
            if v:
                dataset_ids_to_drop.add(v)
    if dataset_ids_to_drop:
        db.query(DatasetSample).filter(
            DatasetSample.dataset_id.in_(dataset_ids_to_drop)
        ).delete(synchronize_session=False)
        db.query(Dataset).filter(Dataset.id.in_(dataset_ids_to_drop)).delete(synchronize_session=False)

    # 2) Asset / EventResult / LineageEvent（按 x_trace_id 过滤）
    db.query(Asset).filter(Asset.x_trace_id.in_(trace_ids)).delete(synchronize_session=False)
    event_pks = [
        ev.id for ev in db.query(LineageEvent).filter(LineageEvent.x_trace_id.in_(trace_ids)).all()
    ]
    if event_pks:
        db.query(EventResult).filter(EventResult.event_pk.in_(event_pks)).delete(synchronize_session=False)
        db.query(LineageEvent).filter(LineageEvent.id.in_(event_pks)).delete(synchronize_session=False)

    # 3) ops_items / pipeline_runs / operations_tasks / data_tasks
    db.query(OpsItem).filter(OpsItem.x_trace_id.in_(trace_ids)).delete(synchronize_session=False)
    db.query(PipelineRun).filter(PipelineRun.x_trace_id.in_(trace_ids)).delete(synchronize_session=False)
    db.query(OperationsTask).filter(OperationsTask.x_trace_id.in_(trace_ids)).delete(synchronize_session=False)
    db.query(DataTask).filter(DataTask.x_trace_id.in_(trace_ids)).delete(synchronize_session=False)
    req_ids = [m.requirement_id for m in targets if m.requirement_id]
    if req_ids:
        db.query(Requirement).filter(Requirement.id.in_(req_ids)).delete(synchronize_session=False)
    db.query(DatasetSnapshotManifest).filter(
        DatasetSnapshotManifest.x_trace_id.in_(trace_ids)
    ).delete(synchronize_session=False)
    db.commit()
    return len(trace_ids)


# ── Step 1 : Requirement ────────────────────────────────────────────


def step_requirement(db, ctx: DemoContext) -> None:
    _section("Step 1/9 — Requirement", f"scenario={ctx.scenario.name} trace={ctx.x_trace_id}")
    req = Requirement(
        title=f"[E2E] {ctx.scenario.title}",
        description=ctx.scenario.description.strip(),
        priority=_PRIORITY_MAP.get(ctx.scenario.priority, Priority.MEDIUM),
        source=_SOURCE_MAP.get(ctx.scenario.source, RequirementSource.DRE),
        status=RequirementStatus.IN_PROGRESS,
        dre_owner="dre-demo@example.com",
        target_scene=ctx.scenario.title,
        scene_tags=list(ctx.scenario.scene_tags),
        vehicle_tags=list(ctx.scenario.vehicle_tags),
        estimated_data_volume=ctx.scenario.estimated_data_volume,
        due_date=date.today() + timedelta(days=14),
    )
    db.add(req)
    db.flush()
    ctx.requirement_id = req.id
    _section_done(f"requirement {req.id} created")


# ── Step 2 : DataTasks (业务级 4 条里程碑) ──────────────────────────


_TASK_TYPE_MAP = {
    "collection": TaskType.COLLECTION,
    "annotation": TaskType.ANNOTATION,
    "quality_check": TaskType.QUALITY_CHECK,
    "pipeline": TaskType.PIPELINE,
}

# scenario YAML 没配 data_tasks 时的兜底业务模板（仍是业务语言、非工程细节）。
_DEFAULT_DATA_TASKS: list[dict[str, Any]] = [
    {"task_type": "collection", "title": "目标场景路采（里程/时长达标）",
     "target_count": 500, "target_unit": "公里",
     "actual_ratio": 0.6, "assigned_to": "data-collection-lead@example.com",
     "description": "按场景标签覆盖路采里程目标，路线由数据团队选址"},
    {"task_type": "annotation", "title": "供应商标注（覆盖目标帧数）",
     "target_count": 3000, "target_unit": "帧",
     "actual_ratio": 0.6, "assigned_to": "anno-pm@example.com",
     "description": "向标注供应商派单，按 SLA 完成关键帧标注"},
    {"task_type": "quality_check", "title": "回归集指标验收",
     "target_count": 95, "target_unit": "%",
     "actual_ratio": 0.95, "assigned_to": "model-qa-lead@example.com",
     "description": "在保留回归集上验证关键模型指标，达成验收门槛"},
    {"task_type": "pipeline", "title": "训练集版本发版",
     "target_count": 1, "target_unit": "训练集版本",
     "actual_ratio": 1.0, "assigned_to": "training-pm@example.com",
     "description": "汇总采集 + 标注 + 校验产物，发版交付训练流水线"},
]


def step_data_tasks(db, ctx: DemoContext) -> None:
    _section("Step 2/9 — Data Tasks (项目经理视角的 4 条业务里程碑，自动 sign-off)")
    plan = ctx.scenario.data_tasks or _DEFAULT_DATA_TASKS
    now = datetime.now(timezone.utc)

    for spec in plan:
        task_type_key = str(spec.get("task_type", "")).lower()
        task_type = _TASK_TYPE_MAP.get(task_type_key)
        if task_type is None:
            print(f"  ⚠ unknown task_type {task_type_key!r}, skipped")
            continue
        target_count = int(spec.get("target_count", 0))
        actual_ratio = float(spec.get("actual_ratio", 0.6))
        target_unit = spec.get("target_unit", "")
        description = spec.get("description") or ""
        # 把"单位"塞进 description，DB 字段不动（target_count 仍是 int）
        if target_unit and target_unit not in description:
            description = (
                f"目标 {target_count} {target_unit}\n{description}"
            ).strip()

        dt = DataTask(
            requirement_id=ctx.requirement_id,
            title=str(spec.get("title", task_type_key)),
            description=description,
            task_type=task_type,
            status=TaskStatus.IN_PROGRESS,
            sign_off_status=SignOffStatus.APPROVED,
            sign_off_by="bigdata-lead@example.com",
            sign_off_at=now,
            sign_off_comment="auto-approved by e2e-demo",
            assigned_to=str(spec.get("assigned_to", "")),
            target_count=target_count,
            actual_count=int(target_count * actual_ratio),
            x_trace_id=ctx.x_trace_id,
        )
        db.add(dt)
        db.flush()
        ctx.data_tasks[task_type.value] = dt.id

        # 子任务实物 (CollectionJob / AnnotationTask) 是工程层的执行细节，
        # 项目经理不直接看，但留在 DataTask 下方便算法/工程同事下钻。
        if task_type == TaskType.COLLECTION:
            db.add(CollectionJob(
                data_task_id=dt.id,
                vehicle_id=f"L4-{ctx.rng.randint(100, 999)}",
                route_id=f"R-{ctx.scenario.name}-{ctx.rng.randint(1, 9)}",
                status=CollectionStatus.UPLOADED,
                raw_data_uri=f"data/raw/{ctx.x_trace_id}/{dt.id[:8]}.bag",
                total_frames=target_count * 30 if target_unit == "公里" else target_count,
            ))
        elif task_type == TaskType.ANNOTATION:
            db.add(AnnotationTask(
                data_task_id=dt.id,
                clip_uri=f"data/assets/clips/{ctx.x_trace_id}/clips.lance",
                annotation_type=AnnotationType.BBOX_2D,
                annotation_vendor="appen",
                status=AnnotationStatus.IN_PROGRESS,
                tpi_score=round(ctx.rng.uniform(28, 42), 2),
                total_objects=int(target_count * 12),
            ))
        print(f"  • {task_type.value:<14} {dt.title}")

    pipeline_id = ctx.data_tasks.get(TaskType.PIPELINE.value)
    if not pipeline_id:
        # PipelineRun 模型必须 FK 到一条 DataTask，缺则用任一已建的。
        pipeline_id = next(iter(ctx.data_tasks.values()), None)
    ctx.pipeline_data_task_id = pipeline_id  # type: ignore[assignment]
    db.flush()
    _section_done(
        f"{len(ctx.data_tasks)} data tasks created (training-set release id={ctx.pipeline_data_task_id})"
    )


# ── Step 3 : Mining ─────────────────────────────────────────────────


def step_mining(db, ctx: DemoContext) -> None:
    _section("Step 3/9 — Operation Mining (filter clips by scene_tags)")

    cf = ctx.scenario.clip_filter or {}
    candidates = clip_matcher.list_candidates(
        ctx.lance_root,
        scenarios=cf.get("scenarios"),
        any_tags=cf.get("any_tags"),
        fallback_take=int(cf.get("fallback_take", 1)),
        rng=ctx.rng,
    )
    if not candidates:
        print("  ⚠ data/lance/ 下没有任何 clip，mining 步骤将创建空候选集（后续 release 仍可落 manifest）")
    ctx.candidates = candidates

    # mining 归属"标注"工单（挖出候选 → 送去标注），便于 PM 在标注 DataTask 看到候选集
    mining_dt_id = ctx.data_task_for(_OPS_TO_TASK_TYPE["mining"])

    op = OperationsTask(
        requirement_id=ctx.requirement_id,
        data_task_id=mining_dt_id,
        module=OperationsModule.MINING,
        title=f"难例挖掘：{ctx.scenario.title}",
        status=OperationsTaskStatus.COMPLETED,
        assigned_to="mining-bot@example.com",
        x_trace_id=ctx.x_trace_id,
        payload={"filter": cf, "candidate_count": len(candidates)},
        started_at=datetime.now(timezone.utc) - timedelta(minutes=20),
        completed_at=datetime.now(timezone.utc),
    )
    db.add(op)
    db.flush()
    ctx.mining_ops_task_id = op.id

    # 每个候选 clip 一条 OpsItem(mining)，作为后续 labeling 的输入引用
    for cand in candidates:
        db.add(OpsItem(
            operations_task_id=op.id,
            requirement_id=ctx.requirement_id,
            data_task_id=mining_dt_id,
            x_trace_id=ctx.x_trace_id,
            module=OperationsModule.MINING,
            title=f"候选 {cand.clip_id}",
            status="candidates_ready",
            kind="hard_case",
            owner="mining-bot@example.com",
            clip_ids=[cand.clip_id],
            scenario=ctx.scenario.name,
            payload={
                "scenario": cand.scenario,
                "city": cand.city,
                "vehicle": cand.vehicle_name,
                "keyframe_count": cand.keyframe_count,
                "tags": cand.tags,
                "da_tags": cand.da_tags,
            },
        ))
    db.flush()
    _section_done(f"mining ops_task={op.id} candidates={len(candidates)}")


# ── Step 4 : Pipeline batch ─────────────────────────────────────────


def _build_metrics(ctx: DemoContext, success: bool) -> dict[str, Any]:
    cost = ctx.scenario.cost_template or {}
    cpu_lo, cpu_hi = cost.get("cpu_seconds_range", [60, 300])
    gpu_lo, gpu_hi = cost.get("gpu_seconds_range", [0, 60])
    sto_lo, sto_hi = cost.get("storage_gb_range", [0.1, 5.0])
    duration = ctx.rng.randint(60, 1800)
    cpu = round(ctx.rng.uniform(cpu_lo, cpu_hi), 2)
    gpu = round(ctx.rng.uniform(gpu_lo, gpu_hi), 2)
    sto = round(ctx.rng.uniform(sto_lo, sto_hi), 3)
    cost_usd = round(cpu * 0.00003 + gpu * 0.00025 + sto * 0.02, 4)
    quality = ctx.scenario.quality_gate or {}
    if not success:
        gate_result = "block"
        gate_reason = ctx.rng.choice(quality.get("block_reasons") or ["unknown"])
    elif ctx.rng.random() < 0.10:
        gate_result = "waiver"
        gate_reason = ctx.rng.choice(quality.get("waiver_reasons") or ["manual_override"])
    else:
        gate_result = "pass"
        gate_reason = None
    return {
        "rows_in": ctx.rng.randint(2_000, 50_000),
        "rows_out": ctx.rng.randint(2_000, 50_000),
        "duration_s": duration,
        "gate_result": gate_result,
        "gate_reason": gate_reason,
        "cpu_seconds": cpu,
        "gpu_seconds": gpu,
        "storage_gb": sto,
        "cost_usd": cost_usd,
    }


def step_pipeline_batch(db, ctx: DemoContext) -> None:
    _section("Step 4/9 — Pipeline Batch (collect → clip-extract → feature-compute → release)")
    parent = ctx.mining_ops_task_id
    last_run_id: str | None = None
    pass_rate = float(ctx.scenario.quality_gate.get("pass_rate", 0.85))
    for idx, stage_str in enumerate(ctx.scenario.stage_sequence):
        stage = _STAGE_MAP.get(stage_str)
        if stage is None:
            continue
        success = ctx.rng.random() < pass_rate
        status = PipelineStatus.SUCCESS if success else PipelineStatus.FAILED
        started = datetime.now(timezone.utc) - timedelta(minutes=60 - idx * 12)
        ended = started + timedelta(minutes=ctx.rng.randint(5, 30))
        # 按业务语义把 PipelineRun 挂到对的 DataTask 上：collect→采集 /
        # clip-extract→标注 / feature-compute→质检 / release→发版。这样 PM 点开
        # 任一 DataTask 都能看到自己关心的运行。
        run_dt_id = ctx.data_task_for(_STAGE_TO_TASK_TYPE.get(stage, "pipeline"))
        run = PipelineRun(
            data_task_id=run_dt_id,
            x_trace_id=ctx.x_trace_id,
            trace_parent_id=last_run_id or parent,
            requirement_id=ctx.requirement_id,
            operations_task_id=parent,
            trigger_source=TriggerSource.OPERATIONS_TASK,
            run_purpose=RunPurpose.INITIAL_BUILD if idx == 0 else RunPurpose.BACKFILL,
            pipeline_name=f"{ctx.scenario.name}-{stage}",
            stage=stage,
            input_uri=f"data/raw/{ctx.x_trace_id}/{stage}/in.parquet",
            output_uri=f"data/assets/{ctx.x_trace_id}/{stage}/out.parquet"
                       if status == PipelineStatus.SUCCESS else None,
            status=status,
            config={"step_index": idx, "candidate_clip_count": len(ctx.candidates)},
            metrics=_build_metrics(ctx, success),
            started_at=started,
            completed_at=ended,
        )
        db.add(run)
        db.flush()
        ctx.pipeline_run_ids.append(run.id)
        last_run_id = run.id
        if stage in _TERMINAL_STAGES and status == PipelineStatus.SUCCESS:
            ctx.release_run_id = run.id
        print(f"  • {stage:<16} status={status.value:<7} gate={run.metrics['gate_result']}  data_task={run_dt_id[:8]}")
    db.flush()
    _section_done(f"{len(ctx.pipeline_run_ids)} pipeline runs (release_run={ctx.release_run_id or 'none'})")


# ── Step 4b : Pipeline streaming ────────────────────────────────────


def step_pipeline_streaming(db, ctx: DemoContext) -> None:
    if not ctx.include_streaming:
        _section("Step 4b/9 — Streaming SKIPPED (INCLUDE_STREAMING=0)")
        return
    _section(f"Step 4b/9 — Pipeline Streaming (mode={ctx.streaming_mode})")
    started = datetime.now(timezone.utc) - timedelta(minutes=8)
    ended = started + timedelta(minutes=4)
    metrics = _build_metrics(ctx, success=True)
    metrics.update({"streaming_mode": ctx.streaming_mode, "detail": ctx.streaming_detail})
    run = PipelineRun(
        data_task_id=ctx.pipeline_data_task_id,
        x_trace_id=ctx.x_trace_id,
        trace_parent_id=ctx.mining_ops_task_id,
        requirement_id=ctx.requirement_id,
        operations_task_id=ctx.mining_ops_task_id,
        trigger_source=TriggerSource.EXTERNAL,
        run_purpose=RunPurpose.REPLAY,
        pipeline_name=f"{ctx.scenario.name}-streaming-replay",
        stage="streaming-replay",
        input_uri=f"kafka://{ctx.scenario.streaming_topic}"
                  if ctx.streaming_mode == "kafka"
                  else "file://data/exports/clip-stream-events.jsonl",
        output_uri="duckdb://default/streaming.events",
        status=PipelineStatus.SUCCESS,
        config={"mode": ctx.streaming_mode, "topic": ctx.scenario.streaming_topic},
        metrics=metrics,
        started_at=started,
        completed_at=ended,
    )
    db.add(run)
    db.flush()
    ctx.pipeline_run_ids.append(run.id)

    # 真正发一批事件（不阻塞失败：失败也要记录 streaming run，方便排查）
    try:
        if ctx.candidates:
            os.environ["STREAMING_DEMO_TARGET"] = ctx.streaming_mode
            os.environ["CLIP_STREAM_TRACE_ID"] = ctx.x_trace_id
            os.environ["CLIP_STREAM_REQUIREMENT_ID"] = ctx.requirement_id
            from src.scripts.streaming_demo import run_clip_stream
            summary = run_clip_stream(
                lance_root=ctx.lance_root,
                clip_id=ctx.candidates[0].clip_id,
                max_events=20,
            )
            print(f"  • emitted {summary.get('events_written', 0)} events ({summary.get('mode')})")
    except Exception as exc:  # noqa: BLE001 — streaming 失败不应阻断 demo
        print(f"  ⚠ streaming emit failed (non-fatal): {exc}")
    _section_done("streaming run recorded")


# ── Step 5 : Labeling / Tagging / Checking ──────────────────────────


def _ops_task(
    db,
    ctx: DemoContext,
    *,
    module: OperationsModule,
    title: str,
    data_task_id: str | None = None,
) -> OperationsTask:
    """创建 OperationsTask；默认按 _OPS_TO_TASK_TYPE 自动选 DataTask 归属。"""
    if data_task_id is None:
        data_task_id = ctx.data_task_for(_OPS_TO_TASK_TYPE.get(module.value, "pipeline"))
    op = OperationsTask(
        requirement_id=ctx.requirement_id,
        data_task_id=data_task_id,
        module=module,
        title=title,
        status=OperationsTaskStatus.COMPLETED,
        assigned_to="ops-team@example.com",
        x_trace_id=ctx.x_trace_id,
        payload={"scenario": ctx.scenario.name},
        started_at=datetime.now(timezone.utc) - timedelta(minutes=15),
        completed_at=datetime.now(timezone.utc),
    )
    db.add(op)
    db.flush()
    return op


def step_labeling_tagging_checking(db, ctx: DemoContext) -> None:
    _section("Step 5/9 — Labeling / Tagging / Checking (按业务语义挂到对应 DataTask)")
    if not ctx.candidates:
        print("  ⚠ 没有候选 clip，跳过 5 步内容（仅创建占位 ops_task）")
        _ops_task(db, ctx, module=OperationsModule.LABELING, title=f"标注（占位）：{ctx.scenario.title}")
        _ops_task(db, ctx, module=OperationsModule.TAGGING, title=f"打标（占位）：{ctx.scenario.title}")
        _ops_task(db, ctx, module=OperationsModule.CHECKING, title=f"质检（占位）：{ctx.scenario.title}")
        db.flush()
        return

    label_op = _ops_task(db, ctx, module=OperationsModule.LABELING, title=f"标注：{ctx.scenario.title}")
    tag_op = _ops_task(db, ctx, module=OperationsModule.TAGGING, title=f"打标：{ctx.scenario.title}")
    check_op = _ops_task(db, ctx, module=OperationsModule.CHECKING, title=f"质检：{ctx.scenario.title}")

    pass_rate = float(ctx.scenario.quality_gate.get("pass_rate", 0.85))
    for cand in ctx.candidates:
        # labeling: 70% done / 20% review / 10% in_progress（演示状态分布）
        roll = ctx.rng.random()
        label_status = "done" if roll < 0.7 else "review" if roll < 0.9 else "in_progress"
        db.add(OpsItem(
            operations_task_id=label_op.id, requirement_id=ctx.requirement_id,
            data_task_id=label_op.data_task_id, x_trace_id=ctx.x_trace_id,
            module=OperationsModule.LABELING,
            title=f"标注 {cand.clip_id}",
            status=label_status, kind=ctx.rng.choice(["human", "auto", "hybrid"]),
            owner="annotator@example.com",
            clip_ids=[cand.clip_id], scenario=ctx.scenario.name,
            payload={"object_count": ctx.rng.randint(120, 800)},
        ))
        db.add(OpsItem(
            operations_task_id=tag_op.id, requirement_id=ctx.requirement_id,
            data_task_id=tag_op.data_task_id, x_trace_id=ctx.x_trace_id,
            module=OperationsModule.TAGGING,
            title=f"打标 {cand.clip_id}",
            status="applied", kind=ctx.rng.choice(["manual", "rule", "model"]),
            owner="tagger@example.com",
            clip_ids=[cand.clip_id], scenario=ctx.scenario.name,
            payload={"applied_tags": ctx.scenario.scene_tags},
        ))
        # checking 的状态使用 scenario 的 pass_rate
        if ctx.rng.random() < pass_rate:
            chk_status, chk_kind = "passed", "qc_auto"
        elif ctx.rng.random() < 0.5:
            chk_status, chk_kind = "waived", "qc_human"
        else:
            chk_status, chk_kind = "failed", "gating"
        db.add(OpsItem(
            operations_task_id=check_op.id, requirement_id=ctx.requirement_id,
            data_task_id=check_op.data_task_id, x_trace_id=ctx.x_trace_id,
            module=OperationsModule.CHECKING,
            title=f"质检 {cand.clip_id}",
            status=chk_status, kind=chk_kind,
            owner="qa@example.com",
            clip_ids=[cand.clip_id], scenario=ctx.scenario.name,
            payload={"reason": None if chk_status == "passed" else "see scenario gate"},
        ))
    db.flush()
    print(f"  • mining/labeling/tagging → annotation DataTask")
    print(f"  • checking                → quality_check DataTask")
    print(f"  • release (step 7)        → pipeline DataTask")
    _section_done(
        f"created label/tag/check items × {len(ctx.candidates)} candidates"
    )


# ── Step 6 : Explorer (展示用) ──────────────────────────────────────


def step_explorer_hint(ctx: DemoContext) -> None:
    _section("Step 6/9 — Explorer (verification only — no DB write)")
    print("  Explorer 复用 /clips API 查询候选 clip：")
    if ctx.candidates:
        for cand in ctx.candidates[:3]:
            print(f"    curl 'http://localhost:8000/clips/{cand.clip_id}'")
    print(f"    curl 'http://localhost:8000/clips?keyword={ctx.scenario.scene_tags[0]}'"
          if ctx.scenario.scene_tags else "")
    _section_done("explorer step is informational")


# ── Step 7-9 : Build customized → Promote official → Export ────────


def _passed_candidates(db, ctx: DemoContext) -> list[clip_matcher.ClipCandidate]:
    """挑出本 trace 通过 checking 的 clip（status=passed 或 waived）。"""
    if not ctx.candidates:
        return []
    rows = (
        db.query(OpsItem)
        .filter(
            OpsItem.x_trace_id == ctx.x_trace_id,
            OpsItem.module == OperationsModule.CHECKING,
            OpsItem.status.in_(["passed", "waived"]),
        )
        .all()
    )
    passed_ids = {cid for r in rows for cid in (r.clip_ids or [])}
    if not passed_ids:
        # checking 没产出 / 全 failed —— 兜底用所有 candidates（demo 可看到）
        return list(ctx.candidates)
    return [c for c in ctx.candidates if c.clip_id in passed_ids]


def _clip_window_ns(ctx: DemoContext, cand: clip_matcher.ClipCandidate) -> tuple[int, int]:
    """读 lance meta 拿 (start_ns, end_ns)；缺失时合成一个稳定窗口。"""
    try:
        meta = clip_reader.load_meta(Path(cand.path))
        start = int(meta.get("start_time") or 0)
        end = int(meta.get("end_time") or 0)
        if end > start > 0:
            return start, end
    except Exception:  # noqa: BLE001
        pass
    # 合成：用 keyframe_count * 100ms 估算时长，clip_id hash 作起点保稳定
    duration_ns = max(int((cand.keyframe_count or 30) * 1e8), int(3 * 1e9))
    base = (abs(hash(cand.clip_id)) % (10**10)) * int(1e9)
    return base, base + duration_ns


# ── Step 7 : Build customized Dataset (samples) ──────────────────────


def step_build_customized_dataset(db, ctx: DemoContext) -> None:
    _section("Step 7/9 — Build customized Dataset (samples from passed clips)")

    passed = _passed_candidates(db, ctx)
    if not passed:
        print("  ⚠ 没有通过 checking 的 clip，跳过 customized dataset 构建")
        return

    name = f"ds_{ctx.scenario.name.replace('-', '_')}_{ctx.x_trace_id[-8:]}_customized"
    ds = dataset_slice_service.create_dataset(
        db,
        name=name,
        dataset_type="customized",
        source_type="other",
        requirement_id=ctx.requirement_id,
        allow_train=False,
        tag_expr=" AND ".join(ctx.scenario.scene_tags) if ctx.scenario.scene_tags else None,
        slice_strategy="flexible",
        ts_policy="flexible_window",
        default_range_l=-1,
        default_range_r=3,
        created_by="e2e-demo",
        resolved_meta={
            "rules": [f"e2e:scenario={ctx.scenario.name}"],
            "x_trace_id": ctx.x_trace_id,
        },
    )
    ctx.customized_dataset_id = ds.id
    ctx.customized_dataset_name = name

    written = 0
    for cand in passed:
        start_ns, end_ns = _clip_window_ns(ctx, cand)
        ts = (start_ns + end_ns) // 2
        sample = DatasetSample(
            dataset_id=ds.id,
            clip_id=cand.clip_id,
            ts=ts,
            range_l=ds.default_range_l,
            range_r=ds.default_range_r,
            ts_origin="flexible",
            origin_ref=f"window:{start_ns}-{end_ns}",
            extra_meta={
                "window": [start_ns, end_ns],
                "scenario": cand.scenario,
                "vehicle": cand.vehicle_name,
                "city": cand.city,
            },
            training_type=ctx.rng.choices(
                ["train", "test", "holdout"], weights=[7, 2, 1]
            )[0],
        )
        db.add(sample)
        try:
            db.flush()
            written += 1
        except Exception:  # noqa: BLE001 — 唯一约束撞了，幂等跳过
            db.rollback()

    ctx.customized_sample_count = written
    db.commit()
    _section_done(
        f"customized dataset={ds.id[:8]}… name={name} samples={written}"
    )


# ── Step 8 : Release → Promote to Official Dataset ──────────────────


def step_release_promote(db, ctx: DemoContext) -> None:
    _section("Step 8/9 — Release → Promote customized → official Dataset")

    if not ctx.customized_dataset_id:
        print("  ⚠ 没有 customized dataset，跳过 promote")
        return

    # release OpsTask + 一条 release OpsItem（status=approved）—— 与 UI promote 流程同形
    op = _ops_task(db, ctx, module=OperationsModule.RELEASE, title=f"发版：{ctx.scenario.title}")
    ctx.release_ops_task_id = op.id
    op.status = OperationsTaskStatus.COMPLETED

    release_item = OpsItem(
        operations_task_id=op.id,
        requirement_id=ctx.requirement_id,
        data_task_id=op.data_task_id,
        x_trace_id=ctx.x_trace_id,
        module=OperationsModule.RELEASE,
        title=f"release {ctx.customized_dataset_name}",
        status="approved",  # 直接进 approved，下一步 promote
        kind="training",
        owner="release@example.com",
        clip_ids=[c.clip_id for c in ctx.candidates],
        dataset_id=ctx.customized_dataset_id,
        scenario=ctx.scenario.name,
        payload={"intent": "promote-to-official"},
    )
    db.add(release_item)
    db.flush()

    customized = db.query(Dataset).filter(Dataset.id == ctx.customized_dataset_id).first()
    if customized is None:
        print("  ✗ 未找到 customized dataset，无法 promote")
        return

    official_name = ctx.customized_dataset_name.replace("_customized", "_official")
    result = dataset_slice_service.promote_to_official(
        db,
        customized=customized,
        name=official_name,
        tag_expr=customized.tag_expr or f"promoted_from:{customized.id}",
        allow_train=True,
        requirement_id=ctx.requirement_id,
        ops_item_id=release_item.id,
        x_trace_id=ctx.x_trace_id,
        pipeline_run_id=ctx.release_run_id,
        created_by="e2e-demo",
    )
    db.commit()

    ctx.official_dataset_id = result["official_dataset"]["id"]
    ctx.official_dataset_name = result["official_dataset"]["name"]
    ctx.official_sample_count = result["samples_copied"]
    ctx.release_event_id = result["event"]["id"]

    # snapshot manifest：把 official dataset 当作交付物登记
    snapshot_service.open_or_create(
        db,
        x_trace_id=ctx.x_trace_id,
        requirement_id=ctx.requirement_id,
        data_task_id=ctx.pipeline_data_task_id,
        operations_task_id=ctx.release_ops_task_id,
        gold_pipeline_run_id=ctx.release_run_id,
        pipeline_run_count=len(ctx.pipeline_run_ids),
        clip_ids=[c.clip_id for c in ctx.candidates],
        scenario=ctx.scenario.name,
        title=ctx.scenario.title,
        summary=ctx.scenario.description.strip(),
    )
    snapshot_service.attach_dataset_version(
        db,
        x_trace_id=ctx.x_trace_id,
        dataset_id=ctx.official_dataset_id,
        dataset_version_id=f"v{result['official_dataset']['dataset_version']}",
    )
    db.commit()
    # 回填 dataset_id 给 export 步骤
    ctx.dataset_id = ctx.official_dataset_id
    ctx.dataset_version_id = f"v{result['official_dataset']['dataset_version']}"

    _section_done(
        f"official dataset={ctx.official_dataset_id[:8]}… name={ctx.official_dataset_name} "
        f"samples={ctx.official_sample_count} (deduped={result['samples_deduped']}) "
        f"event={(ctx.release_event_id or '')[:8]}…"
    )


# ── Step 9 : Export Official Dataset Artifact ───────────────────────


def step_export(db, ctx: DemoContext) -> None:
    _section("Step 9/9 — Export Official Dataset → Algorithm Engineer Artifact")

    if not ctx.official_dataset_id:
        print("  ⚠ 没有 official dataset，跳过 export")
        return

    samples = (
        db.query(DatasetSample)
        .filter(DatasetSample.dataset_id == ctx.official_dataset_id)
        .order_by(DatasetSample.created_at.asc())
        .all()
    )
    rows = [
        {
            "id": s.id,
            "dataset_id": s.dataset_id,
            "clip_id": s.clip_id,
            "ts": s.ts,
            "range_l": s.range_l,
            "range_r": s.range_r,
            "ts_origin": s.ts_origin,
            "training_type": s.training_type,
            "extra_meta": s.extra_meta,
        }
        for s in samples
    ]

    # 算法工程师消费：JSON Lines 直接读 / parquet 走 pandas（demo 优先 jsonl，可用性最高）
    fmt = ctx.export_format if ctx.export_format in {"jsonl", "json"} else "jsonl"
    output_path = Path("data/exports") / f"{ctx.official_dataset_id}-{ctx.dataset_version_id}.{fmt}"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
    ctx.export_artifact_uri = str(output_path)
    ctx.export_format = fmt

    container = get_runtime_container()
    job = container.metadata.create_export_job({
        "export_id": f"export-{ctx.official_dataset_id}-{ctx.dataset_version_id}-{fmt}",
        "dataset_id": ctx.official_dataset_id,
        "format": fmt,
        "status": "ready",
        "output_path": str(output_path),
    })
    ctx.export_job_id = job.get("export_id")

    # 登记一条 derived Asset：交付物本身就是一个 derived data asset
    asset = Asset(
        name=f"official-dataset-{ctx.official_dataset_id[:8]}.{fmt}",
        asset_kind="derived",
        uri=str(output_path),
        format=fmt,
        clip_id=None,
        producer_pipeline_run_id=ctx.release_run_id,
        producer_event_id=ctx.release_event_id,
        requirement_id=ctx.requirement_id,
        x_trace_id=ctx.x_trace_id,
        byte_size=output_path.stat().st_size if output_path.exists() else None,
        row_count=len(rows),
        payload={
            "dataset_id": ctx.official_dataset_id,
            "dataset_version_id": ctx.dataset_version_id,
            "delivered_to": "algorithm_engineer",
            "schema": list(rows[0].keys()) if rows else [],
        },
    )
    db.add(asset)
    db.flush()
    ctx.asset_id = asset.id

    snapshot_service.attach_export_artifact(
        db,
        x_trace_id=ctx.x_trace_id,
        export_job_id=ctx.export_job_id,
        export_artifact_uri=ctx.export_artifact_uri,
        export_format=fmt,
    )
    db.commit()
    _section_done(
        f"artifact={output_path} rows={len(rows)} asset={asset.id[:8]}…"
    )


# ── Banner ──────────────────────────────────────────────────────────


def print_banner(ctx: DemoContext) -> None:
    print()
    print("═" * 72)
    print("✔ E2E Demo Complete — deliverable: official Dataset")
    print("═" * 72)
    receipt = Path("data/exports") / f"e2e-snapshot-{ctx.x_trace_id}.json"
    print(f"  scenario          : {ctx.scenario.name} ({ctx.scenario.title})")
    print(f"  trace_id          : {ctx.x_trace_id}")
    print(f"  requirement_id    : {ctx.requirement_id}")
    print(f"  pipeline_runs     : {len(ctx.pipeline_run_ids)} (release_run={ctx.release_run_id or 'n/a'})")
    print(f"  candidate_clips   : {len(ctx.candidates)}")
    print("─" * 72)
    print("  ── Datasets (v3) ──")
    print(f"  customized        : {ctx.customized_dataset_id or '—'}  ({ctx.customized_sample_count} samples)")
    print(f"  ★ official        : {ctx.official_dataset_id or '—'}  ({ctx.official_sample_count} samples)")
    print(f"    name            : {ctx.official_dataset_name or '—'}")
    print(f"    release_event   : {ctx.release_event_id or '—'}")
    print("─" * 72)
    print(f"  artifact (file)   : {ctx.export_artifact_uri or '—'}")
    print(f"  asset_id          : {ctx.asset_id or '—'}")
    print(f"  trace receipt     : {receipt}")
    print(f"  streaming         : {ctx.streaming_mode} ({ctx.streaming_detail})"
          if ctx.include_streaming else "  streaming         : skipped")
    print("─" * 72)
    print("For the algorithm engineer (API expected at http://localhost:8000):")
    if ctx.official_dataset_id:
        print(f"  curl 'http://localhost:8000/api/v1/datasets/{ctx.official_dataset_id}'")
        print(f"  curl 'http://localhost:8000/api/v1/datasets/{ctx.official_dataset_id}/samples?limit=200'")
        print(f"  open  http://localhost:5173/catalog/v2/{ctx.official_dataset_id}")
    print()
    print("Trace verification:")
    print(f"  curl http://localhost:8000/api/v1/snapshots/{ctx.x_trace_id}")
    print(f"  curl 'http://localhost:8000/api/v1/pipeline-runs?x_trace_id={ctx.x_trace_id}'")
    print(f"  curl 'http://localhost:8000/api/v1/events?x_trace_id={ctx.x_trace_id}'")
    print(f"  curl 'http://localhost:8000/api/v1/assets?x_trace_id={ctx.x_trace_id}'")
    print(f"  curl 'http://localhost:8000/api/v1/trace/{ctx.x_trace_id}'")
    print(f"  open  http://localhost:5173/pipelines?x_trace_id={ctx.x_trace_id}")
    print("═" * 72)


# ── Entry ───────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(description="AI Data Loop Engine — E2E demo")
    parser.add_argument("--scenario", default=os.environ.get("SCENARIO", "random"),
                        help="night-vru | highway-cutin | urban-intersection | random")
    parser.add_argument("--seed", type=int,
                        default=int(os.environ.get("SEED")) if os.environ.get("SEED") else None,
                        help="random seed for reproducibility")
    parser.add_argument(
        "--include-streaming",
        type=int,
        default=int(os.environ.get("INCLUDE_STREAMING", "1")),
        help="1 = enable streaming step (default), 0 = skip",
    )
    parser.add_argument(
        "--reset", action="store_true",
        default=os.environ.get("RESET", "").lower() in {"1", "true", "yes"},
        help="reset previous e2e-demo data (trace_e2e_* prefix)",
    )
    parser.add_argument(
        "--lance-root", default=os.environ.get("LANCE_ROOT", "data/lance"),
    )
    parser.add_argument("--format", default="parquet")
    args = parser.parse_args()

    seed = args.seed if args.seed is not None else uuid.uuid4().int & 0xFFFFFFFF
    rng = random.Random(seed)
    scenario = scenario_loader.resolve(args.scenario, rng)
    trace_id = _new_trace_id(rng)

    streaming_mode, streaming_detail = "file", "skipped"
    if args.include_streaming:
        streaming_mode, streaming_detail = streaming_probe.probe()

    ctx = DemoContext(
        scenario=scenario,
        rng=rng,
        x_trace_id=trace_id,
        include_streaming=bool(args.include_streaming),
        streaming_mode=streaming_mode,
        streaming_detail=streaming_detail,
        lance_root=Path(args.lance_root),
        export_format=args.format,
    )

    init_db()
    db = SessionLocal()
    try:
        if args.reset:
            removed = reset_existing(db)
            print(f"→ reset removed {removed} previous e2e traces")

        step_requirement(db, ctx); db.commit()
        step_data_tasks(db, ctx); db.commit()
        step_mining(db, ctx); db.commit()
        step_pipeline_batch(db, ctx); db.commit()
        step_pipeline_streaming(db, ctx); db.commit()
        step_labeling_tagging_checking(db, ctx); db.commit()
        step_explorer_hint(ctx)
        step_build_customized_dataset(db, ctx); db.commit()
        step_release_promote(db, ctx)
        step_export(db, ctx)
        print_banner(ctx)
    except Exception as exc:
        db.rollback()
        print(f"\n[E2E ERROR] {type(exc).__name__}: {exc}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
