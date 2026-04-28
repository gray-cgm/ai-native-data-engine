"""模型包入口：统一导出所有 SQLAlchemy 模型

确保 Base.metadata 能发现所有表定义，init_db() 才能正确建表。
"""

from src.models.base import Base  # noqa: F401 — 触发 Base 注册

# 导入所有模型，使 SQLAlchemy 的 metadata.create_all 能发现它们
from src.models.requirement import (  # noqa: F401
    AnnotationTask,
    CollectionJob,
    DataTask,
    DigitalReconstruction,
    OperationsTask,
    PipelineRun,
    Requirement,
)
from src.models.ops_item import OpsItem  # noqa: F401
from src.models.dataset_snapshot import DatasetSnapshotManifest  # noqa: F401

__all__ = [
    "Base",
    "Requirement",
    "DataTask",
    "DigitalReconstruction",
    "CollectionJob",
    "AnnotationTask",
    "OperationsTask",
    "PipelineRun",
    "OpsItem",
    "DatasetSnapshotManifest",
]
