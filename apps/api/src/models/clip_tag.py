"""ClipTag —— clip 级 tag 的结构化关系表

设计参考 docs/architecture/tags-design.md。

核心点：
- 每行 = 一个 (clip_id, name, source, source_version) 四元组
- ``source`` 区分人工 / 自动 / 规则 / import 五类
- ``source_version`` 必填：auto 类是模型版本（``auto-tagger@v3.2``），
  manual 类是 ``user:<email>``；用于 A/B 对照与算法升级回归
- 同一 tag 在不同 source_version 下可共存（不互相覆盖）
- ``confidence`` 对 auto 必填，manual 可空
- ``x_trace_id`` 串入 Snowflake 链路，便于按 trace 反查
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, Float, String, Text, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class TagSource(str, enum.Enum):
    """tag 来源 5 类"""

    MANUAL = "manual"               # 人工添加（标注员 / 运营 / 算法工程师）
    AUTO_TAGGING = "auto_tagging"   # auto_tagging pipeline 系统打标
    AUTO_LABELING = "auto_labeling" # auto_labeling pipeline 副产 tag
    RULE = "rule"                   # 规则引擎匹配
    IMPORT = "import"               # 外部 vendor / 上游系统导入


class ClipTag(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """clip 级结构化 tag。一条 clip 可有多条 tag，按 source × source_version 区分。"""

    __tablename__ = "clip_tags"
    __table_args__ = (
        UniqueConstraint(
            "clip_id", "name", "source", "source_version",
            name="uq_clip_tags_dedupe",
        ),
        Index("ix_clip_tags_name_source", "name", "source"),
        Index("ix_clip_tags_clip_id", "clip_id"),
        Index("ix_clip_tags_x_trace_id", "x_trace_id"),
    )

    clip_id: Mapped[str] = mapped_column(
        String(36), nullable=False, comment="所属 clip"
    )
    name: Mapped[str] = mapped_column(
        String(64), nullable=False,
        comment="tag 名（snake_case 或 kebab-case，建议带前缀 scene-/attr-/event-）",
    )
    source: Mapped[str] = mapped_column(
        Enum(TagSource, native_enum=False, length=16),
        nullable=False, comment="manual / auto_tagging / auto_labeling / rule / import",
    )
    source_version: Mapped[str] = mapped_column(
        String(128), nullable=False,
        comment="auto: '<tagger_id>@<semver>'；manual: 'user:<email>'；rule: 'rule:<id>@<semver>'",
    )
    confidence: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True, comment="auto 类必填 [0,1]；manual 一般为 NULL",
    )
    applied_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        comment="tag 实际生效时间",
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        comment="额外上下文（model_run_id / rule_id / reviewer notes）",
    )
    x_trace_id: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, comment="串入 Snowflake 链路",
    )
