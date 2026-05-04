"""TrainRun —— 训练运行注册。

每次算法工程师消费一个或多个 ExportSnapshot 时，由 dlkit SDK 注册一条 TrainRun；
P0 阶段也支持手工 POST 注册（无 SDK 时仍能闭环）。

x_trace_id 取主 snapshot 的 trace；多 snapshot 时全部 upstream trace 落在
parent_trace_ids 列，用于反查。

跨库引用约定：snapshot_ids 是 dataset_snapshot_manifests.x_trace_id 列表，
不建外键（避免多库耦合 + 异步注册时序问题），靠 trace_id 串通。
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class TrainRun(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """训练运行注册：snapshot ↔ 消费方对账锚点。"""

    __tablename__ = "train_runs"

    name: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    consumer: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True, index=True,
        comment="user / team / service account",
    )
    external_run_id: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True, index=True,
        comment="MLflow / W&B / Kubeflow run id",
    )
    model_version: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="running",
        comment="running / completed / failed / unknown",
    )

    snapshot_ids: Mapped[Optional[list]] = mapped_column(
        JSON, nullable=True, default=list,
        comment="本次消费的 snapshot.x_trace_id 列表（跨库字符串引用）",
    )
    parent_trace_ids: Mapped[Optional[list]] = mapped_column(
        JSON, nullable=True, default=list,
        comment="多 snapshot 时全部 upstream trace 列表",
    )

    x_trace_id: Mapped[str] = mapped_column(
        String(64), index=True, nullable=False,
        comment="主 trace（多 snapshot 取主 snapshot 的 trace）",
    )

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
