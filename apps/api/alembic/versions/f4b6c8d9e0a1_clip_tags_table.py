"""clip_tags table

Revision ID: f4b6c8d9e0a1
Revises: e3a5b6c7d8e9
Create Date: 2026-05-02 18:00:00.000000

新增 clip_tags 关系表，结构化承载 clip 级 tag。
- (clip_id, name, source, source_version) 联合唯一
- source 区分 manual / auto_tagging / auto_labeling / rule / import
- source_version 必填，便于算法版本对照

设计文档：docs/architecture/tags-design.md。
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "f4b6c8d9e0a1"
down_revision = "e3a5b6c7d8e9"
branch_labels = None
depends_on = None


_TAG_SOURCE_ENUM = sa.Enum(
    "manual", "auto_tagging", "auto_labeling", "rule", "import",
    name="tagsource", native_enum=False, length=16,
)


def upgrade() -> None:
    op.create_table(
        "clip_tags",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("clip_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("source", _TAG_SOURCE_ENUM, nullable=False),
        sa.Column("source_version", sa.String(length=128), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("applied_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("x_trace_id", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint(
            "clip_id", "name", "source", "source_version",
            name="uq_clip_tags_dedupe",
        ),
    )
    op.create_index("ix_clip_tags_clip_id", "clip_tags", ["clip_id"])
    op.create_index("ix_clip_tags_name_source", "clip_tags", ["name", "source"])
    op.create_index("ix_clip_tags_x_trace_id", "clip_tags", ["x_trace_id"])


def downgrade() -> None:
    op.drop_index("ix_clip_tags_x_trace_id", table_name="clip_tags")
    op.drop_index("ix_clip_tags_name_source", table_name="clip_tags")
    op.drop_index("ix_clip_tags_clip_id", table_name="clip_tags")
    op.drop_table("clip_tags")
