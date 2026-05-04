"""ExportConsumptionEvent —— sample 级训练消费事件。

每次算法工程师迭代一条训练 sample 时，dlkit SDK 异步上报一条事件。事件量大
（单次训练可能 1k~50k 条），但 MVP 阶段先落主 SQLite —— 简单、单库备份、
新人 onboarding 0 心智负担。

跨表引用约定：snapshot_trace / train_run_id 都用字符串引用，**不建外键**
（与 train_runs.snapshot_ids 同样的策略，避免异步注册的时序耦合）。

P1 阶段 loss 留空；P2 上线 dlkit.LossLogger 后再写入。
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ExportConsumptionEvent(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """一条 sample 在某次 train_run 中被消费一次的事件。"""

    __tablename__ = "export_consumption_events"

    snapshot_trace: Mapped[str] = mapped_column(
        String(64), nullable=False, index=True,
        comment="dataset_snapshot_manifests.x_trace_id（字符串引用）",
    )
    sample_uid: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True,
        comment="sample 唯一键（一般是 dataset_id:clip_id:ts 拼接）",
    )
    train_run_id: Mapped[str] = mapped_column(
        String(36), nullable=False, index=True,
        comment="train_runs.id 字符串引用",
    )

    epoch: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    step: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    loss: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True, comment="P2 LossLogger 写入；P1 阶段为空",
    )

    ts: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        comment="事件发生时刻（SDK 客户端时间）",
    )
    x_trace_id: Mapped[str] = mapped_column(
        String(64), nullable=False, index=True,
        comment="链路 trace（一般等于 snapshot_trace，保持透传一致性）",
    )
