"""dataset_v2 + lineage_events

Revision ID: d2f4a5b6c7d8
Revises: c1e2d3a4b5f6
Create Date: 2026-04-28 14:00:00.000000

新增 4 张表：
- datasets_v2 / dataset_samples_v2：训练事实表（覆盖 official 1切4 / flexible / random_sample）
- lineage_events / event_results：Snowflake 事件中心 + 维度（Tagging / Labeling / Checking / Mining）

旧 catalog adapter 的 datasets / dataset_versions 表保留只读，演进期不动。
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "d2f4a5b6c7d8"
down_revision = "c1e2d3a4b5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── datasets_v2 ─────────────────────────────────────────────────────
    op.create_table(
        "datasets_v2",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=128), nullable=False, index=True),
        sa.Column("dataset_type", sa.String(length=16), nullable=False),
        sa.Column("dataset_version", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("source_type", sa.String(length=16), nullable=False),
        sa.Column("requirement_id", sa.String(length=36),
                  sa.ForeignKey("requirements.id"), nullable=True, index=True),
        sa.Column("allow_train", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        sa.Column("tag_expr", sa.String(length=512), nullable=True),
        sa.Column("slice_strategy", sa.String(length=32), nullable=False),
        sa.Column("ts_policy", sa.String(length=32), nullable=False),
        sa.Column("default_range_l", sa.Integer(), nullable=False, server_default="-1"),
        sa.Column("default_range_r", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("created_by", sa.String(length=64), nullable=False, server_default="system"),
        sa.Column("resolved_meta", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )

    # ── dataset_samples_v2 ──────────────────────────────────────────────
    op.create_table(
        "dataset_samples_v2",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("dataset_id", sa.String(length=36),
                  sa.ForeignKey("datasets_v2.id"), nullable=False, index=True),
        sa.Column("clip_id", sa.String(length=64), nullable=False, index=True),
        sa.Column("ts", sa.BigInteger(), nullable=False),
        sa.Column("range_l", sa.Integer(), nullable=False, server_default="-1"),
        sa.Column("range_r", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("ts_origin", sa.String(length=32), nullable=False),
        sa.Column("origin_ref", sa.String(length=128), nullable=True),
        sa.Column("extra_meta", sa.JSON(), nullable=True),
        sa.Column("training_type", sa.String(length=16), nullable=False, server_default="train"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("dataset_id", "clip_id", "ts", name="uq_sample_dataset_clip_ts"),
    )

    # ── lineage_events ──────────────────────────────────────────────────
    op.create_table(
        "lineage_events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("event_id", sa.String(length=64), nullable=True, index=True),
        sa.Column("event_type", sa.String(length=32), nullable=False, index=True),
        sa.Column("job_id", sa.String(length=64), nullable=True),
        sa.Column("requirement_id", sa.String(length=36),
                  sa.ForeignKey("requirements.id"), nullable=True, index=True),
        sa.Column("operations_task_id", sa.String(length=36),
                  sa.ForeignKey("operations_tasks.id"), nullable=True, index=True),
        sa.Column("pipeline_run_id", sa.String(length=36),
                  sa.ForeignKey("pipeline_runs.id"), nullable=True, index=True),
        sa.Column("source_type", sa.String(length=64), nullable=True),
        sa.Column("snapshot_id", sa.BigInteger(), nullable=True),
        sa.Column("pipeline_commit", sa.String(length=40), nullable=True),
        sa.Column("pipeline_repo", sa.String(length=128), nullable=True),
        sa.Column("branch_name", sa.String(length=128), nullable=True),
        sa.Column("table_name", sa.String(length=128), nullable=True),
        sa.Column("x_trace_id", sa.String(length=64), nullable=True, index=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )

    # ── event_results ───────────────────────────────────────────────────
    op.create_table(
        "event_results",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("event_pk", sa.String(length=36),
                  sa.ForeignKey("lineage_events.id"), nullable=False, index=True),
        sa.Column("clip_id", sa.String(length=64), nullable=False, index=True),
        sa.Column("payload_type", sa.String(length=32), nullable=False, index=True),
        sa.Column("tags", sa.String(length=256), nullable=True),
        sa.Column("da_tags", sa.String(length=256), nullable=True),
        sa.Column("trigger_event_tags", sa.String(length=256), nullable=True),
        sa.Column("ts", sa.BigInteger(), nullable=True),
        sa.Column("extra", sa.JSON(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("event_results")
    op.drop_table("lineage_events")
    op.drop_table("dataset_samples_v2")
    op.drop_table("datasets_v2")
