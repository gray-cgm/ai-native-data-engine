"""DatasetSnapshotManifest —— 端到端链路 receipt。

把一个 trace 的全链路产物（requirement → release pipeline_run → dataset_version
→ export artifact）固化成一行 + 一份 JSON。release 阶段写入，export 完成时回写
artifact_uri。前端的 /snapshots/{trace_id} 直接读这张表。

跨库引用约定：
- dataset_version_id / export_job_id 是 metadata adapter（catalog 库）里的
  字符串 ID，**不建外键**（异构数据库），靠 trace_id 串通。
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class DatasetSnapshotManifest(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """链路 receipt：一个 trace = 一行（理论上）。"""

    __tablename__ = "dataset_snapshot_manifests"

    x_trace_id: Mapped[str] = mapped_column(
        String(64), index=True, nullable=False, unique=True,
        comment="trace 唯一键（同时也是查询 PK）",
    )
    requirement_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("requirements.id"), nullable=True, index=True
    )
    data_task_id: Mapped[Optional[str]] = mapped_column(
        String(36), nullable=True, comment="主 DataTask（一般是 PIPELINE 类型那条）"
    )
    operations_task_id: Mapped[Optional[str]] = mapped_column(
        String(36), nullable=True, comment="release 类型 OperationsTask"
    )

    # ── pipeline 侧 ──
    gold_pipeline_run_id: Mapped[Optional[str]] = mapped_column(
        String(36), nullable=True,
        comment="终态 release PipelineRun（字段名沿用 gold_，避免迁移；语义已改）",
    )
    pipeline_run_count: Mapped[int] = mapped_column(
        Integer, default=0, comment="本 trace 涉及的 PipelineRun 总数"
    )

    # ── catalog 侧（跨库字符串引用） ──
    dataset_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    dataset_version_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    export_job_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    export_artifact_uri: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    export_format: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)

    # ── 链路全景 ──
    clip_ids: Mapped[Optional[list]] = mapped_column(
        JSON, nullable=True, default=list, comment="本次发版包含的 clip id 列表"
    )
    scenario: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    title: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    manifest_json: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True, comment="完整 receipt JSON（同步落盘到 data/exports/）"
    )

    sealed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="export 完成、artifact 落盘时间"
    )

    # ── 训练侧反馈计数 ──
    consumed_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False,
        comment="被 dlkit SDK 上报的 sample 消费总次数（P1 由 ingest workflow 维护，P0 默认 0）",
    )
    train_run_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False,
        comment="关联的 train_run 数量（P0 由 train_run 注册触发自增）",
    )
    last_consumed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
        comment="最近一次被消费的时间",
    )
    hard_sample_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False,
        comment="hard_score ≥ threshold 的 sample 数（P2 由 contribution_score Dagster job 写入）",
    )
