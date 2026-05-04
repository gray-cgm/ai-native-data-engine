"""exports P0: train_runs + snapshot consumption columns

Revision ID: a7c9e1d2f3b4
Revises: f4b6c8d9e0a1
Create Date: 2026-05-04 10:00:00.000000

P0 范围（详见 docs/dev-logs/2026-05-04-exports-sample-contribution-design.md）：
- 新建 train_runs 表（snapshot ↔ 消费方对账锚点）
- dataset_snapshot_manifests 加 4 字段：consumed_count / train_run_count /
  last_consumed_at / hard_sample_count

P1 (consumption events / DuckDB) 与 P2 (sample_contributions) 不在本迁移内。
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "a7c9e1d2f3b4"
down_revision = "f4b6c8d9e0a1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. 扩 dataset_snapshot_manifests 4 列 ──
    with op.batch_alter_table("dataset_snapshot_manifests") as batch:
        batch.add_column(sa.Column(
            "consumed_count", sa.Integer(),
            nullable=False, server_default="0",
        ))
        batch.add_column(sa.Column(
            "train_run_count", sa.Integer(),
            nullable=False, server_default="0",
        ))
        batch.add_column(sa.Column(
            "last_consumed_at", sa.DateTime(timezone=True), nullable=True,
        ))
        batch.add_column(sa.Column(
            "hard_sample_count", sa.Integer(),
            nullable=False, server_default="0",
        ))

    # ── 2. 新建 train_runs ──
    op.create_table(
        "train_runs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=256), nullable=True),
        sa.Column("consumer", sa.String(length=128), nullable=True),
        sa.Column("external_run_id", sa.String(length=128), nullable=True),
        sa.Column("model_version", sa.String(length=128), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=16),
                  nullable=False, server_default="running"),
        sa.Column("snapshot_ids", sa.JSON(), nullable=True),
        sa.Column("parent_trace_ids", sa.JSON(), nullable=True),
        sa.Column("x_trace_id", sa.String(length=64), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_train_runs_consumer", "train_runs", ["consumer"])
    op.create_index("ix_train_runs_external_run_id", "train_runs", ["external_run_id"])
    op.create_index("ix_train_runs_x_trace_id", "train_runs", ["x_trace_id"])


def downgrade() -> None:
    op.drop_index("ix_train_runs_x_trace_id", table_name="train_runs")
    op.drop_index("ix_train_runs_external_run_id", table_name="train_runs")
    op.drop_index("ix_train_runs_consumer", table_name="train_runs")
    op.drop_table("train_runs")
    with op.batch_alter_table("dataset_snapshot_manifests") as batch:
        batch.drop_column("hard_sample_count")
        batch.drop_column("last_consumed_at")
        batch.drop_column("train_run_count")
        batch.drop_column("consumed_count")
