"""需求管理 API 的 Pydantic 请求/响应模型

设计取舍：
- 严格区分 Create（写入）、Update（更新）、Response（读取）三套 Schema
- Create 不暴露 id/时间戳等服务端生成字段
- Update 所有字段可选，支持部分更新（PATCH 语义）
- Response 包含完整字段 + 嵌套关系，避免 N+1 查询时前端二次请求
"""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field

from src.models.base import (
    AnnotationStatus,
    AnnotationType,
    CollectionStatus,
    CoverageStatus,
    OperationsModule,
    OperationsTaskStatus,
    PipelineStage,
    PipelineStatus,
    Priority,
    ReconstructionLayer,
    RequirementSource,
    RequirementStatus,
    RunPurpose,
    SensorTarget,
    SignOffStatus,
    TaskStatus,
    TaskType,
    TriggerSource,
)


# ═══════════════════════════ 需求 (Requirement) ═══════════════════════════


class RequirementCreate(BaseModel):
    """创建需求的请求体"""

    title: str = Field(..., max_length=256, description="需求标题")
    description: Optional[str] = Field(None, description="需求详细描述")
    priority: Priority = Field(Priority.MEDIUM, description="优先级")
    source: RequirementSource = Field(..., description="需求来源方")
    dre_owner: str = Field(..., max_length=128, description="Dre 负责人")
    feishu_doc_id: Optional[str] = Field(None, max_length=128, description="飞书文档关联 ID")
    target_scene: Optional[str] = Field(None, max_length=256, description="目标场景")
    scene_tags: Optional[list[str]] = Field(None, description="场景标签")
    vehicle_tags: Optional[list[str]] = Field(None, description="车型标签")
    estimated_data_volume: Optional[int] = Field(None, ge=0, description="预估数据量")
    due_date: Optional[date] = Field(None, description="期望交付日期")


class RequirementUpdate(BaseModel):
    """更新需求的请求体（部分更新）"""

    title: Optional[str] = Field(None, max_length=256)
    description: Optional[str] = None
    priority: Optional[Priority] = None
    status: Optional[RequirementStatus] = None
    feishu_doc_id: Optional[str] = Field(None, max_length=128)
    target_scene: Optional[str] = Field(None, max_length=256)
    scene_tags: Optional[list[str]] = None
    vehicle_tags: Optional[list[str]] = None
    estimated_data_volume: Optional[int] = Field(None, ge=0)
    due_date: Optional[date] = None


class RequirementResponse(BaseModel):
    """需求响应体"""

    id: str
    title: str
    description: Optional[str]
    priority: Priority
    source: RequirementSource
    status: RequirementStatus
    dre_owner: str
    feishu_doc_id: Optional[str]
    target_scene: Optional[str]
    scene_tags: Optional[list[str]] = None
    vehicle_tags: Optional[list[str]] = None
    estimated_data_volume: Optional[int]
    due_date: Optional[date]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RequirementListItem(RequirementResponse):
    """需求列表项（含任务计数）"""

    task_count: int = 0


class RequirementDetail(RequirementResponse):
    """需求详情响应（含关联的数据任务列表）"""

    data_tasks: list["DataTaskResponse"] = []


# ═══════════════════════════ 数据任务 (DataTask) ═══════════════════════════


class DataTaskCreate(BaseModel):
    """创建数据任务的请求体"""

    requirement_id: str = Field(..., description="所属需求 ID")
    title: str = Field(..., max_length=256, description="任务标题")
    description: Optional[str] = None
    task_type: TaskType = Field(..., description="任务类型")
    assigned_to: Optional[str] = Field(None, max_length=128, description="执行负责人")
    target_count: int = Field(0, ge=0, description="目标数据量")
    due_date: Optional[date] = None


class DataTaskUpdate(BaseModel):
    """更新数据任务"""

    title: Optional[str] = Field(None, max_length=256)
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    assigned_to: Optional[str] = Field(None, max_length=128)
    target_count: Optional[int] = Field(None, ge=0)
    actual_count: Optional[int] = Field(None, ge=0)
    due_date: Optional[date] = None


class SignOffRequest(BaseModel):
    """大数据团队 Sign-off 审批请求"""

    approved: bool = Field(..., description="是否批准")
    sign_off_by: str = Field(..., max_length=128, description="审批人")
    comment: Optional[str] = Field(None, description="审批意见")


class DataTaskResponse(BaseModel):
    """数据任务响应体"""

    id: str
    requirement_id: str
    title: str
    description: Optional[str]
    task_type: TaskType
    status: TaskStatus
    sign_off_status: SignOffStatus
    sign_off_by: Optional[str]
    sign_off_at: Optional[datetime]
    sign_off_comment: Optional[str]
    assigned_to: Optional[str]
    target_count: int
    actual_count: int
    due_date: Optional[date]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ═══════════════════════════ 物理世界还原 ═══════════════════════════


class ReconstructionCreate(BaseModel):
    """创建数字化还原目标"""

    data_task_id: str = Field(..., description="所属数据任务 ID")
    reconstruction_layer: ReconstructionLayer = Field(..., description="还原层级")
    sensor_target: SensorTarget = Field(..., description="传感器/数据源目标")
    description: Optional[str] = None
    priority: int = Field(3, ge=1, le=5, description="优先级 1-5")
    metadata_json: Optional[dict] = None


class ReconstructionUpdate(BaseModel):
    """更新还原目标"""

    description: Optional[str] = None
    priority: Optional[int] = Field(None, ge=1, le=5)
    coverage_status: Optional[CoverageStatus] = None
    metadata_json: Optional[dict] = None


class ReconstructionResponse(BaseModel):
    """还原目标响应体"""

    id: str
    data_task_id: str
    reconstruction_layer: ReconstructionLayer
    sensor_target: SensorTarget
    description: Optional[str]
    priority: int
    coverage_status: CoverageStatus
    metadata_json: Optional[dict]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ═══════════════════════════ 数据采集 ═══════════════════════════


class CollectionJobCreate(BaseModel):
    """创建采集作业"""

    data_task_id: str = Field(..., description="所属数据任务 ID")
    vehicle_id: str = Field(..., max_length=64, description="采集车辆编号")
    route_id: Optional[str] = Field(None, max_length=128, description="采集路线 ID")
    collection_config: Optional[dict] = None


class CollectionJobUpdate(BaseModel):
    """更新采集作业"""

    status: Optional[CollectionStatus] = None
    raw_data_uri: Optional[str] = Field(None, max_length=512)
    total_frames: Optional[int] = Field(None, ge=0)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class CollectionJobResponse(BaseModel):
    """采集作业响应体"""

    id: str
    data_task_id: str
    vehicle_id: str
    route_id: Optional[str]
    status: CollectionStatus
    raw_data_uri: Optional[str]
    total_frames: int
    collection_config: Optional[dict]
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ═══════════════════════════ 数据标注 ═══════════════════════════


class AnnotationTaskCreate(BaseModel):
    """创建标注任务"""

    data_task_id: str = Field(..., description="所属数据任务 ID")
    clip_uri: str = Field(..., max_length=512, description="切片数据路径")
    annotation_type: AnnotationType = Field(..., description="标注类型")
    annotation_vendor: Optional[str] = Field(None, max_length=128, description="标注供应商")


class AnnotationTaskUpdate(BaseModel):
    """更新标注任务"""

    status: Optional[AnnotationStatus] = None
    annotator_id: Optional[str] = Field(None, max_length=128)
    reviewer_id: Optional[str] = Field(None, max_length=128)
    tpi_score: Optional[float] = Field(None, ge=0)
    result_uri: Optional[str] = Field(None, max_length=512)
    total_objects: Optional[int] = Field(None, ge=0)


class AnnotationTaskResponse(BaseModel):
    """标注任务响应体"""

    id: str
    data_task_id: str
    clip_uri: str
    annotation_type: AnnotationType
    annotation_vendor: Optional[str]
    status: AnnotationStatus
    annotator_id: Optional[str]
    reviewer_id: Optional[str]
    tpi_score: Optional[float]
    result_uri: Optional[str]
    total_objects: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ═══════════════════════════ 流水线加工 ═══════════════════════════


class PipelineRunCreate(BaseModel):
    """创建流水线运行"""

    data_task_id: str = Field(..., description="所属数据任务 ID")
    pipeline_name: str = Field(..., max_length=128, description="流水线名称")
    stage: PipelineStage = Field(..., description="流水线阶段")
    input_uri: str = Field(..., max_length=512, description="输入数据路径")
    config: Optional[dict] = None
    # 全链路追踪字段
    x_trace_id: Optional[str] = Field(None, max_length=64, description="跨系统追踪键")
    trace_parent_id: Optional[str] = Field(None, max_length=64)
    requirement_id: Optional[str] = Field(None, description="冗余需求 ID")
    operations_task_id: Optional[str] = Field(None, description="归属 OperationsTask")
    trigger_source: Optional[TriggerSource] = Field(TriggerSource.DATA_TASK)
    run_purpose: Optional[RunPurpose] = Field(RunPurpose.INITIAL_BUILD)


class PipelineRunUpdate(BaseModel):
    """更新流水线运行"""

    status: Optional[PipelineStatus] = None
    output_uri: Optional[str] = Field(None, max_length=512)
    metrics: Optional[dict] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class PipelineRunResponse(BaseModel):
    """流水线运行响应体"""

    id: str
    data_task_id: str
    pipeline_name: str
    stage: PipelineStage
    input_uri: str
    output_uri: Optional[str]
    status: PipelineStatus
    config: Optional[dict]
    metrics: Optional[dict]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    # 全链路追踪
    x_trace_id: Optional[str] = None
    trace_parent_id: Optional[str] = None
    requirement_id: Optional[str] = None
    operations_task_id: Optional[str] = None
    trigger_source: TriggerSource
    run_purpose: RunPurpose
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ═══════════════════════════ 运维任务 (OperationsTask) ═══════════════════════════


class OperationsTaskCreate(BaseModel):
    """创建运维任务"""

    requirement_id: str = Field(..., description="所属需求 ID")
    data_task_id: str = Field(..., description="所属数据任务 ID")
    module: OperationsModule = Field(..., description="运维模块")
    title: str = Field(..., max_length=256)
    assigned_to: Optional[str] = Field(None, max_length=128)
    x_trace_id: Optional[str] = Field(None, max_length=64)
    payload: Optional[dict] = None


class OperationsTaskUpdate(BaseModel):
    """更新运维任务"""

    status: Optional[OperationsTaskStatus] = None
    assigned_to: Optional[str] = Field(None, max_length=128)
    payload: Optional[dict] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class OperationsTaskResponse(BaseModel):
    """运维任务响应体"""

    id: str
    requirement_id: str
    data_task_id: str
    module: OperationsModule
    title: str
    status: OperationsTaskStatus
    assigned_to: Optional[str]
    x_trace_id: Optional[str] = None
    payload: Optional[dict] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RunBreadcrumb(BaseModel):
    """PipelineRun 详情面包屑：Requirement → DataTask → OperationsTask → Run"""

    requirement: Optional[dict] = None
    data_task: Optional[dict] = None
    operations_task: Optional[dict] = None
    run: dict


# ═══════════════════════════ 通用 ═══════════════════════════


class PaginatedResponse(BaseModel):
    """分页响应包装器"""

    total: int
    page: int
    page_size: int
    items: list


# 解决前向引用
RequirementDetail.model_rebuild()
