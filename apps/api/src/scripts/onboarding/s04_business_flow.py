"""04 · 业务领域层（Requirement → DataTask → OperationsTask）

🎯 目标
   学会「四层闭环对象」前 3 层的写法：业务承诺 → 业务里程碑 → 运营协调单元。

📖 知识点
   - 一切从 Requirement（业务需求）起步
   - 自动拆 4 条 DataTask（collection / annotation / quality_check / pipeline）
   - 每条 DataTask 走 sign-off 流程才能进入执行
   - OperationsTask 是 5 子域（mining/labeling/tagging/checking/release）的协调单元
   - 全部对象共享同一个 ``x_trace_id``——后续视图都能按 trace 反查
   - SQLAlchemy 模型见 ``apps/api/src/models/requirement.py`` / ``ops_item.py``

🚀 跑法
   uv run --package api python -m src.scripts.onboarding.s04_business_flow
   uv run --package api python -m src.scripts.onboarding.s04_business_flow --reset
"""

from __future__ import annotations

import argparse
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from src.core.database import SessionLocal, init_db
from src.models.base import (
    OperationsModule,
    OperationsTaskStatus,
    Priority,
    RequirementSource,
    RequirementStatus,
    SignOffStatus,
    TaskStatus,
    TaskType,
)
from src.models.requirement import (
    DataTask,
    OperationsTask,
    Requirement,
)

from src.scripts.onboarding._console import banner, done, end_banner, hr, info, kv, step, warn


def main(reset: bool) -> None:
    banner(
        "04 · 业务领域层",
        "Requirement → DataTask × 4（sign-off）→ OperationsTask（mining）",
    )

    init_db()
    db = SessionLocal()

    try:
        if reset:
            # 清掉本 demo 之前留下的数据（标识用 trace_onb_ 前缀）
            removed = (
                db.query(Requirement)
                .filter(Requirement.title.like("[ONB-04]%"))
                .all()
            )
            for r in removed:
                db.delete(r)  # cascade 删 4 条 DataTask
            db.commit()
            warn(f"reset：清理 {len(removed)} 条历史 Requirement")

        # ─── Step 1：生成 trace_id 串通本次 demo ─────────────────
        step(1, "生成 x_trace_id", "全链路追踪键，所有写入对象都带它")
        trace_id = f"trace_onb_{uuid.uuid4().hex[:8]}"
        kv("x_trace_id", trace_id)

        # ─── Step 2：写 Requirement ──────────────────────────────
        step(2, "create Requirement", "业务承诺：一句话目标 + scene_tags + due_date + DRE owner")
        req = Requirement(
            title="[ONB-04] 夜间路口 VRU 召回率提升 demo",
            description="onboarding 演示：业务方诉求「夜间路口 VRU 召回率从 88% → 95%」",
            priority=Priority.HIGH,
            source=RequirementSource.DRE,
            status=RequirementStatus.IN_PROGRESS,
            dre_owner="dre-onboarding@example.com",
            target_scene="夜间路口 VRU",
            scene_tags=["nighttime", "intersection", "vru"],
            vehicle_tags=["L4", "passenger"],
            estimated_data_volume=5000,
            due_date=date.today() + timedelta(days=14),
        )
        db.add(req)
        db.flush()
        kv("requirement.id", req.id)
        kv("requirement.title", req.title)
        kv("requirement.scene_tags", req.scene_tags)

        # ─── Step 3：自动拆 6 条 DataTask ─────────────────────────
        step(3, "拆 6 条 DataTask", "task_type 是固定 6 类（collection / mining / tagging / labeling / checking / release），每条独立 sign-off")

        task_specs = [
            (TaskType.COLLECTION, "夜间路口路采 800 km", 800),
            (TaskType.MINING, "夜间 VRU 难例挖掘 5000 clip", 5000),
            (TaskType.TAGGING, "夜间 VRU 场景 tag 覆盖（auto-tagger + 人工抽检）", 5000),
            (TaskType.LABELING, "VRU 优先标注 5000 帧（2D bbox + 朝向 + 遮挡）", 5000),
            (TaskType.CHECKING, "夜间 VRU 召回率验收 ≥ 95%", 1),
            (TaskType.RELEASE, "训练集 v1 发版", 1),
        ]
        data_tasks: list[DataTask] = []
        for task_type, title, target in task_specs:
            dt = DataTask(
                requirement_id=req.id,
                title=title,
                description=f"由需求 {req.id[:8]} 自动拆出",
                task_type=task_type,
                status=TaskStatus.PENDING_SIGNOFF,
                sign_off_status=SignOffStatus.PENDING,
                target_count=target,
                actual_count=0,
                due_date=req.due_date,
                x_trace_id=trace_id,
            )
            db.add(dt)
            data_tasks.append(dt)
        db.flush()

        for dt in data_tasks:
            kv(dt.task_type, f"{dt.title} (sign_off={dt.sign_off_status})")

        # ─── Step 4：sign-off 流程 ────────────────────────────────
        step(4, "sign-off", "大数据团队对每条 DataTask 签字 → 推到 in_progress")
        for dt in data_tasks:
            dt.sign_off_status = SignOffStatus.APPROVED
            dt.sign_off_by = "data-lead@example.com"
            dt.sign_off_at = datetime.now(timezone.utc)
            dt.sign_off_comment = "onboarding demo: auto-approved"
            dt.status = TaskStatus.IN_PROGRESS
        db.flush()
        done(f"4 条 DataTask 全部 APPROVED")

        # ─── Step 5：写一个 Mining OperationsTask ────────────────
        step(5, "create OperationsTask(mining)", "运营协调单元：把 mining 工作派给某个团队")
        # mining ops_task 现在挂在 mining DataTask 下（与 collection 平行的"数据筹备"动作）
        mining_dt = next(d for d in data_tasks if d.task_type == TaskType.MINING)
        ops = OperationsTask(
            requirement_id=req.id,
            data_task_id=mining_dt.id,
            module=OperationsModule.MINING,
            title=f"挖掘候选 clip：{req.target_scene}",
            status=OperationsTaskStatus.RUNNING,
            assigned_to="mining-team@example.com",
            x_trace_id=trace_id,
            payload={"intent": "find night vru hard cases", "max_candidates": 25},
            started_at=datetime.now(timezone.utc),
        )
        db.add(ops)
        db.flush()
        kv("ops.id", ops.id)
        kv("ops.module", ops.module)
        kv("ops.status", ops.status)

        db.commit()

        # ─── Step 6：四层关系反查 ─────────────────────────────────
        step(6, "反查关系", "用 x_trace_id 把刚写的对象都拉出来")
        objs = (
            db.query(DataTask).filter(DataTask.x_trace_id == trace_id).all()
        )
        kv("DataTask × trace", len(objs))
        ops_objs = (
            db.query(OperationsTask).filter(OperationsTask.x_trace_id == trace_id).all()
        )
        kv("OperationsTask × trace", len(ops_objs))

        # ─── 总结 ───────────────────────────────────────────────────
        hr()
        info("📐 关键概念：")
        info("  - DataTask.task_type 是固定 6 类（collection / mining / tagging / labeling / checking / release）")
        info("  - tagging（场景级，自动化为主）与 labeling（对象级，强人工）分立，对齐 Tesla / Waymo / Cruise")
        info("  - OperationsTask.module 是 6 类（labeling / tagging / checking / mining / privacy / release）")
        info("    Privacy 默认走 pipeline 自动化，不进 ops 任务池")
        info("  - 每张 DataTask / OperationsTask 表都有 x_trace_id 列")

        info("🐛 调试：")
        info(f"  curl 'http://localhost:8000/api/v1/requirements/{req.id}'")
        info(f"  curl 'http://localhost:8000/api/v1/pipeline-runs?x_trace_id={trace_id}'")
        info(f"  open http://localhost:5173/requirements/{req.id}")

        done(f"requirement {req.id[:8]}… + 6 DataTask + 1 OpsTask · trace={trace_id}")
        info("下一步：s05_dataset_sample.py 学切样本写 customized dataset")
        end_banner("Business Flow ✓")

    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Onboarding 04: business flow")
    parser.add_argument("--reset", action="store_true",
                        help="跑前清空 [ONB-04] 开头的旧 demo 数据")
    args = parser.parse_args()
    try:
        main(args.reset)
    except Exception as exc:  # noqa: BLE001
        print(f"\n❌ {type(exc).__name__}: {exc}", file=sys.stderr)
        raise
