"""exports P1: export_consumption_events

Revision ID: b8d3e5f7a921
Revises: a7c9e1d2f3b4
Create Date: 2026-05-04 18:00:00.000000

P1 范围（详见 docs/dev-logs/2026-05-04-exports-sample-contribution-design.md §3.2）：
- 新建 export_consumption_events（sample 级训练消费事件）

MVP 阶段先落主 SQLite；P3 之前迁 DuckDB（接口契约不变）。
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "b8d3e5f7a921"
down_revision = "a7c9e1d2f3b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "export_consumption_events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("snapshot_trace", sa.String(length=64), nullable=False),
        sa.Column("sample_uid", sa.String(length=255), nullable=False),
        sa.Column("train_run_id", sa.String(length=36), nullable=False),
        sa.Column("epoch", sa.Integer(), nullable=True),
        sa.Column("step", sa.Integer(), nullable=True),
        sa.Column("loss", sa.Float(), nullable=True),
        sa.Column("ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("x_trace_id", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_consumption_events_snapshot_trace",
                    "export_consumption_events", ["snapshot_trace"])
    op.create_index("ix_consumption_events_sample_uid",
                    "export_consumption_events", ["sample_uid"])
    op.create_index("ix_consumption_events_train_run_id",
                    "export_consumption_events", ["train_run_id"])
    op.create_index("ix_consumption_events_x_trace_id",
                    "export_consumption_events", ["x_trace_id"])


def downgrade() -> None:
    op.drop_index("ix_consumption_events_x_trace_id",
                  table_name="export_consumption_events")
    op.drop_index("ix_consumption_events_train_run_id",
                  table_name="export_consumption_events")
    op.drop_index("ix_consumption_events_sample_uid",
                  table_name="export_consumption_events")
    op.drop_index("ix_consumption_events_snapshot_trace",
                  table_name="export_consumption_events")
    op.drop_table("export_consumption_events")
