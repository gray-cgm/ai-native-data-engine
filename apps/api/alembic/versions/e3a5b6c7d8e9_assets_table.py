"""assets table

Revision ID: e3a5b6c7d8e9
Revises: d2f4a5b6c7d8
Create Date: 2026-04-28 16:00:00.000000

新增 Asset 表，承担"非 dataset 的数据资产"登记职责（raw + derived）。
配套设计文档：docs/architecture/dataset-snowflake-redesign.md §3。

PipelineRun.stage 字段在原 baseline 中本就用 ``native_enum=False`` 存为
VARCHAR(32)，应用层删除 PipelineStage Enum 之后无需 ALTER COLUMN（已有数据
直接当自由文本读出）。
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "e3a5b6c7d8e9"
down_revision = "d2f4a5b6c7d8"
branch_labels = None
depends_on = None


_ASSET_KIND_ENUM = sa.Enum("raw", "derived", name="assetkind", native_enum=False, length=16)


def upgrade() -> None:
    op.create_table(
        "assets",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=256), nullable=False),
        sa.Column("asset_kind", _ASSET_KIND_ENUM, nullable=False, index=True),
        sa.Column("uri", sa.String(length=512), nullable=False),
        sa.Column("format", sa.String(length=32), nullable=True),
        sa.Column("clip_id", sa.String(length=64), nullable=True, index=True),
        sa.Column(
            "producer_pipeline_run_id", sa.String(length=36),
            sa.ForeignKey("pipeline_runs.id"), nullable=True, index=True,
        ),
        sa.Column(
            "producer_event_id", sa.String(length=36),
            sa.ForeignKey("lineage_events.id"), nullable=True, index=True,
        ),
        sa.Column(
            "requirement_id", sa.String(length=36),
            sa.ForeignKey("requirements.id"), nullable=True, index=True,
        ),
        sa.Column("x_trace_id", sa.String(length=64), nullable=True, index=True),
        sa.Column("byte_size", sa.BigInteger(), nullable=True),
        sa.Column("row_count", sa.BigInteger(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("assets")
