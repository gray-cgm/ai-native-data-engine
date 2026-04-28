"""OpsItem —— OperationsTask 下的执行子项。

设计取舍：
- OperationsTask 是「协调单元」（一个 mining/labeling/release 的任务包），
  OpsItem 是其内部的「执行项」（具体的 N 个候选 clip / N 个标注小项 /
  N 条质检结果）。两者 1:N。
- 用一张统一表 + module 列承载 6 个子模块，避免 6 张高度相似的表；
  status / kind 作字符串保留 ops_modules.py 中的开放词表。
- 既冗余 operations_task_id（强归属）又冗余 requirement_id /
  data_task_id / x_trace_id（便于 mining→labeling 跨任务复用 trace 时
  直接列表过滤）。
- clip_ids / payload 使用 JSON：mining 的"候选 clip 集合"是核心产物，
  作为 labeling 的输入；payload 用于 6 个模块各自的扩展字段。
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    JSON,
    DateTime,
    Enum,
    ForeignKey,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import (
    Base,
    OperationsModule,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
)


class OpsItem(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """OperationsTask 内的具体执行子项

    例：一条 mining 类型的 OperationsTask 可能产出 N 条 OpsItem，每条对应
    一个候选 clip；release 类型的 OperationsTask 通常只有一条 OpsItem
    （即"本次发版的 dataset version 草稿"）。
    """

    __tablename__ = "ops_items"

    operations_task_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("operations_tasks.id"),
        nullable=True,
        index=True,
        comment="归属的 OperationsTask（允许 null：UI 直接创建的轻量子项）",
    )
    requirement_id: Mapped[Optional[str]] = mapped_column(
        String(36), index=True, nullable=True, comment="冗余需求 ID（便于过滤）"
    )
    data_task_id: Mapped[Optional[str]] = mapped_column(
        String(36), index=True, nullable=True, comment="冗余 DataTask ID"
    )
    x_trace_id: Mapped[Optional[str]] = mapped_column(
        String(64), index=True, nullable=True, comment="跨系统追踪键"
    )

    module: Mapped[str] = mapped_column(
        Enum(OperationsModule, native_enum=False, length=32),
        nullable=False,
        index=True,
        comment="子模块：labeling/tagging/checking/mining/privacy/release",
    )
    title: Mapped[str] = mapped_column(String(256), nullable=False, comment="子项标题")
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        index=True,
        comment="子模块自定义状态字符串（见 ops_modules.py 词表）",
    )
    kind: Mapped[Optional[str]] = mapped_column(
        String(32), nullable=True, comment="子模块二级维度（如 labeling.kind=human）"
    )
    owner: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True, comment="负责人"
    )

    # ── 子项关联的数据资源 ──
    clip_ids: Mapped[Optional[list]] = mapped_column(
        JSON, nullable=True, default=list, comment="关联的 clip id 列表"
    )
    dataset_id: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, comment="关联 dataset_id（catalog 库字符串引用）"
    )
    scenario: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, comment="场景标识"
    )
    payload: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True, default=dict, comment="子模块扩展字段"
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="软删时间"
    )
