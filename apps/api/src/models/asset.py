"""Asset —— 原始采集与派生数据的统一登记表

设计取舍（参考 docs/architecture/dataset-snowflake-redesign.md §3）：
- 取代旧 ingest/curate/publish 三段。dataset 只剩 customized + official；
  非 dataset 的"数据资产"（raw 采集包、clip lance 目录、特征文件、质检报告等）
  统一登记为 Asset 行。
- ``asset_kind`` 区分 raw / derived；血缘走 ``producer_pipeline_run_id``
  与 ``producer_event_id`` FK，不再回到 stage 枚举。
- 不在 Asset 上重复记录 schema / row_count 的细节列：用 ``payload`` JSON 承
  载；多维度统计（如 byte_size / row_count）作为高频字段直接列出。
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy import (
    JSON,
    BigInteger,
    Enum,
    ForeignKey,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


# 开放枚举，用 Python Enum 收紧两类
import enum


class AssetKind(str, enum.Enum):
    RAW = "raw"          # 原始采集（车端上传 / Kafka 落地 / migration 输入）
    DERIVED = "derived"  # 流水线 / 切割 / 特征 / 质检产物


class Asset(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """数据资产登记表（raw + derived 共用）"""

    __tablename__ = "assets"

    name: Mapped[str] = mapped_column(
        String(256), nullable=False, comment="资产人类可读名"
    )
    asset_kind: Mapped[str] = mapped_column(
        Enum(AssetKind, native_enum=False, length=16),
        nullable=False, index=True,
        comment="raw（原始采集）/ derived（pipeline 加工产物）",
    )
    uri: Mapped[str] = mapped_column(
        String(512), nullable=False, comment="物理路径，可为 s3:// 或本地相对路径",
    )
    format: Mapped[Optional[str]] = mapped_column(
        String(32), nullable=True, comment="parquet / lance / mp4 / jsonl / ...",
    )
    clip_id: Mapped[Optional[str]] = mapped_column(
        String(64), index=True, nullable=True, comment="关联 clip（可选）",
    )

    # ── 血缘 ──
    producer_pipeline_run_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("pipeline_runs.id"), nullable=True, index=True,
        comment="哪条 PipelineRun 产出（raw asset 一般为空）",
    )
    producer_event_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("lineage_events.id"), nullable=True, index=True,
        comment="哪条 LineageEvent 直接产出（manual_ui / mining 等）",
    )
    requirement_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("requirements.id"), nullable=True, index=True,
        comment="冗余便于跨层过滤",
    )
    x_trace_id: Mapped[Optional[str]] = mapped_column(
        String(64), index=True, nullable=True, comment="跨系统追踪键",
    )

    # ── 度量 ──
    byte_size: Mapped[Optional[int]] = mapped_column(
        BigInteger, nullable=True, comment="文件字节数",
    )
    row_count: Mapped[Optional[int]] = mapped_column(
        BigInteger, nullable=True, comment="行数（适用于结构化资产）",
    )

    # ── 模块扩展 ──
    payload: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True, comment="schema / checksum / tag 直方图等扩展字段",
    )
