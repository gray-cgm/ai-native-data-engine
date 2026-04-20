"""数据任务与 Sign-off 审批 API 路由

核心业务逻辑：
- 数据任务由需求拆解而来，必须关联到已存在的 Requirement
- Sign-off 是大数据团队的资源看门机制：
  * 批准后任务进入 in_progress 状态
  * 拒绝后任务进入 blocked 状态，需求方需修改后重新提交
- 批量 Sign-off 支持一次性审批同一需求下的多个任务
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.models.base import SignOffStatus, TaskStatus, TaskType
from src.models.requirement import DataTask, Requirement
from src.schemas.requirement import (
    DataTaskCreate,
    DataTaskResponse,
    DataTaskUpdate,
    SignOffRequest,
)

router = APIRouter(prefix="/api/v1/data-tasks", tags=["数据任务"])


@router.post("", response_model=DataTaskResponse, status_code=201)
def create_data_task(payload: DataTaskCreate, db: Session = Depends(get_db)):
    """创建数据任务（从需求拆解）

    业务规则：
    - 必须关联到已存在的需求
    - 新任务默认 status=draft, sign_off_status=pending
    - 创建后需提交 Sign-off 审批才能开始执行
    """
    req = db.query(Requirement).filter(Requirement.id == payload.requirement_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="关联的需求不存在")
    task = DataTask(**payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get("", response_model=list[DataTaskResponse])
def list_data_tasks(
    requirement_id: str | None = Query(None, description="按需求 ID 过滤"),
    task_type: TaskType | None = Query(None, description="按任务类型过滤"),
    status: TaskStatus | None = Query(None, description="按任务状态过滤"),
    sign_off_status: SignOffStatus | None = Query(None, description="按 Sign-off 状态过滤"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """分页查询数据任务（支持多维度过滤）"""
    query = db.query(DataTask)
    if requirement_id:
        query = query.filter(DataTask.requirement_id == requirement_id)
    if task_type:
        query = query.filter(DataTask.task_type == task_type)
    if status:
        query = query.filter(DataTask.status == status)
    if sign_off_status:
        query = query.filter(DataTask.sign_off_status == sign_off_status)
    query = query.order_by(DataTask.created_at.desc())
    return query.offset((page - 1) * page_size).limit(page_size).all()


@router.get("/{task_id}", response_model=DataTaskResponse)
def get_data_task(task_id: str, db: Session = Depends(get_db)):
    """获取数据任务详情"""
    task = db.query(DataTask).filter(DataTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="数据任务不存在")
    return task


@router.patch("/{task_id}", response_model=DataTaskResponse)
def update_data_task(
    task_id: str, payload: DataTaskUpdate, db: Session = Depends(get_db)
):
    """更新数据任务（部分更新）"""
    task = db.query(DataTask).filter(DataTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="数据任务不存在")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return task


# ═══════════════════════════ Sign-off 审批 ═══════════════════════════


@router.post("/{task_id}/sign-off", response_model=DataTaskResponse)
def sign_off_data_task(
    task_id: str, payload: SignOffRequest, db: Session = Depends(get_db)
):
    """大数据团队 Sign-off 审批

    业务规则：
    - 只有 sign_off_status=pending 的任务才能被审批
    - 批准 → sign_off_status=approved, status=in_progress
    - 拒绝 → sign_off_status=rejected, status=blocked
    - 记录审批人、时间和意见，作为审计依据
    """
    task = db.query(DataTask).filter(DataTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="数据任务不存在")
    if task.sign_off_status != SignOffStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"任务当前 Sign-off 状态为 {task.sign_off_status}，无法重复审批",
        )

    task.sign_off_by = payload.sign_off_by
    task.sign_off_at = datetime.now(timezone.utc)
    task.sign_off_comment = payload.comment

    if payload.approved:
        task.sign_off_status = SignOffStatus.APPROVED
        task.status = TaskStatus.IN_PROGRESS
    else:
        task.sign_off_status = SignOffStatus.REJECTED
        task.status = TaskStatus.BLOCKED

    db.commit()
    db.refresh(task)
    return task


@router.post("/batch-sign-off")
def batch_sign_off(
    task_ids: list[str],
    payload: SignOffRequest,
    db: Session = Depends(get_db),
):
    """批量 Sign-off：一次性审批多个数据任务

    适用场景：同一需求下拆解的多个任务同时通过评审
    """
    tasks = db.query(DataTask).filter(DataTask.id.in_(task_ids)).all()
    if len(tasks) != len(task_ids):
        found_ids = {t.id for t in tasks}
        missing = [tid for tid in task_ids if tid not in found_ids]
        raise HTTPException(status_code=404, detail=f"以下任务不存在：{missing}")

    results = []
    for task in tasks:
        if task.sign_off_status != SignOffStatus.PENDING:
            results.append({"id": task.id, "skipped": True, "reason": f"状态为 {task.sign_off_status}"})
            continue
        task.sign_off_by = payload.sign_off_by
        task.sign_off_at = datetime.now(timezone.utc)
        task.sign_off_comment = payload.comment
        if payload.approved:
            task.sign_off_status = SignOffStatus.APPROVED
            task.status = TaskStatus.IN_PROGRESS
        else:
            task.sign_off_status = SignOffStatus.REJECTED
            task.status = TaskStatus.BLOCKED
        results.append({"id": task.id, "skipped": False, "new_status": task.sign_off_status})

    db.commit()
    return {"processed": len(results), "results": results}


@router.post("/{task_id}/reset-sign-off", response_model=DataTaskResponse)
def reset_sign_off(task_id: str, db: Session = Depends(get_db)):
    """重置 Sign-off 状态（仅限被拒绝的任务）

    业务规则：需求方修改后可重新提交审批，只有 rejected 状态的任务允许重置
    """
    task = db.query(DataTask).filter(DataTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="数据任务不存在")
    if task.sign_off_status != SignOffStatus.REJECTED:
        raise HTTPException(status_code=400, detail="只有被拒绝的任务才能重新提交审批")

    task.sign_off_status = SignOffStatus.PENDING
    task.sign_off_by = None
    task.sign_off_at = None
    task.sign_off_comment = None
    task.status = TaskStatus.PENDING_SIGNOFF

    db.commit()
    db.refresh(task)
    return task
