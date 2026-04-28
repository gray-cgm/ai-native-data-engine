"""数据集 Export 路由。

完成 dataset_version → 物理文件落盘后，**回写一次 DatasetSnapshotManifest**
（如果该 dataset_version 已经被 release 阶段挂到某个 trace），从而把链路 receipt
封口（sealed_at + export_artifact_uri + manifest JSON 落盘）。

异常处理：catalog 是 metadata adapter 库，apps/api 是另一张 SQLite。两边都失败
不阻塞主响应，但会把状态打到日志，便于 e2e_demo 排查。
"""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.core.runtime import get_runtime_container
from src.services import snapshot_service


router = APIRouter(prefix='/exports', tags=['exports'])

_log = logging.getLogger(__name__)


@router.post('/dataset/{dataset_id}')
def export_dataset(
    dataset_id: str,
    format: str = 'lance',
    request: Request = None,
    db: Session = Depends(get_db),
) -> dict:
    container = get_runtime_container()
    versions = container.metadata.list_dataset_versions(dataset_id)
    if not versions:
        return {'error': f'dataset {dataset_id} has no versions'}
    latest_version = versions[-1]
    output_path = Path('data/exports') / f'{dataset_id}-{latest_version["version_id"]}.{format}'
    container.table.export(latest_version['table_name'], output_path, format=format)
    export_job = container.metadata.create_export_job(
        {
            'export_id': f'export-{dataset_id}-{latest_version["version_id"]}-{format}',
            'dataset_id': dataset_id,
            'format': format,
            'status': 'ready',
            'output_path': str(output_path),
        }
    )

    # ── Manifest 回写：仅当此 dataset_version 已经登记到 snapshot 时 ──
    trace_id = (
        request.headers.get('X-Trace-Id') if request is not None else None
    ) or snapshot_service.find_trace_by_dataset_version(
        db, latest_version['version_id']
    )
    if trace_id:
        try:
            snapshot_service.attach_export_artifact(
                db,
                x_trace_id=trace_id,
                export_job_id=export_job.get('export_id') if isinstance(export_job, dict) else None,
                export_artifact_uri=str(output_path),
                export_format=format,
            )
            db.commit()
        except Exception as exc:  # noqa: BLE001 — 不要因 manifest 失败影响导出
            _log.warning("snapshot manifest update failed for trace %s: %s", trace_id, exc)
            db.rollback()

    return export_job
