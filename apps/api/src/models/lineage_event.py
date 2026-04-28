"""LineageEvent + EventResult —— Snowflake 事件中心 + 结果维度

设计取舍（参考 docs/architecture/dataset-snowflake-redesign.md §4）：
- LineageEvent 是"事实发生表"：一次 migration / 人工标注 / 模型挖掘 = 一行；
  本身不关心 tag/ts/clip 细节，只记录 who/what/when + 代码版本与上游来源。
- EventResult 承载"事实产物"：一行对应一个 (event, clip, payload_type)。
  tag 是 result，不是 entity；同一 event 可产出多 clip / 多 tag / 有/无 ts。
- 4 个维度（Tagging / Labeling / Checking / Mining）通过路由层 query filter
  暴露，避免一开始就拆 4 张高度同构的表；当任何维度需要扩展字段（如 labeling
  的 quality_score / assignee），再拆独立维度表回挂 event_id。
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    JSON,
    BigInteger,
    DateTime,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


# ── Snowflake 中心：LineageEvent ─────────────────────────────────────


class LineageEvent(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """事件事实发生表（Snowflake 中心节点）

    一次 mining / 标注 / 质检 / migration / flexible_cut / release = 一条 event。
    不存 tag/ts/clip 细节，那些落到 EventResult。
    """

    __tablename__ = "lineage_events"

    # 业务展示用 event_id（应用层生成 ``evt_<yyyymmdd>_<seq>`` 风格），与 PK 解耦。
    event_id: Mapped[Optional[str]] = mapped_column(
        String(64), index=True, nullable=True, unique=False,
        comment="业务可读 ID（系统生成，非 PK）",
    )
    event_type: Mapped[str] = mapped_column(
        String(32), index=True, nullable=False,
        comment="tagging / labeling / checking / mining / migration / flexible_cut / release / generation / trigger",
    )
    job_id: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, comment="来源 job（Dagster run / Kafka offset / manual_ui）"
    )
    requirement_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("requirements.id"), nullable=True, index=True,
        comment="关联需求 ID（demand_id 等价）",
    )
    operations_task_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("operations_tasks.id"), nullable=True, index=True,
    )
    pipeline_run_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("pipeline_runs.id"), nullable=True, index=True,
    )

    # 来源 / 版本元数据
    source_type: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True,
        comment="migration_from_cpfs / manual_ui / kafka_stream / orchestrator …",
    )
    snapshot_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, nullable=True, comment="Iceberg snapshot 等版本号",
    )
    pipeline_commit: Mapped[Optional[str]] = mapped_column(
        String(40), nullable=True, comment="代码版本（git sha）",
    )
    pipeline_repo: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True, comment="Repo 名",
    )
    branch_name: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True, comment="Repo 分支",
    )
    table_name: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True, comment="结果写入的物化表名（可选）",
    )

    x_trace_id: Mapped[Optional[str]] = mapped_column(
        String(64), index=True, nullable=True, comment="跨系统追踪键",
    )
    payload: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True, comment="事件级扩展字段（不下钻到 result 维度）"
    )

    # ── 关系 ──
    results: Mapped[list["EventResult"]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )


# ── EventResult：事实产物 ────────────────────────────────────────────


class EventResult(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """事件结果行：一个 event 可有 N 行（多 clip / 多 tag / 有/无 ts）。

    Tagging / Labeling / Checking / Mining 4 个维度通过 ``payload_type``
    + ``LineageEvent.event_type`` 双约束筛选，无需独立物理表。
    """

    __tablename__ = "event_results"

    event_pk: Mapped[str] = mapped_column(
        String(36), ForeignKey("lineage_events.id"), nullable=False, index=True,
        comment="关联 LineageEvent.id（FK）",
    )
    clip_id: Mapped[str] = mapped_column(
        String(64), index=True, nullable=False, comment="结果对象 clip id"
    )
    payload_type: Mapped[str] = mapped_column(
        String(32), index=True, nullable=False,
        comment="tag / label / check / mining_candidate",
    )
    tags: Mapped[Optional[str]] = mapped_column(
        String(256), nullable=True, comment="产出的 tag（如 migration_cutin_10-11）"
    )
    da_tags: Mapped[Optional[str]] = mapped_column(
        String(256), nullable=True, comment="人工标注 tag（如 Good_behavior_v1）"
    )
    trigger_event_tags: Mapped[Optional[str]] = mapped_column(
        String(256), nullable=True, comment="TriggerName，如 Xplanner_Cutin_Trigger"
    )
    ts: Mapped[Optional[int]] = mapped_column(
        BigInteger, nullable=True,
        comment="部分结果有 ts（如 cutin_10-11），部分没有（如 migration_v1）",
    )
    extra: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True, comment="模块扩展字段"
    )
    note: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="结果备注",
    )

    # ── 关系 ──
    event: Mapped["LineageEvent"] = relationship(back_populates="results")
