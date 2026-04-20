"""需求管理 API 路由

覆盖需求全生命周期：创建 → 查询 → 更新 → 统计
设计取舍：
- 列表接口支持分页 + 按状态/优先级/来源过滤，满足管理看板需求
- 详情接口一次性加载关联的 DataTask 列表（eager load），减少前端请求次数
- 统计接口提供按状态和来源的聚合视图，服务于需求看板仪表盘
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session, joinedload

from src.core.database import get_db
from src.models.requirement import DataTask, Requirement
from src.models.base import Priority, RequirementSource, RequirementStatus
from src.schemas.requirement import (
    RequirementCreate,
    RequirementDetail,
    RequirementListItem,
    RequirementResponse,
    RequirementUpdate,
)

router = APIRouter(prefix="/api/v1/requirements", tags=["需求管理"])


@router.post("", response_model=RequirementResponse, status_code=201)
def create_requirement(payload: RequirementCreate, db: Session = Depends(get_db)):
    """提交功能需求

    业务规则：新需求默认 status=draft，需经评审后流转到 pending_review → approved
    """
    req = Requirement(**payload.model_dump())
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.get("")
def list_requirements(
    status: RequirementStatus | None = Query(None, description="按状态过滤"),
    priority: Priority | None = Query(None, description="按优先级过滤"),
    source: RequirementSource | None = Query(None, description="按来源过滤"),
    keyword: str | None = Query(None, description="关键词搜索"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页条数"),
    db: Session = Depends(get_db),
):
    """分页查询需求列表（含任务计数）"""
    query = db.query(Requirement)
    if status:
        query = query.filter(Requirement.status == status)
    if priority:
        query = query.filter(Requirement.priority == priority)
    if source:
        query = query.filter(Requirement.source == source)
    if keyword:
        query = query.filter(Requirement.title.ilike(f"%{keyword}%"))
    total = query.count()
    query = query.order_by(Requirement.created_at.desc())
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    result_items = []
    for req in items:
        task_count = db.query(sa_func.count(DataTask.id)).filter(
            DataTask.requirement_id == req.id
        ).scalar() or 0
        item = RequirementListItem.model_validate(req)
        item.task_count = task_count
        result_items.append(item)

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": result_items,
    }


@router.get("/stats")
def get_requirement_stats(db: Session = Depends(get_db)):
    """需求统计看板数据

    返回按状态和来源的聚合统计，用于管理仪表盘。
    """
    by_status = (
        db.query(Requirement.status, sa_func.count(Requirement.id))
        .group_by(Requirement.status)
        .all()
    )
    by_source = (
        db.query(Requirement.source, sa_func.count(Requirement.id))
        .group_by(Requirement.source)
        .all()
    )
    by_priority = (
        db.query(Requirement.priority, sa_func.count(Requirement.id))
        .group_by(Requirement.priority)
        .all()
    )
    total = db.query(sa_func.count(Requirement.id)).scalar()
    return {
        "total": total,
        "by_status": {s: c for s, c in by_status},
        "by_source": {s: c for s, c in by_source},
        "by_priority": {p: c for p, c in by_priority},
    }


@router.get("/{requirement_id}", response_model=RequirementDetail)
def get_requirement(requirement_id: str, db: Session = Depends(get_db)):
    """获取需求详情（含关联的数据任务列表）"""
    req = (
        db.query(Requirement)
        .options(joinedload(Requirement.data_tasks))
        .filter(Requirement.id == requirement_id)
        .first()
    )
    if not req:
        raise HTTPException(status_code=404, detail="需求不存在")
    return req


@router.patch("/{requirement_id}", response_model=RequirementResponse)
def update_requirement(
    requirement_id: str,
    payload: RequirementUpdate,
    db: Session = Depends(get_db),
):
    """更新需求（部分更新）"""
    req = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="需求不存在")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(req, field, value)
    db.commit()
    db.refresh(req)
    return req
