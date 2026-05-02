"""全链路追踪 Demo 数据播种脚本

为 Pipelines/Requirements/Ops 页面生成一组 **随机但结构合理** 的 4 层链路数据：
Requirement → DataTask → OperationsTask → PipelineRun，且整条链共享同一个 ``x_trace_id``。

使用方式：
    # 默认：2 个需求，3~4 条 DataTask × 1~3 条 OperationsTask × 1~3 条 PipelineRun
    uv run python -m src.scripts.seed_trace_demo

    # 指定规模 + 可复现的随机种子 + 清空旧 demo 数据
    uv run python -m src.scripts.seed_trace_demo --requirements 3 --seed 42 --reset

也可通过 Makefile 目标：``make seed-trace-demo``。

设计取舍：
- 直接走 SQLAlchemy SessionLocal 写库，无需 API 服务运行，方便 CI/初始化用。
- ``x_trace_id`` 统一采用 ``trace_<uuid4 前 12 位>`` 可读前缀，便于 UI 高亮与日志检索。
- 数据分布参数集中在顶部常量里，方便调参。
"""

from __future__ import annotations

import argparse
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from src.core.database import SessionLocal, init_db
from src.models.base import (
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
from src.models.requirement import (
    DataTask,
    OperationsTask,
    PipelineRun,
    Requirement,
)


# ─── 语料库：用于让随机数据读起来接近真实场景 ──────────────────────────────

SCENES = [
    ("夜间十字路口 VRU Hard-Case 补采", ["夜间", "十字路口", "VRU"]),
    ("隧道入口强光鬼影专项", ["隧道", "强光", "逆光"]),
    ("雨天高速切入 Corner Case 闭环", ["雨天", "高速", "切入"]),
    ("复杂路口无保护左转数据补强", ["路口", "左转", "无保护"]),
    ("停车场低速遮挡识别", ["停车场", "低速", "遮挡"]),
]

TASK_TITLES = {
    TaskType.COLLECTION: [
        "实车采集 - 北京四环", "实车采集 - 沪蓉段", "实车采集 - G2 京沪",
        "实车采集 - 深圳南环", "实车采集 - 杭州湾",
    ],
    TaskType.MINING: [
        "难例挖掘 - 夜间 VRU", "相似度采样 - 切入场景", "Tag 召回 - 雨天高速",
    ],
    TaskType.TAGGING: [
        "夜间 VRU 场景 tag 覆盖", "雨天高速属性 tag 复盘", "切入事件 tag 反查",
    ],
    TaskType.LABELING: [
        "2D Bbox 标注", "3D 点云融合标注", "语义分割标注",
        "车道线标注", "多目标追踪标注",
    ],
    TaskType.CHECKING: [
        "交叉质检", "抽样复核", "自动校验",
    ],
    TaskType.RELEASE: [
        "Dataset 发版 - v1", "Customized → Official 提级", "训练集冻结发布",
    ],
}

OPS_TITLES = {
    OperationsModule.LABELING: ["人工标注派单", "自动预标注 + 复核"],
    OperationsModule.TAGGING: ["场景标签应用", "属性打标"],
    OperationsModule.CHECKING: ["质量门禁", "校准回检"],
    OperationsModule.MINING: ["难例挖掘", "相似度采样"],
    OperationsModule.PRIVACY: ["人脸打码", "车牌脱敏"],
    OperationsModule.RELEASE: ["数据集草稿", "版本发布"],
}

PIPELINE_NAMES = [
    "raw_to_clip", "clip_to_feature", "feature_to_dataset",
    "streaming_ingest", "qc_gate", "replay_pipeline",
]


# ─── 随机化参数 ────────────────────────────────────────────────────────────

DEFAULT_DATA_TASKS_RANGE = (3, 4)       # 每个需求拆多少条 DataTask
DEFAULT_OPS_RANGE = (1, 3)              # 每个 DataTask 衍生多少条 OperationsTask
DEFAULT_RUNS_RANGE = (1, 3)             # 每个 OperationsTask 归属多少条 PipelineRun


# ─── 工具 ──────────────────────────────────────────────────────────────────


def _new_trace_id() -> str:
    return f"trace_{uuid.uuid4().hex[:12]}"


def _choice(lst: list[Any]) -> Any:
    return random.choice(lst)


def _weighted_status(options: list[tuple[Any, float]]) -> Any:
    values, weights = zip(*options, strict=True)
    return random.choices(values, weights=weights, k=1)[0]


def _random_time_pair(hours_back_max: int = 72) -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    started = now - timedelta(hours=random.randint(1, hours_back_max))
    ended = started + timedelta(minutes=random.randint(5, 240))
    return started, ended


# ─── 主播种逻辑 ────────────────────────────────────────────────────────────


def reset_demo(db) -> None:
    """清空本脚本生成的数据（依据 x_trace_id 前缀 ``trace_``）。"""
    runs = db.query(PipelineRun).filter(PipelineRun.x_trace_id.like("trace_%")).all()
    ops = db.query(OperationsTask).filter(OperationsTask.x_trace_id.like("trace_%")).all()
    dts = db.query(DataTask).filter(DataTask.x_trace_id.like("trace_%")).all()
    req_ids = {dt.requirement_id for dt in dts}
    for obj in runs + ops + dts:
        db.delete(obj)
    db.flush()
    if req_ids:
        reqs = db.query(Requirement).filter(Requirement.id.in_(req_ids)).all()
        for r in reqs:
            db.delete(r)
    db.commit()


def seed_chain(db, seq: int) -> dict[str, Any]:
    """为一个需求生成整条 4 层链路，所有对象共享同一个 ``x_trace_id``。"""
    scene_title, tags = _choice(SCENES)
    x_trace_id = _new_trace_id()

    # ── Layer 1: Requirement ─────────────────────────────────────────────
    req = Requirement(
        title=f"[Demo#{seq}] {scene_title}",
        description=f"随机生成的 Demo 需求，x_trace_id={x_trace_id}",
        priority=_choice([Priority.HIGH, Priority.MEDIUM, Priority.LOW]),
        source=_choice(list(RequirementSource)),
        status=_weighted_status([
            (RequirementStatus.APPROVED, 0.5),
            (RequirementStatus.IN_PROGRESS, 0.3),
            (RequirementStatus.COMPLETED, 0.2),
        ]),
        dre_owner=_choice(["zhangsan@example.com", "lisi@example.com", "wangwu@example.com"]),
        target_scene=scene_title,
        scene_tags=tags,
        vehicle_tags=_choice([["L4"], ["L2+", "L4"], ["L4", "乘用车"]]),
        estimated_data_volume=random.choice([2000, 5000, 10000]),
    )
    db.add(req)
    db.flush()

    summary = {
        "x_trace_id": x_trace_id,
        "requirement_id": req.id,
        "title": req.title,
        "data_tasks": [],
    }

    # ── Layer 2: DataTask ────────────────────────────────────────────────
    dt_count = random.randint(*DEFAULT_DATA_TASKS_RANGE)
    for _ in range(dt_count):
        dt_type = _choice(list(TaskType))
        dt = DataTask(
            requirement_id=req.id,
            title=_choice(TASK_TITLES[dt_type]),
            task_type=dt_type,
            status=_weighted_status([
                (TaskStatus.IN_PROGRESS, 0.5),
                (TaskStatus.COMPLETED, 0.3),
                (TaskStatus.PENDING_SIGNOFF, 0.2),
            ]),
            sign_off_status=_weighted_status([
                (SignOffStatus.APPROVED, 0.7),
                (SignOffStatus.PENDING, 0.3),
            ]),
            assigned_to=_choice(["ops-a@example.com", "ops-b@example.com"]),
            target_count=random.choice([1000, 2000, 5000]),
            actual_count=random.randint(0, 5000),
            x_trace_id=x_trace_id,
        )
        db.add(dt)
        db.flush()
        dt_summary = {"data_task_id": dt.id, "title": dt.title, "operations_tasks": []}

        # ── Layer 3: OperationsTask ──────────────────────────────────────
        ops_count = random.randint(*DEFAULT_OPS_RANGE)
        for _ in range(ops_count):
            module = _choice(list(OperationsModule))
            started, ended = _random_time_pair()
            ops_status = _weighted_status([
                (OperationsTaskStatus.COMPLETED, 0.55),
                (OperationsTaskStatus.RUNNING, 0.25),
                (OperationsTaskStatus.FAILED, 0.1),
                (OperationsTaskStatus.SCHEDULED, 0.1),
            ])
            ops = OperationsTask(
                requirement_id=req.id,
                data_task_id=dt.id,
                module=module,
                title=_choice(OPS_TITLES[module]),
                status=ops_status,
                assigned_to=_choice(["vendor-x@example.com", "internal-team@example.com"]),
                x_trace_id=x_trace_id,
                payload={"hint": "seed demo", "module": module.value},
                started_at=started,
                completed_at=ended if ops_status == OperationsTaskStatus.COMPLETED else None,
            )
            db.add(ops)
            db.flush()
            ops_summary = {"operations_task_id": ops.id, "module": module.value, "pipeline_runs": []}

            # ── Layer 4: PipelineRun ─────────────────────────────────────
            run_count = random.randint(*DEFAULT_RUNS_RANGE)
            parent_run_trace: str | None = None
            for run_idx in range(run_count):
                run_started, run_ended = _random_time_pair()
                run_status = _weighted_status([
                    (PipelineStatus.SUCCESS, 0.6),
                    (PipelineStatus.FAILED, 0.15),
                    (PipelineStatus.RUNNING, 0.15),
                    (PipelineStatus.PENDING, 0.1),
                ])
                trigger = _weighted_status([
                    (TriggerSource.OPERATIONS_TASK, 0.55),
                    (TriggerSource.DATA_TASK, 0.25),
                    (TriggerSource.SCHEDULER, 0.1),
                    (TriggerSource.MANUAL, 0.05),
                    (TriggerSource.EXTERNAL, 0.05),
                ])
                purpose = (
                    RunPurpose.INITIAL_BUILD if run_idx == 0
                    else _choice([RunPurpose.BACKFILL, RunPurpose.REPAIR, RunPurpose.REPLAY, RunPurpose.REINDEX])
                )
                # ── Quality gate result ──
                if run_status == PipelineStatus.FAILED:
                    gate_result = "block"
                    gate_reason = _choice([
                        "schema_mismatch", "missing_sensor", "anno_quality_low",
                        "label_count_mismatch", "duplicate_keys", "coverage_insufficient",
                    ])
                elif run_status == PipelineStatus.SUCCESS and random.random() < 0.12:
                    gate_result = "waiver"
                    gate_reason = _choice([
                        "manual_override", "policy_bypass_approved", "downstream_tolerance",
                    ])
                else:
                    gate_result = "pass"
                    gate_reason = None
                # ── Cost attribution ──
                duration_s = (run_ended - run_started).total_seconds()
                stage_multiplier = random.uniform(0.7, 1.4)
                cpu_seconds = round(duration_s * random.uniform(2.0, 6.0) * stage_multiplier, 2)
                gpu_seconds = round(
                    duration_s * random.uniform(0.0, 2.5) * stage_multiplier, 2
                ) if random.random() < 0.5 else 0.0
                storage_gb = round(random.uniform(0.1, 12.0), 3)
                # rough $ formula: cpu @ $0.00003/s, gpu @ $0.00025/s, storage @ $0.02/GB-day
                cost_usd = round(
                    cpu_seconds * 0.00003 + gpu_seconds * 0.00025 + storage_gb * 0.02,
                    4,
                )
                run = PipelineRun(
                    data_task_id=dt.id,
                    pipeline_name=_choice(PIPELINE_NAMES),
                    stage=_choice(["collect", "clip-extract", "feature-compute", "release"]),
                    input_uri=f"data/raw/demo/{req.id[:8]}/{dt.id[:8]}/in.parquet",
                    output_uri=f"data/assets/demo/{req.id[:8]}/{dt.id[:8]}/out.parquet",
                    status=run_status,
                    config={"purpose": purpose.value, "retry": run_idx},
                    metrics={
                        "rows_in": random.randint(1_000, 100_000),
                        "rows_out": random.randint(1_000, 100_000),
                        "duration_s": duration_s,
                        # quality
                        "gate_result": gate_result,
                        "gate_reason": gate_reason,
                        # cost
                        "cpu_seconds": cpu_seconds,
                        "gpu_seconds": gpu_seconds,
                        "storage_gb": storage_gb,
                        "cost_usd": cost_usd,
                    },
                    started_at=run_started,
                    completed_at=run_ended if run_status in {PipelineStatus.SUCCESS, PipelineStatus.FAILED} else None,
                    # ── 链路追踪字段 ──
                    x_trace_id=x_trace_id,
                    trace_parent_id=parent_run_trace or ops.id,
                    requirement_id=req.id,
                    operations_task_id=ops.id,
                    trigger_source=trigger,
                    run_purpose=purpose,
                )
                db.add(run)
                db.flush()
                parent_run_trace = run.id
                ops_summary["pipeline_runs"].append({"id": run.id, "status": run_status.value})

            dt_summary["operations_tasks"].append(ops_summary)
        summary["data_tasks"].append(dt_summary)

    db.commit()
    return summary


def _print_summary(summaries: list[dict[str, Any]]) -> None:
    total_dt = sum(len(s["data_tasks"]) for s in summaries)
    total_ops = sum(len(dt["operations_tasks"]) for s in summaries for dt in s["data_tasks"])
    total_runs = sum(
        len(op["pipeline_runs"])
        for s in summaries
        for dt in s["data_tasks"]
        for op in dt["operations_tasks"]
    )
    print("─" * 72)
    print("全链路 Demo 数据生成完成")
    print("─" * 72)
    print(f"Requirements: {len(summaries)}   DataTasks: {total_dt}   "
          f"OperationsTasks: {total_ops}   PipelineRuns: {total_runs}")
    print()
    print(f"{'#':<3} {'x_trace_id':<22} {'requirement_id':<38} title")
    print("─" * 72)
    for idx, s in enumerate(summaries, 1):
        print(f"{idx:<3} {s['x_trace_id']:<22} {s['requirement_id']:<38} {s['title']}")
    print("─" * 72)
    print("验证示例：")
    if summaries:
        sample = summaries[0]["x_trace_id"]
        print(f"  curl 'http://localhost:8000/api/v1/pipeline-runs?x_trace_id={sample}'")
        print(f"  curl 'http://localhost:8000/api/v1/trace/{sample}'")
    print("─" * 72)


def main() -> None:
    parser = argparse.ArgumentParser(description="全链路追踪 Demo 数据播种")
    parser.add_argument("--requirements", type=int, default=2,
                        help="生成的需求数量（默认 2）")
    parser.add_argument("--seed", type=int, default=None,
                        help="随机种子（便于复现）")
    parser.add_argument("--reset", action="store_true",
                        help="先清空本脚本生成的旧数据（匹配 x_trace_id 前缀 trace_）")
    args = parser.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    init_db()

    db = SessionLocal()
    try:
        if args.reset:
            print("→ 正在清空旧 demo 数据...")
            reset_demo(db)
        summaries = [seed_chain(db, seq=i + 1) for i in range(args.requirements)]
        _print_summary(summaries)
    except Exception as exc:   # noqa: BLE001
        db.rollback()
        print(f"[Error] 播种失败: {exc}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
