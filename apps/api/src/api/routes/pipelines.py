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
    PipelineStage,
    PipelineStatus,
    ReconstructionLayer,
)
from src.models.requirement import (
    AnnotationTask,
    CollectionJob,
    DataTask,
    DigitalReconstruction,
    PipelineRun,
)
from src.schemas.requirement import (
    AnnotationTaskCreate,
    AnnotationTaskResponse,
    AnnotationTaskUpdate,
    CollectionJobCreate,
    CollectionJobResponse,
    CollectionJobUpdate,
    PipelineRunCreate,
    PipelineRunResponse,
    PipelineRunUpdate,
    ReconstructionCreate,
    ReconstructionResponse,
    ReconstructionUpdate,
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

    对应 One-Pipeline 的数据加工流转：
    原始采集包(Bronze) → 切片(Silver) → 特征(Silver) → 发版数据集(Gold)
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
    stage: PipelineStage | None = Query(None),
    status: PipelineStatus | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """查询流水线运行列表"""
    query = db.query(PipelineRun)
    if data_task_id:
        query = query.filter(PipelineRun.data_task_id == data_task_id)
    if stage:
        query = query.filter(PipelineRun.stage == stage)
    if status:
        query = query.filter(PipelineRun.status == status)
    return query.order_by(PipelineRun.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()


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


@router.get("/pipeline-runs/stage-stats")
def get_pipeline_stage_stats(db: Session = Depends(get_db)):
    """流水线阶段统计

    按阶段（Bronze → Silver → Gold）和状态维度统计运行情况，
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
