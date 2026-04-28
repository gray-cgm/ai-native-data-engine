"""Dataset + DatasetSample —— 训练事实表（v2）

设计取舍（参考 docs/architecture/dataset-snowflake-redesign.md §2）：
- ``datasets_v2`` 与旧 catalog adapter 的 ``datasets`` 表并存：旧表只读，
  保留过渡期；写入端只走新表。
- 一张主表 ``datasets_v2`` + 一张事实表 ``dataset_samples_v2``。
  样本以 ``(dataset_id, clip_id, ts)`` 为唯一性约束，重复切割幂等。
- ``slice_strategy`` / ``ts_policy`` 用字符串保留扩展性，避免一开始 enum
  收紧；service 层做 normalize。
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


# ── Dataset 主表 ─────────────────────────────────────────────────────


class Dataset(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """数据集主表（official / customized 都覆盖）"""

    __tablename__ = "datasets_v2"

    name: Mapped[str] = mapped_column(
        String(128), nullable=False, index=True,
        comment="数据集名称，如 ds_migration_cutin_v1",
    )
    dataset_type: Mapped[str] = mapped_column(
        String(16), nullable=False,
        comment="official / customized（API 校验：source_type=csv ⇒ customized）",
    )
    dataset_version: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False,
        comment="跟随 lance version 单调递增",
    )
    source_type: Mapped[str] = mapped_column(
        String(16), nullable=False,
        comment="tags / csv / other（API 由创建入口决定）",
    )
    requirement_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("requirements.id"), nullable=True, index=True,
        comment="关联需求 ID（demand_id 等价）",
    )
    allow_train: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False,
        comment="是否可训练（API 强约束：customized ⇒ false）",
    )
    status: Mapped[str] = mapped_column(
        String(16), default="active", nullable=False,
        comment="active / frozen / deprecated（API 维护）",
    )
    tag_expr: Mapped[Optional[str]] = mapped_column(
        String(512), nullable=True,
        comment="tag 组合表达式（official 必填），e.g. 'migration_v1 AND cutin'",
    )
    slice_strategy: Mapped[str] = mapped_column(
        String(32), nullable=False,
        comment="one_to_four / flexible / random_sample / no_ts（API 推断）",
    )
    ts_policy: Mapped[str] = mapped_column(
        String(32), nullable=False,
        comment="parse_from_tag / compute_1to4 / read_from_csv / flexible_window / none",
    )
    default_range_l: Mapped[int] = mapped_column(
        Integer, default=-1, nullable=False, comment="默认左偏移",
    )
    default_range_r: Mapped[int] = mapped_column(
        Integer, default=3, nullable=False, comment="默认右偏移",
    )
    created_by: Mapped[str] = mapped_column(
        String(64), default="system", nullable=False, comment="创建人/系统",
    )
    resolved_meta: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True, comment="系统固化推断信息（{rules:[...]} 等）",
    )

    # ── 关系 ──
    samples: Mapped[list["DatasetSample"]] = relationship(
        back_populates="dataset", cascade="all, delete-orphan"
    )


# ── DatasetSample 事实表 ─────────────────────────────────────────────


class DatasetSample(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """训练 / 消费唯一事实表 —— official tags 生成 / customized 切割都落到这里。"""

    __tablename__ = "dataset_samples_v2"
    __table_args__ = (
        UniqueConstraint("dataset_id", "clip_id", "ts", name="uq_sample_dataset_clip_ts"),
    )

    dataset_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("datasets_v2.id"), nullable=False, index=True,
    )
    clip_id: Mapped[str] = mapped_column(
        String(64), nullable=False, index=True, comment="clip id（来自 tag_index 或切割动作）",
    )
    ts: Mapped[int] = mapped_column(
        BigInteger, nullable=False, comment="样本中心时间戳（纳秒），一定不为空",
    )
    range_l: Mapped[int] = mapped_column(
        Integer, default=-1, nullable=False, comment="左偏移（取 dataset 默认或 sample 覆盖）",
    )
    range_r: Mapped[int] = mapped_column(
        Integer, default=3, nullable=False, comment="右偏移",
    )
    ts_origin: Mapped[str] = mapped_column(
        String(32), nullable=False,
        comment="from_tag / computed_1to4 / from_csv / flexible / random_window",
    )
    origin_ref: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True, comment="tag_name / csv_row_id / event_id"
    )
    extra_meta: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True, comment='{"part":2,"raw":"..."} 等附加信息',
    )
    training_type: Mapped[str] = mapped_column(
        String(16), default="train", nullable=False,
        comment="train / test / holdout（入库即随机分配）",
    )

    # ── 关系 ──
    dataset: Mapped["Dataset"] = relationship(back_populates="samples")
