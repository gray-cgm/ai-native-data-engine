"""数据采集、标注、流水线加工与物理世界还原 API 路由

覆盖数据闭环的执行层：
- 物理世界还原目标管理（三层模型的 CRUD + 覆盖率统计）
- 数据采集作业管理
- 标注任务管理（含 TPI 人效统计）
- 流水线运行管理（One-Pipeline 对接）
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.models.base import (
    AnnotationStatus,
    CollectionStatus,
    CoverageStatus,
    OperationsModule,
    OperationsTaskStatus,
    PipelineStatus,
    ReconstructionLayer,
    RunPurpose,
    TriggerSource,
)
from src.models.requirement import (
    AnnotationTask,
    CollectionJob,
    DataTask,
    DigitalReconstruction,
    OperationsTask,
    PipelineRun,
    Requirement,
)
from src.schemas.requirement import (
    AnnotationTaskCreate,
    AnnotationTaskResponse,
    AnnotationTaskUpdate,
    CollectionJobCreate,
    CollectionJobResponse,
    CollectionJobUpdate,
    OperationsTaskCreate,
    OperationsTaskResponse,
    OperationsTaskUpdate,
    PipelineRunCreate,
    PipelineRunResponse,
    PipelineRunUpdate,
    ReconstructionCreate,
    ReconstructionResponse,
    ReconstructionUpdate,
    RunBreadcrumb,
)

router = APIRouter(prefix="/api/v1", tags=["数据加工与治理"])


# ═══════════════════════════ 物理世界还原 ═══════════════════════════


@router.post("/reconstructions", response_model=ReconstructionResponse, status_code=201)
def create_reconstruction(
    payload: ReconstructionCreate, db: Session = Depends(get_db)
):
    """创建数字化还原目标

    将数据任务与具体的传感器/数据源还原目标绑定，
    对应 T0 时刻物理世界快照的三层模型。
    """
    task = db.query(DataTask).filter(DataTask.id == payload.data_task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="关联的数据任务不存在")
    recon = DigitalReconstruction(**payload.model_dump())
    db.add(recon)
    db.commit()
    db.refresh(recon)
    return recon


@router.get("/reconstructions", response_model=list[ReconstructionResponse])
def list_reconstructions(
    data_task_id: str | None = Query(None),
    layer: ReconstructionLayer | None = Query(None, description="按还原层级过滤"),
    coverage_status: CoverageStatus | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """查询还原目标列表"""
    query = db.query(DigitalReconstruction)
    if data_task_id:
        query = query.filter(DigitalReconstruction.data_task_id == data_task_id)
    if layer:
        query = query.filter(DigitalReconstruction.reconstruction_layer == layer)
    if coverage_status:
        query = query.filter(DigitalReconstruction.coverage_status == coverage_status)
    return query.offset((page - 1) * page_size).limit(page_size).all()


@router.patch("/reconstructions/{recon_id}", response_model=ReconstructionResponse)
def update_reconstruction(
    recon_id: str, payload: ReconstructionUpdate, db: Session = Depends(get_db)
):
    """更新还原目标（如覆盖状态变更）"""
    recon = db.query(DigitalReconstruction).filter(DigitalReconstruction.id == recon_id).first()
    if not recon:
        raise HTTPException(status_code=404, detail="还原目标不存在")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(recon, field, value)
    db.commit()
    db.refresh(recon)
    return recon


@router.get("/reconstructions/coverage-stats")
def get_coverage_stats(db: Session = Depends(get_db)):
    """物理世界还原覆盖率统计

    按三层模型和传感器目标维度统计覆盖进度，
    服务于"物理世界数字化还原"全景看板。
    """
    stats = (
        db.query(
            DigitalReconstruction.reconstruction_layer,
            DigitalReconstruction.sensor_target,
            DigitalReconstruction.coverage_status,
            sa_func.count(DigitalReconstruction.id),
        )
        .group_by(
            DigitalReconstruction.reconstruction_layer,
            DigitalReconstruction.sensor_target,
            DigitalReconstruction.coverage_status,
        )
        .all()
    )
    result: dict = {}
    for layer, sensor, status, count in stats:
        result.setdefault(layer, {}).setdefault(sensor, {})[status] = count
    return result


# ═══════════════════════════ 数据采集 ═══════════════════════════


@router.post("/collection-jobs", response_model=CollectionJobResponse, status_code=201)
def create_collection_job(
    payload: CollectionJobCreate, db: Session = Depends(get_db)
):
    """创建数据采集作业"""
    task = db.query(DataTask).filter(DataTask.id == payload.data_task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="关联的数据任务不存在")
    job = CollectionJob(**payload.model_dump())
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.get("/collection-jobs", response_model=list[CollectionJobResponse])
def list_collection_jobs(
    data_task_id: str | None = Query(None),
    status: CollectionStatus | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """查询采集作业列表"""
    query = db.query(CollectionJob)
    if data_task_id:
        query = query.filter(CollectionJob.data_task_id == data_task_id)
    if status:
        query = query.filter(CollectionJob.status == status)
    return query.offset((page - 1) * page_size).limit(page_size).all()


@router.patch("/collection-jobs/{job_id}", response_model=CollectionJobResponse)
def update_collection_job(
    job_id: str, payload: CollectionJobUpdate, db: Session = Depends(get_db)
):
    """更新采集作业状态"""
    job = db.query(CollectionJob).filter(CollectionJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="采集作业不存在")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(job, field, value)
    db.commit()
    db.refresh(job)
    return job


# ═══════════════════════════ 数据标注 ═══════════════════════════


@router.post("/annotation-tasks", response_model=AnnotationTaskResponse, status_code=201)
def create_annotation_task(
    payload: AnnotationTaskCreate, db: Session = Depends(get_db)
):
    """创建标注任务"""
    task = db.query(DataTask).filter(DataTask.id == payload.data_task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="关联的数据任务不存在")
    anno = AnnotationTask(**payload.model_dump())
    db.add(anno)
    db.commit()
    db.refresh(anno)
    return anno


@router.get("/annotation-tasks", response_model=list[AnnotationTaskResponse])
def list_annotation_tasks(
    data_task_id: str | None = Query(None),
    status: AnnotationStatus | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """查询标注任务列表"""
    query = db.query(AnnotationTask)
    if data_task_id:
        query = query.filter(AnnotationTask.data_task_id == data_task_id)
    if status:
        query = query.filter(AnnotationTask.status == status)
    return query.offset((page - 1) * page_size).limit(page_size).all()


@router.patch("/annotation-tasks/{anno_id}", response_model=AnnotationTaskResponse)
def update_annotation_task(
    anno_id: str, payload: AnnotationTaskUpdate, db: Session = Depends(get_db)
):
    """更新标注任务"""
    anno = db.query(AnnotationTask).filter(AnnotationTask.id == anno_id).first()
    if not anno:
        raise HTTPException(status_code=404, detail="标注任务不存在")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(anno, field, value)
    db.commit()
    db.refresh(anno)
    return anno


@router.get("/annotation-tasks/tpi-stats")
def get_tpi_stats(
    data_task_id: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """标注人效 TPI 统计

    返回按标注类型和供应商维度的人效指标聚合数据，
    支持细粒度的人效分析和供应商评估。
    """
    query = db.query(
        AnnotationTask.annotation_type,
        AnnotationTask.annotation_vendor,
        sa_func.avg(AnnotationTask.tpi_score).label("avg_tpi"),
        sa_func.count(AnnotationTask.id).label("task_count"),
        sa_func.sum(AnnotationTask.total_objects).label("total_objects"),
    )
    if data_task_id:
        query = query.filter(AnnotationTask.data_task_id == data_task_id)
    query = query.filter(AnnotationTask.tpi_score.isnot(None))
    results = query.group_by(
        AnnotationTask.annotation_type, AnnotationTask.annotation_vendor
    ).all()
    return [
        {
            "annotation_type": r.annotation_type,
            "vendor": r.annotation_vendor,
            "avg_tpi": round(r.avg_tpi, 2) if r.avg_tpi else None,
            "task_count": r.task_count,
            "total_objects": r.total_objects,
        }
        for r in results
    ]


# ═══════════════════════════ 流水线加工 ═══════════════════════════


@router.post("/pipeline-runs", response_model=PipelineRunResponse, status_code=201)
def create_pipeline_run(
    payload: PipelineRunCreate, db: Session = Depends(get_db)
):
    """创建流水线运行

    对应 One-Pipeline 的数据加工流转（v3）：
    采集 → 切片 → 特征/质检 → 发版（每个 step 自由命名；血缘走 Asset / DatasetSnapshotManifest）
    """
    task = db.query(DataTask).filter(DataTask.id == payload.data_task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="关联的数据任务不存在")
    run = PipelineRun(**payload.model_dump())
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


@router.get("/pipeline-runs", response_model=list[PipelineRunResponse])
def list_pipeline_runs(
    data_task_id: str | None = Query(None),
    requirement_id: str | None = Query(None, description="按需求过滤（全链路）"),
    operations_task_id: str | None = Query(None, description="按运维任务过滤"),
    x_trace_id: str | None = Query(None, description="按链路追踪键过滤（X-Trace-Id）"),
    stage: str | None = Query(None, description="按 step 名过滤（自由文本）"),
    status: PipelineStatus | None = Query(None),
    trigger_source: TriggerSource | None = Query(None),
    run_purpose: RunPurpose | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """查询流水线运行列表（支持全链路筛选：x_trace_id / requirement_id / operations_task_id）"""
    query = db.query(PipelineRun)
    if data_task_id:
        query = query.filter(PipelineRun.data_task_id == data_task_id)
    if requirement_id:
        query = query.filter(PipelineRun.requirement_id == requirement_id)
    if operations_task_id:
        query = query.filter(PipelineRun.operations_task_id == operations_task_id)
    if x_trace_id:
        query = query.filter(PipelineRun.x_trace_id == x_trace_id)
    if stage:
        query = query.filter(PipelineRun.stage == stage)
    if status:
        query = query.filter(PipelineRun.status == status)
    if trigger_source:
        query = query.filter(PipelineRun.trigger_source == trigger_source)
    if run_purpose:
        query = query.filter(PipelineRun.run_purpose == run_purpose)
    return query.order_by(PipelineRun.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()


@router.get("/pipeline-runs/{run_id}", response_model=RunBreadcrumb)
def get_pipeline_run_breadcrumb(run_id: str, db: Session = Depends(get_db)):
    """获取 PipelineRun 详情 + 全链路面包屑（Req → DT → Ops → Run）。"""
    run = db.query(PipelineRun).filter(PipelineRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="流水线运行记录不存在")

    dt = db.query(DataTask).filter(DataTask.id == run.data_task_id).first()
    req = None
    if run.requirement_id:
        req = db.query(Requirement).filter(Requirement.id == run.requirement_id).first()
    elif dt:
        req = db.query(Requirement).filter(Requirement.id == dt.requirement_id).first()
    ops = None
    if run.operations_task_id:
        ops = db.query(OperationsTask).filter(OperationsTask.id == run.operations_task_id).first()

    def _summ(obj, fields):
        return {f: getattr(obj, f, None) for f in fields} if obj else None

    return RunBreadcrumb(
        requirement=_summ(req, ["id", "title", "priority", "status", "dre_owner"]),
        data_task=_summ(dt, ["id", "title", "task_type", "status", "sign_off_status"]),
        operations_task=_summ(ops, ["id", "title", "module", "status", "assigned_to", "x_trace_id"]),
        run={
            "id": run.id,
            "pipeline_name": run.pipeline_name,
            "stage": run.stage,
            "status": run.status,
            "x_trace_id": run.x_trace_id,
            "trace_parent_id": run.trace_parent_id,
            "trigger_source": run.trigger_source,
            "run_purpose": run.run_purpose,
            "input_uri": run.input_uri,
            "output_uri": run.output_uri,
            "metrics": run.metrics,
            "started_at": run.started_at.isoformat() if run.started_at else None,
            "completed_at": run.completed_at.isoformat() if run.completed_at else None,
            "created_at": run.created_at.isoformat() if run.created_at else None,
        },
    )


@router.patch("/pipeline-runs/{run_id}", response_model=PipelineRunResponse)
def update_pipeline_run(
    run_id: str, payload: PipelineRunUpdate, db: Session = Depends(get_db)
):
    """更新流水线运行状态"""
    run = db.query(PipelineRun).filter(PipelineRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="流水线运行记录不存在")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(run, field, value)
    db.commit()
    db.refresh(run)
    return run


@router.get("/pipeline-stats/stages")
def get_pipeline_stage_stats(db: Session = Depends(get_db)):
    """流水线阶段统计

    按 step 名（自由文本，如 collect / clip-extract / feature-compute / release）和状态维度统计运行情况，
    服务于 One-Pipeline 执行监控看板。
    """
    stats = (
        db.query(
            PipelineRun.stage,
            PipelineRun.status,
            sa_func.count(PipelineRun.id),
        )
        .group_by(PipelineRun.stage, PipelineRun.status)
        .all()
    )
    result: dict = {}
    for stage, status, count in stats:
        result.setdefault(stage, {})[status] = count
    return result


@router.get("/pipeline-stats/quality")
def get_pipeline_quality_stats(db: Session = Depends(get_db)):
    """Quality gate 统计聚合

    输出：gate_result（pass/block/waiver）计数、失败原因 Top-N、按 run_purpose 分布。
    用于 Pipelines → Quality 视图。
    """
    runs = db.query(PipelineRun).all()
    by_gate: dict[str, int] = {"pass": 0, "block": 0, "waiver": 0, "unknown": 0}
    reason_counts: dict[str, int] = {}
    by_purpose: dict[str, dict[str, int]] = {}
    by_stage: dict[str, dict[str, int]] = {}
    total_with_metrics = 0
    for run in runs:
        metrics = run.metrics or {}
        gate = metrics.get("gate_result") or "unknown"
        by_gate[gate] = by_gate.get(gate, 0) + 1
        if metrics:
            total_with_metrics += 1
        reason = metrics.get("gate_reason")
        if reason:
            reason_counts[reason] = reason_counts.get(reason, 0) + 1
        purpose_key = run.run_purpose.value if hasattr(run.run_purpose, "value") else str(run.run_purpose)
        stage_key = run.stage.value if hasattr(run.stage, "value") else str(run.stage)
        by_purpose.setdefault(purpose_key, {"pass": 0, "block": 0, "waiver": 0, "unknown": 0})
        by_purpose[purpose_key][gate] = by_purpose[purpose_key].get(gate, 0) + 1
        by_stage.setdefault(stage_key, {"pass": 0, "block": 0, "waiver": 0, "unknown": 0})
        by_stage[stage_key][gate] = by_stage[stage_key].get(gate, 0) + 1
    top_reasons = sorted(
        ({"reason": k, "count": v} for k, v in reason_counts.items()),
        key=lambda x: x["count"],
        reverse=True,
    )[:10]
    total = len(runs)
    pass_rate = round(by_gate.get("pass", 0) / total * 100, 2) if total else 0.0
    return {
        "total_runs": total,
        "total_with_metrics": total_with_metrics,
        "pass_rate": pass_rate,
        "by_gate_result": by_gate,
        "top_failure_reasons": top_reasons,
        "by_run_purpose": by_purpose,
        "by_stage": by_stage,
    }


@router.get("/pipeline-stats/cost")
def get_pipeline_cost_stats(db: Session = Depends(get_db)):
    """Cost 归因统计聚合

    输出：总成本、按 Requirement / Pipeline / Stage 聚合，以及 CPU/GPU/Storage 汇总。
    用于 Pipelines → Cost 视图。
    """
    runs = db.query(PipelineRun).all()
    total_cost = 0.0
    total_cpu = 0.0
    total_gpu = 0.0
    total_storage = 0.0
    total_duration = 0.0
    by_requirement: dict[str, float] = {}
    by_pipeline: dict[str, float] = {}
    by_stage: dict[str, float] = {}
    by_purpose: dict[str, float] = {}
    for run in runs:
        metrics = run.metrics or {}
        cost = float(metrics.get("cost_usd") or 0.0)
        total_cost += cost
        total_cpu += float(metrics.get("cpu_seconds") or 0.0)
        total_gpu += float(metrics.get("gpu_seconds") or 0.0)
        total_storage += float(metrics.get("storage_gb") or 0.0)
        total_duration += float(metrics.get("duration_s") or 0.0)
        if run.requirement_id:
            by_requirement[run.requirement_id] = by_requirement.get(run.requirement_id, 0.0) + cost
        by_pipeline[run.pipeline_name] = by_pipeline.get(run.pipeline_name, 0.0) + cost
        stage_key = run.stage.value if hasattr(run.stage, "value") else str(run.stage)
        by_stage[stage_key] = by_stage.get(stage_key, 0.0) + cost
        purpose_key = run.run_purpose.value if hasattr(run.run_purpose, "value") else str(run.run_purpose)
        by_purpose[purpose_key] = by_purpose.get(purpose_key, 0.0) + cost

    # Enrich requirement rows with titles
    req_rows: list[dict] = []
    if by_requirement:
        req_map = {
            r.id: r.title
            for r in db.query(Requirement).filter(Requirement.id.in_(by_requirement.keys())).all()
        }
        for rid, c in by_requirement.items():
            req_rows.append({
                "requirement_id": rid,
                "title": req_map.get(rid, "—"),
                "cost_usd": round(c, 4),
            })
        req_rows.sort(key=lambda x: x["cost_usd"], reverse=True)

    return {
        "total_runs": len(runs),
        "totals": {
            "cost_usd": round(total_cost, 4),
            "cpu_seconds": round(total_cpu, 2),
            "gpu_seconds": round(total_gpu, 2),
            "storage_gb": round(total_storage, 3),
            "duration_seconds": round(total_duration, 2),
        },
        "by_requirement": req_rows,
        "by_pipeline": [
            {"pipeline_name": k, "cost_usd": round(v, 4)}
            for k, v in sorted(by_pipeline.items(), key=lambda x: x[1], reverse=True)
        ],
        "by_stage": [
            {"stage": k, "cost_usd": round(v, 4)}
            for k, v in sorted(by_stage.items(), key=lambda x: x[1], reverse=True)
        ],
        "by_run_purpose": [
            {"run_purpose": k, "cost_usd": round(v, 4)}
            for k, v in sorted(by_purpose.items(), key=lambda x: x[1], reverse=True)
        ],
    }


@router.get("/traces")
def list_recent_traces(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """列出最近的 x_trace_id（用于 Lineage 视图的下拉选择）。

    按 trace 下最新 PipelineRun.created_at 排序。
    """
    rows = (
        db.query(
            PipelineRun.x_trace_id,
            PipelineRun.requirement_id,
            sa_func.count(PipelineRun.id).label("run_count"),
            sa_func.max(PipelineRun.created_at).label("latest_at"),
        )
        .filter(PipelineRun.x_trace_id.isnot(None))
        .group_by(PipelineRun.x_trace_id, PipelineRun.requirement_id)
        .order_by(sa_func.max(PipelineRun.created_at).desc())
        .limit(limit)
        .all()
    )
    req_ids = [r.requirement_id for r in rows if r.requirement_id]
    req_map: dict[str, str] = {}
    if req_ids:
        for r in db.query(Requirement).filter(Requirement.id.in_(req_ids)).all():
            req_map[r.id] = r.title
    return {
        "items": [
            {
                "x_trace_id": r.x_trace_id,
                "requirement_id": r.requirement_id,
                "requirement_title": req_map.get(r.requirement_id or "", None),
                "run_count": int(r.run_count),
                "latest_at": r.latest_at.isoformat() if r.latest_at else None,
            }
            for r in rows
        ]
    }


# ═══════════════════════════ 运维执行任务（OperationsTask） ═══════════════════════════


@router.post("/operations-tasks", response_model=OperationsTaskResponse, status_code=201)
def create_operations_task(
    payload: OperationsTaskCreate, db: Session = Depends(get_db)
):
    """创建运维执行任务（4 层模型第 3 层：Req→DT→Ops→Run 中的 Ops）"""
    dt = db.query(DataTask).filter(DataTask.id == payload.data_task_id).first()
    if not dt:
        raise HTTPException(status_code=404, detail="关联的数据任务不存在")
    ops = OperationsTask(**payload.model_dump())
    db.add(ops)
    db.commit()
    db.refresh(ops)
    return ops


@router.get("/operations-tasks", response_model=list[OperationsTaskResponse])
def list_operations_tasks(
    requirement_id: str | None = Query(None),
    data_task_id: str | None = Query(None),
    x_trace_id: str | None = Query(None),
    module: OperationsModule | None = Query(None),
    status: OperationsTaskStatus | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """查询运维任务列表（支持 x_trace_id 全链路筛选）"""
    query = db.query(OperationsTask)
    if requirement_id:
        query = query.filter(OperationsTask.requirement_id == requirement_id)
    if data_task_id:
        query = query.filter(OperationsTask.data_task_id == data_task_id)
    if x_trace_id:
        query = query.filter(OperationsTask.x_trace_id == x_trace_id)
    if module:
        query = query.filter(OperationsTask.module == module)
    if status:
        query = query.filter(OperationsTask.status == status)
    return (
        query.order_by(OperationsTask.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )


@router.patch("/operations-tasks/{ops_id}", response_model=OperationsTaskResponse)
def update_operations_task(
    ops_id: str, payload: OperationsTaskUpdate, db: Session = Depends(get_db)
):
    """更新运维任务状态"""
    ops = db.query(OperationsTask).filter(OperationsTask.id == ops_id).first()
    if not ops:
        raise HTTPException(status_code=404, detail="运维任务不存在")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(ops, field, value)
    db.commit()
    db.refresh(ops)
    return ops


# ═══════════════════════════ 全链路追踪查询（x_trace_id） ═══════════════════════════


@router.get("/trace/{x_trace_id}")
def get_trace_chain(x_trace_id: str, db: Session = Depends(get_db)):
    """按 x_trace_id 汇聚全链路对象：Requirement → DataTask → OperationsTask → PipelineRun。

    用于 Pipelines 页的"按链路筛选"与 RunDetail 抽屉面包屑聚合。
    """
    data_tasks = db.query(DataTask).filter(DataTask.x_trace_id == x_trace_id).all()
    ops_tasks = db.query(OperationsTask).filter(OperationsTask.x_trace_id == x_trace_id).all()
    runs = db.query(PipelineRun).filter(PipelineRun.x_trace_id == x_trace_id).all()

    req_ids: set[str] = set()
    for dt in data_tasks:
        req_ids.add(dt.requirement_id)
    for ops in ops_tasks:
        req_ids.add(ops.requirement_id)
    for run in runs:
        if run.requirement_id:
            req_ids.add(run.requirement_id)

    requirements = (
        db.query(Requirement).filter(Requirement.id.in_(req_ids)).all() if req_ids else []
    )

    def _dump(obj, fields):
        return {f: getattr(obj, f, None) for f in fields}

    return {
        "x_trace_id": x_trace_id,
        "requirements": [
            _dump(r, ["id", "title", "priority", "status", "dre_owner"]) for r in requirements
        ],
        "data_tasks": [
            _dump(d, ["id", "requirement_id", "title", "task_type", "status", "x_trace_id"])
            for d in data_tasks
        ],
        "operations_tasks": [
            _dump(o, ["id", "requirement_id", "data_task_id", "title", "module", "status", "x_trace_id"])
            for o in ops_tasks
        ],
        "pipeline_runs": [
            _dump(
                r,
                [
                    "id", "requirement_id", "data_task_id", "operations_task_id",
                    "pipeline_name", "stage", "status", "trigger_source", "run_purpose",
                    "x_trace_id", "trace_parent_id",
                ],
            )
            for r in runs
        ],
    }
