"""需求管理与物理世界还原 —— SQLAlchemy 模型

设计取舍：
- Requirement → DataTask 为 1:N 关系：一个功能需求可拆解为多个数据任务
- DataTask → DigitalReconstruction 为 1:N 关系：每个数据任务对应多个传感器还原目标
- Sign-off 信息直接内嵌在 DataTask 中而非独立表，因为签核是任务的固有属性，
  不需要记录多次签核历史（如需审计轨迹可后续扩展为独立表）
- feishu_doc_id 留空允许需求先建后关联，适配实际工作流
"""

from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    func as sa_func,
)
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import (
    AnnotationStatus,
    AnnotationType,
    Base,
    CollectionStatus,
    CoverageStatus,
    PipelineStage,
    PipelineStatus,
    Priority,
    ReconstructionLayer,
    RequirementSource,
    RequirementStatus,
    SensorTarget,
    SignOffStatus,
    TaskStatus,
    TaskType,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
)


# ═══════════════════════════ 需求与项目管理 ═══════════════════════════


class Requirement(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """功能需求表

    记录功能需求方（Dre/产品）提出的需求，是整个数据闭环的起点。
    核心流程：需求提交 → 评审打合 → 拆解为数据任务 → Sign-off → 执行
    """

    __tablename__ = "requirements"

    title: Mapped[str] = mapped_column(String(256), nullable=False, comment="需求标题")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="需求详细描述")
    priority: Mapped[str] = mapped_column(
        Enum(Priority, native_enum=False, length=16),
        default=Priority.MEDIUM,
        nullable=False,
        comment="优先级：high/medium/low",
    )
    source: Mapped[str] = mapped_column(
        Enum(RequirementSource, native_enum=False, length=16),
        nullable=False,
        comment="需求来源方：dre/product/algorithm/test",
    )
    status: Mapped[str] = mapped_column(
        Enum(RequirementStatus, native_enum=False, length=32),
        default=RequirementStatus.DRAFT,
        nullable=False,
        comment="需求状态",
    )
    feishu_doc_id: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True, comment="飞书文档关联 ID，用于与需求文档联动"
    )
    dre_owner: Mapped[str] = mapped_column(
        String(128), nullable=False, comment="Dre 负责人（邮箱或工号）"
    )
    target_scene: Mapped[Optional[str]] = mapped_column(
        String(256), nullable=True, comment="目标场景描述，如：夜间十字路口VRU检测"
    )
    scene_tags: Mapped[Optional[list]] = mapped_column(
        JSON, nullable=True, default=list, comment="场景标签，如：['夜间','十字路口','VRU']"
    )
    vehicle_tags: Mapped[Optional[list]] = mapped_column(
        JSON, nullable=True, default=list, comment="车型标签，如：['L4','乘用车']"
    )
    estimated_data_volume: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="预估所需数据量（帧/条）"
    )
    due_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True, comment="期望交付日期"
    )

    # ── 关系 ──
    data_tasks: Mapped[list["DataTask"]] = relationship(
        back_populates="requirement", cascade="all, delete-orphan"
    )


class DataTask(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """数据任务表

    由功能需求拆解而来，每个任务对应一类具体的数据工作（采集/标注/流水线/质检）。
    核心约束：必须经过大数据团队 Sign-off 才能进入执行阶段，避免盲目加塞。
    """

    __tablename__ = "data_tasks"

    requirement_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("requirements.id"), nullable=False, comment="所属需求 ID"
    )
    title: Mapped[str] = mapped_column(String(256), nullable=False, comment="任务标题")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="任务详细描述")
    task_type: Mapped[str] = mapped_column(
        Enum(TaskType, native_enum=False, length=32),
        nullable=False,
        comment="任务类型：collection/annotation/pipeline/quality_check",
    )
    status: Mapped[str] = mapped_column(
        Enum(TaskStatus, native_enum=False, length=32),
        default=TaskStatus.DRAFT,
        nullable=False,
        comment="任务状态",
    )

    # ── Sign-off 审批字段（大数据团队评审机制） ──
    sign_off_status: Mapped[str] = mapped_column(
        Enum(SignOffStatus, native_enum=False, length=16),
        default=SignOffStatus.PENDING,
        nullable=False,
        comment="Sign-off 状态",
    )
    sign_off_by: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True, comment="审批人"
    )
    sign_off_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="审批时间"
    )
    sign_off_comment: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="审批意见"
    )

    # ── 执行信息 ──
    assigned_to: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True, comment="执行负责人"
    )
    target_count: Mapped[int] = mapped_column(
        Integer, default=0, comment="目标数据量"
    )
    actual_count: Mapped[int] = mapped_column(
        Integer, default=0, comment="实际完成数据量"
    )
    due_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True, comment="截止日期"
    )

    # ── 关系 ──
    requirement: Mapped["Requirement"] = relationship(back_populates="data_tasks")
    reconstructions: Mapped[list["DigitalReconstruction"]] = relationship(
        back_populates="data_task", cascade="all, delete-orphan"
    )
    collection_jobs: Mapped[list["CollectionJob"]] = relationship(
        back_populates="data_task", cascade="all, delete-orphan"
    )
    annotation_tasks: Mapped[list["AnnotationTask"]] = relationship(
        back_populates="data_task", cascade="all, delete-orphan"
    )
    pipeline_runs: Mapped[list["PipelineRun"]] = relationship(
        back_populates="data_task", cascade="all, delete-orphan"
    )


# ═══════════════════════════ 物理世界还原 ═══════════════════════════


class DigitalReconstruction(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """物理世界数字化还原表

    记录每个数据任务需要还原的传感器/数据源目标，
    对应"以 T0 时刻车端感知物理世界快照为核心"的三层还原模型。
    通过 reconstruction_layer + sensor_target 二维定位还原目标。
    """

    __tablename__ = "digital_reconstructions"

    data_task_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("data_tasks.id"), nullable=False, comment="所属数据任务 ID"
    )
    reconstruction_layer: Mapped[str] = mapped_column(
        Enum(ReconstructionLayer, native_enum=False, length=32),
        nullable=False,
        comment="还原层级：raw_perception/computing_control/software_abstraction",
    )
    sensor_target: Mapped[str] = mapped_column(
        Enum(SensorTarget, native_enum=False, length=32),
        nullable=False,
        comment="传感器/数据源目标",
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="还原目标说明"
    )
    priority: Mapped[int] = mapped_column(
        Integer, default=3, comment="优先级 1-5，5 最高"
    )
    coverage_status: Mapped[str] = mapped_column(
        Enum(CoverageStatus, native_enum=False, length=16),
        default=CoverageStatus.NOT_STARTED,
        nullable=False,
        comment="还原覆盖状态",
    )
    # 传感器配置、采集参数等结构化扩展信息
    metadata_json: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True, comment="传感器配置等扩展元数据"
    )

    # ── 关系 ──
    data_task: Mapped["DataTask"] = relationship(back_populates="reconstructions")


# ═══════════════════════════ 数据采集 ═══════════════════════════


class CollectionJob(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """数据采集作业表

    记录每一次实车数据采集的执行情况，
    关联到具体的数据任务，追踪从调度→采集→上传的全流程。
    """

    __tablename__ = "collection_jobs"

    data_task_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("data_tasks.id"), nullable=False, comment="所属数据任务 ID"
    )
    vehicle_id: Mapped[str] = mapped_column(
        String(64), nullable=False, comment="采集车辆编号"
    )
    route_id: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True, comment="采集路线 ID"
    )
    status: Mapped[str] = mapped_column(
        Enum(CollectionStatus, native_enum=False, length=16),
        default=CollectionStatus.SCHEDULED,
        nullable=False,
        comment="采集状态",
    )
    raw_data_uri: Mapped[Optional[str]] = mapped_column(
        String(512), nullable=True, comment="原始数据存储路径（对象存储 URI）"
    )
    total_frames: Mapped[int] = mapped_column(
        Integer, default=0, comment="总帧数"
    )
    collection_config: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True, comment="采集配置（传感器参数、频率等）"
    )
    start_time: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="采集开始时间"
    )
    end_time: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="采集结束时间"
    )

    # ── 关系 ──
    data_task: Mapped["DataTask"] = relationship(back_populates="collection_jobs")


# ═══════════════════════════ 数据标注 ═══════════════════════════


class AnnotationTask(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """数据标注任务表

    对应 Image → Group → Line/Geometry → Point → Properties 的结构化标注体系，
    支持细粒度的人效统计（TPI）。每个标注任务关联到一个数据切片。
    """

    __tablename__ = "annotation_tasks"

    data_task_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("data_tasks.id"), nullable=False, comment="所属数据任务 ID"
    )
    clip_uri: Mapped[str] = mapped_column(
        String(512), nullable=False, comment="切片数据路径"
    )
    annotation_type: Mapped[str] = mapped_column(
        Enum(AnnotationType, native_enum=False, length=32),
        nullable=False,
        comment="标注类型",
    )
    annotation_vendor: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True, comment="标注供应商"
    )
    status: Mapped[str] = mapped_column(
        Enum(AnnotationStatus, native_enum=False, length=16),
        default=AnnotationStatus.PENDING,
        nullable=False,
        comment="标注状态",
    )
    annotator_id: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True, comment="标注员 ID"
    )
    reviewer_id: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True, comment="审核员 ID"
    )
    tpi_score: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True, comment="人效指标 TPI（Tasks Per Image/Hour）"
    )
    result_uri: Mapped[Optional[str]] = mapped_column(
        String(512), nullable=True, comment="标注结果存储路径"
    )
    total_objects: Mapped[int] = mapped_column(
        Integer, default=0, comment="标注对象总数（框/多边形/点等）"
    )

    # ── 关系 ──
    data_task: Mapped["DataTask"] = relationship(back_populates="annotation_tasks")


# ═══════════════════════════ 流水线加工 ═══════════════════════════


class PipelineRun(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """流水线运行记录表

    对应 One-Pipeline 的数据加工流转：
    原始采集包(Bronze) → 多模态切片(Silver) → 特征提取(Silver) → 发版数据集(Gold)
    每次运行记录输入/输出路径、配置和执行指标。
    """

    __tablename__ = "pipeline_runs"

    data_task_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("data_tasks.id"), nullable=False, comment="所属数据任务 ID"
    )
    pipeline_name: Mapped[str] = mapped_column(
        String(128), nullable=False, comment="流水线名称"
    )
    stage: Mapped[str] = mapped_column(
        Enum(PipelineStage, native_enum=False, length=32),
        nullable=False,
        comment="流水线阶段",
    )
    input_uri: Mapped[str] = mapped_column(
        String(512), nullable=False, comment="输入数据路径"
    )
    output_uri: Mapped[Optional[str]] = mapped_column(
        String(512), nullable=True, comment="输出数据路径"
    )
    status: Mapped[str] = mapped_column(
        Enum(PipelineStatus, native_enum=False, length=16),
        default=PipelineStatus.PENDING,
        nullable=False,
        comment="执行状态",
    )
    config: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True, comment="流水线配置"
    )
    metrics: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True, comment="执行指标（处理速度、数据量等）"
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="开始时间"
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="完成时间"
    )

    # ── 关系 ──
    data_task: Mapped["DataTask"] = relationship(back_populates="pipeline_runs")
