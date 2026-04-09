from pathlib import Path
from typing import Any

import lance

from core.domain.models import LineageEvent
from core.profiles.runtime import RuntimeContainer
from workflows.ingestion.demo import ingest_local_dataset


def materialize_local_assets(container: RuntimeContainer, examples_dir: Path) -> dict[str, Any]:
    records = ingest_local_dataset(examples_dir / 'images', examples_dir / 'metadata')

    container.metadata.create_workspace({'workspace_id': 'local-workspace', 'name': 'Local Workspace'})
    container.query.create_sample_table(records)
    container.search.build_index(records)
    container.table.overwrite(
        'dataset_samples',
        [record.model_dump() for record in records],
    )

    dataset = container.metadata.create_dataset(
        {
            'dataset_id': 'demo-dataset',
            'name': 'Custom Local Demo Dataset',
            'workspace_id': 'local-workspace',
            'profile': container.profile.name,
        }
    )
    version = container.metadata.create_dataset_version(
        {
            'dataset_id': dataset['dataset_id'],
            'version_id': 'v1',
            'sample_count': len(records),
            'table_name': 'dataset_samples',
        }
    )
    run = container.compute.submit_job(
        'materialize_local_assets',
        {'dataset_id': dataset['dataset_id'], 'version_id': version['version_id']},
    )
    container.metadata.create_job_run(
        {'run_id': run.run_id, 'job_name': 'materialize_local_assets', 'status': run.status}
    )
    container.metadata.create_task(
        {
            'task_id': 'task-labeling-demo',
            'title': 'Review mined night pedestrian samples',
            'status': 'pending',
            'task_type': 'labeling-demo',
        }
    )
    export_job = container.metadata.create_export_job(
        {
            'export_id': 'export-demo-v1',
            'dataset_id': dataset['dataset_id'],
            'format': 'parquet',
            'status': 'ready',
            'output_path': str(Path('data/gold/dataset_samples.parquet')),
        }
    )
    container.metadata.append_lineage_event(
        LineageEvent(
            event_type='dataset_version_materialized',
            subject_id=version['version_id'],
            payload={'sample_count': len(records), 'export_id': export_job['export_id']},
        )
    )

    distribution = container.query.query_distribution()
    search_preview = container.search.search_by_filters({'scene': records[0].scene}, top_k=5) if records else []

    return {
        'workspace': 'local-workspace',
        'dataset': dataset,
        'dataset_version': version,
        'job_run': run.model_dump(),
        'record_count': len(records),
        'distribution': distribution,
        'search_preview': search_preview,
        'export_job': export_job,
        'capabilities': container.capabilities.model_dump(),
    }


def load_lance_rows(container: RuntimeContainer) -> list[dict[str, Any]]:
    dataset = lance.dataset(str(Path(container.profile.search['uri'])))
    return dataset.to_table().to_pylist()
