"""Application service entrypoints for the local autonomous-driving scenario chain."""

import json
from pathlib import Path
from typing import Any

from core.domain.models import LineageEvent, ScenarioTriageConfig
from core.profiles.runtime import RuntimeContainer
from workflows.demo import run_scenario_triage_flow


def _resolve_scenario_config(
	container: RuntimeContainer,
	examples_dir: Path | None = None,
) -> ScenarioTriageConfig:
	config = container.profile.scenario
	if examples_dir is None:
		return config
	return config.model_copy(update={'examples_dir': str(examples_dir)})


def get_scenario_triage_summary(
	container: RuntimeContainer,
	examples_dir: Path | None = None,
) -> dict[str, Any] | None:
	config = _resolve_scenario_config(container, examples_dir)
	if not container.storage.exists(config.summary_output_uri):
		return None
	with container.storage.open(config.summary_output_uri, 'r') as handle:
		return json.load(handle)


def run_scenario_triage(
	container: RuntimeContainer,
	examples_dir: Path | None = None,
) -> dict[str, Any]:
	config = _resolve_scenario_config(container, examples_dir)
	operator = container.auth.authenticate(config.operator_username, config.operator_password)
	token = container.auth.issue_token(operator) if operator else None

	container.metadata.create_workspace(
		{'workspace_id': config.workspace_id, 'name': 'Local AD Workspace'}
	)
	dataset = container.metadata.create_dataset(
		{
			'dataset_id': config.dataset_id,
			'name': config.dataset_name,
			'workspace_id': config.workspace_id,
			'profile': container.profile.name,
		}
	)
	version = container.metadata.create_dataset_version(
		{
			'dataset_id': config.dataset_id,
			'version_id': config.dataset_version_id,
			'sample_count': 0,
			'table_name': config.table_name,
		}
	)
	run = container.compute.submit_job(
		config.orchestrator_job_name,
		{
			'dataset_id': config.dataset_id,
			'dataset_version_id': config.dataset_version_id,
			'scenario_id': config.scenario_id,
			'examples_dir': config.examples_dir,
			'asset_key': config.orchestrator_asset_key,
		},
	)
	scenario = run_scenario_triage_flow(container, config, run, operator=operator)

	version = container.metadata.create_dataset_version(
		{
			'dataset_id': config.dataset_id,
			'version_id': config.dataset_version_id,
			'sample_count': scenario.record_count,
			'table_name': config.table_name,
		}
	)
	job_run = container.metadata.create_job_run(
		{
			'run_id': scenario.run_id,
			'job_name': config.orchestrator_job_name,
			'status': scenario.run_status,
		}
	)
	task = container.metadata.create_task(
		{
			'task_id': config.review_task_id,
			'title': config.review_task_title,
			'status': 'done',
			'task_type': 'scenario-triage',
		}
	)
	export_job = container.metadata.create_export_job(
		{
			'export_id': config.export_id,
			'dataset_id': config.dataset_id,
			'format': config.export_format,
			'status': 'ready',
			'output_path': scenario.export_output_path,
		}
	)
	lineage = container.metadata.append_lineage_event(
		LineageEvent(
			event_type='scenario_triage_completed',
			subject_id=config.dataset_version_id,
			payload={
				'dataset_id': config.dataset_id,
				'scenario_id': config.scenario_id,
				'run_id': scenario.run_id,
				'summary_output_uri': scenario.summary_output_uri,
				'export_id': config.export_id,
				'priority_sample_ids': scenario.priority_sample_ids,
			},
		)
	)

	return {
		'workspace': config.workspace_id,
		'dataset': dataset,
		'dataset_version': version,
		'job_run': job_run,
		'task': task,
		'export_job': export_job,
		'scenario': scenario.model_dump(),
		'operator_token': token,
		'lineage': lineage,
		'capabilities': container.capabilities.model_dump(),
	}


__all__ = ['get_scenario_triage_summary', 'run_scenario_triage']
