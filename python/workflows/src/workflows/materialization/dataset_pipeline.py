from pathlib import Path
from typing import Any

from core.domain.models import ScenarioTriageConfig
from core.profiles.runtime import RuntimeContainer
from workflows.demo import run_scenario_triage_flow


def materialize_scenario_assets(container: RuntimeContainer, examples_dir: Path) -> dict[str, Any]:
    config = container.profile.scenario.model_copy(
        update={
            'examples_dir': str(examples_dir),
            'orchestrator_job_name': 'materialize_scenario_assets',
            'orchestrator_asset_key': 'materialize_scenario_assets',
        }
    )
    run = container.compute.submit_job(
        'materialize_scenario_assets',
        {'dataset_id': config.dataset_id, 'dataset_version_id': config.dataset_version_id, 'scenario_id': config.scenario_id},
    )
    scenario = run_scenario_triage_flow(container, config, run)

    return {
        'workspace': config.workspace_id,
        'dataset': {
            'dataset_id': config.dataset_id,
            'name': config.dataset_name,
            'workspace_id': config.workspace_id,
            'profile': container.profile.name,
        },
        'dataset_version': {
            'dataset_id': config.dataset_id,
            'version_id': config.dataset_version_id,
            'sample_count': scenario.record_count,
            'table_name': config.table_name,
        },
        'job_run': run.model_dump(),
        'record_count': scenario.record_count,
        'distribution': scenario.distribution,
        'search_preview': scenario.search_preview,
        'scenario': scenario.model_dump(),
        'export_job': {
            'export_id': scenario.export_id,
            'dataset_id': config.dataset_id,
            'format': scenario.export_format,
            'status': 'ready',
            'output_path': scenario.export_output_path,
        },
        'capabilities': container.capabilities.model_dump(),
    }


def load_lance_rows(container: RuntimeContainer) -> list[dict[str, Any]]:
    return container.search.search_by_filters({}, top_k=100)
