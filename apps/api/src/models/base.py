"""SQLAlchemy 基类与全局枚举定义

设计取舍：
- 使用 DeclarativeBase（SQLAlchemy 2.0 推荐方式）替代旧版 declarative_base()
- 公共字段（id, created_at, updated_at）通过 Mixin 复用，减少样板代码
- 枚举使用 Python Enum + SQLAlchemy Enum 列类型，确保数据库层面的约束一致性
- 所有枚举继承 (str, Enum) 使 JSON 序列化零摩擦，与 Pydantic 天然兼容
- ID 使用 UUID 而非自增整数，便于分布式环境下的数据合并
"""

import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


# ═══════════════════════════ ORM 基类 ═══════════════════════════


class Base(DeclarativeBase):
    """所有 SQLAlchemy 模型的基类"""

    pass


class TimestampMixin:
    """通用时间戳混入：所有业务表均需审计创建/更新时间"""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class UUIDPrimaryKeyMixin:
    """UUID 主键混入：分布式友好，避免自增 ID 在多环境合并时冲突"""

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )


# ═══════════════════════════ 业务枚举 ═══════════════════════════
# 按业务域分组，对应系统核心概念的"T0时刻物理世界快照"三层模型


# ── 需求与项目管理 ──


class Priority(str, PyEnum):
    """需求优先级：对应产品/Dre 提出的功能需求紧急程度"""

    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class RequirementSource(str, PyEnum):
    """需求来源方：明确责任归属，便于后续打合与资源分配统计"""

    DRE = "dre"
    PRODUCT = "product"
    ALGORITHM = "algorithm"
    TEST = "test"


class RequirementStatus(str, PyEnum):
    """需求生命周期状态：从草稿 → 评审 → 批准 → 执行 → 完成/拒绝"""

    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    REJECTED = "rejected"


class TaskType(str, PyEnum):
    """数据任务类型：由功能需求拆解出的业务里程碑（6 类）。

    对齐 Tesla / Waymo / Cruise 等头部自动驾驶团队的数据闭环术语：
    tagging（场景级，自动化覆盖率高）与 labeling（对象级，强人工）分立——
    成本结构、SLA、人机配比完全不同，合并到一个 annotation 会让运营错配。
    """

    COLLECTION = "collection"   # 数据采集（路测 / 影子模式回流原始 clip）
    MINING = "mining"           # 数据挖掘（已有池子挖候选 clip，与 collection 平行）
    TAGGING = "tagging"         # 场景级打标（夜间 / 路口 / 切入；auto-tagger + 人工抽检）
    LABELING = "labeling"       # 对象级精细标注（2D/3D bbox / seg / track / lane）
    CHECKING = "checking"       # 质量校验（QA gate / review）
    RELEASE = "release"         # 发版（dataset 提级与交付）


class SignOffStatus(str, PyEnum):
    """大数据团队 Sign-off 状态：核心评审机制，防止盲目加塞"""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class TaskStatus(str, PyEnum):
    """数据任务执行状态"""

    DRAFT = "draft"
    PENDING_SIGNOFF = "pending_signoff"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    BLOCKED = "blocked"


# ── 物理世界还原层级 ──


class ReconstructionLayer(str, PyEnum):
    """物理世界还原三层模型，以 T0 时刻车端感知快照为核心向外辐射

    - RAW_PERCEPTION: Camera、LiDAR、IMU 等原始传感器
    - COMPUTING_CONTROL: MCU、CAN 信号、VLMU 等计算/控制单元
    - SOFTWARE_ABSTRACTION: ROS Topics、座舱信号等软件层
    """

    RAW_PERCEPTION = "raw_perception"
    COMPUTING_CONTROL = "computing_control"
    SOFTWARE_ABSTRACTION = "software_abstraction"


class SensorTarget(str, PyEnum):
    """传感器/数据源目标：覆盖三层模型中所有需要还原的数据源"""

    # ── 原始感知层（红色优先） ──
    CAMERA = "camera"
    LIDAR = "lidar"
    IMU = "imu"
    SRR = "srr"    # 短距雷达 Short Range Radar
    IRR = "irr"    # 中远距雷达 Intermediate Range Radar
    # ── 计算控制层 ──
    MCU = "mcu"
    CAN_SIGNAL = "can_signal"
    VLMU = "vlmu"
    CDCU = "cdcu"
    FPU = "fpu"
    # ── 软件抽象层（绿色，即将重点还原） ──
    ROS_TOPIC = "ros_topic"
    CABIN_SIGNAL = "cabin_signal"


class CoverageStatus(str, PyEnum):
    """还原覆盖状态：用于追踪每个传感器目标的数字化还原进度"""

    NOT_STARTED = "not_started"
    PARTIAL = "partial"
    COMPLETE = "complete"


# ── 数据采集与标注 ──


class CollectionStatus(str, PyEnum):
    """采集作业状态"""

    SCHEDULED = "scheduled"
    COLLECTING = "collecting"
    UPLOADED = "uploaded"
    FAILED = "failed"


class AnnotationType(str, PyEnum):
    """标注类型：对应 Image → Group → Line/Geometry → Point → Properties 结构"""

    BBOX_2D = "bbox_2d"           # 2D 检测框
    BBOX_3D = "bbox_3d"           # 3D 检测框
    SEMANTIC_SEG = "semantic_seg" # 语义分割
    LANE_MARKING = "lane_marking" # 车道线标注
    POINT_CLOUD = "point_cloud"   # 点云标注
    TRACKING = "tracking"         # 目标追踪


class AnnotationStatus(str, PyEnum):
    """标注任务状态：含交叉审核机制"""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


# ── 流水线加工 ──


# ── 流水线 step（v3，2026-04-28）：自由文本，不再用枚举 ──
#
# 设计取舍：彻底删除 PipelineStage 枚举（曾短暂为 INGEST/CURATE/PUBLISH，再之前
# 是 RAW_INGEST/CLIP_EXTRACTION/...）。
# Dataset 现只剩 customized + official 两类；非 dataset 的数据资产（raw 采集 /
# 派生产物）登记为 Asset 行（apps/api/src/models/asset.py）。
# PipelineRun.stage 列保留但仅作"step 名"自由文本展示用，不再做语义约束。


class PipelineStatus(str, PyEnum):
    """流水线执行状态"""

    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"


# ── 全链路追踪与 PipelineRun 统一事实模型 ──


class TriggerSource(str, PyEnum):
    """PipelineRun 触发来源：用于区分同一 DataTask 下不同语义的运行。"""

    DATA_TASK = "data_task"
    OPERATIONS_TASK = "operations_task"
    SCHEDULER = "scheduler"
    MANUAL = "manual"
    EXTERNAL = "external"


class RunPurpose(str, PyEnum):
    """PipelineRun 运行目的：帮助 UI/审计区分初建、回补、修复、回放等语义。"""

    INITIAL_BUILD = "initial_build"
    BACKFILL = "backfill"
    REPAIR = "repair"
    REINDEX = "reindex"
    REPLAY = "replay"
    VALIDATION = "validation"


# ── 运维任务（OperationsTask）状态 ──


class OperationsTaskStatus(str, PyEnum):
    """OperationsTask 执行状态：Req→DT 拆下来的执行协调单元。"""

    DRAFT = "draft"
    SCHEDULED = "scheduled"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class OperationsModule(str, PyEnum):
    """OperationsTask 所属运维模块，对应 ops_modules 六大子域。"""

    LABELING = "labeling"
    TAGGING = "tagging"
    CHECKING = "checking"
    MINING = "mining"
    PRIVACY = "privacy"
    RELEASE = "release"
