from pathlib import Path

from fastapi import APIRouter

from src.core.runtime import get_runtime_container

router = APIRouter(prefix='/exports', tags=['exports'])


@router.post('/dataset/{dataset_id}')
def export_dataset(dataset_id: str, format: str = 'parquet') -> dict:
    container = get_runtime_container()
    versions = container.metadata.list_dataset_versions(dataset_id)
    if not versions:
        return {'error': f'dataset {dataset_id} has no versions'}
    latest_version = versions[-1]
    suffix = 'parquet' if format == 'parquet' else format
    output_path = Path('data/exports') / f'{dataset_id}-{latest_version["version_id"]}.{suffix}'
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
    return export_job
