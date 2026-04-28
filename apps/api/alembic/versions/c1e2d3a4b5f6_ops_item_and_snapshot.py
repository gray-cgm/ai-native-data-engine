"""ops_item and dataset_snapshot_manifest

Revision ID: c1e2d3a4b5f6
Revises: 103d2e06c8e1
Create Date: 2026-04-28 09:00:00.000000

新增两张表：
- ops_items: OperationsTask 下的执行子项（替代 ops_modules 的 _InMemoryStore）
- dataset_snapshot_manifests: 端到端链路 receipt（trace → gold run → dataset → export）
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "c1e2d3a4b5f6"
down_revision = "103d2e06c8e1"
branch_labels = None
depends_on = None


_OPS_MODULE_ENUM = sa.Enum(
    "LABELING", "TAGGING", "CHECKING", "MINING", "PRIVACY", "RELEASE",
    name="operationsmodule", native_enum=False, length=32,
)


def upgrade() -> None:
    op.create_table(
        "ops_items",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "operations_task_id", sa.String(length=36),
            sa.ForeignKey("operations_tasks.id"), nullable=True, index=True,
        ),
        sa.Column("requirement_id", sa.String(length=36), nullable=True, index=True),
        sa.Column("data_task_id", sa.String(length=36), nullable=True, index=True),
        sa.Column("x_trace_id", sa.String(length=64), nullable=True, index=True),
        sa.Column("module", _OPS_MODULE_ENUM, nullable=False, index=True),
        sa.Column("title", sa.String(length=256), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, index=True),
        sa.Column("kind", sa.String(length=32), nullable=True),
        sa.Column("owner", sa.String(length=128), nullable=True),
        sa.Column("clip_ids", sa.JSON(), nullable=True),
        sa.Column("dataset_id", sa.String(length=64), nullable=True),
        sa.Column("scenario", sa.String(length=64), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "dataset_snapshot_manifests",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("x_trace_id", sa.String(length=64), nullable=False, unique=True, index=True),
        sa.Column(
            "requirement_id", sa.String(length=36),
            sa.ForeignKey("requirements.id"), nullable=True, index=True,
        ),
        sa.Column("data_task_id", sa.String(length=36), nullable=True),
        sa.Column("operations_task_id", sa.String(length=36), nullable=True),
        sa.Column("gold_pipeline_run_id", sa.String(length=36), nullable=True),
        sa.Column("pipeline_run_count", sa.Integer(), default=0),
        sa.Column("dataset_id", sa.String(length=64), nullable=True),
        sa.Column("dataset_version_id", sa.String(length=64), nullable=True),
        sa.Column("export_job_id", sa.String(length=128), nullable=True),
        sa.Column("export_artifact_uri", sa.String(length=512), nullable=True),
        sa.Column("export_format", sa.String(length=16), nullable=True),
        sa.Column("clip_ids", sa.JSON(), nullable=True),
        sa.Column("scenario", sa.String(length=64), nullable=True),
        sa.Column("title", sa.String(length=256), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("manifest_json", sa.JSON(), nullable=True),
        sa.Column("sealed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("dataset_snapshot_manifests")
    op.drop_table("ops_items")
