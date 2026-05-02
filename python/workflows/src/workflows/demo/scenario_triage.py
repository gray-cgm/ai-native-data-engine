"""scenario_triage demo orchestration（框架中立）。

历史上这一段位于 ``python/services/__init__.py``。按 layering 文档的要求，
它应当作为 workflow 直接暴露给所有调用方（FastAPI route / Dagster asset / CLI），
不再经过单独的 services 包。

它做的事：
- 在锁内串起 auth / metadata / compute / 搜索 / 表导出 / lineage 等步骤
- 通过 :class:`RuntimeContainer` 取所有能力，不依赖 FastAPI / Dagster
- 也提供一个轻量 ``get_scenario_triage_summary`` 读取已有 summary（不触发副作用）
"""

from __future__ import annotations

import json
from pathlib import Path
from threading import Lock
from typing import Any

from core.domain.models import LineageEvent, ScenarioTriageConfig
from core.profiles.runtime import RuntimeContainer

from .pipeline import run_scenario_triage_flow


_SCENARIO_TRIAGE_LOCK = Lock()


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
    """读取已有的 scenario_triage summary；不存在则返回 None（不触发任何副作用）。"""
    config = _resolve_scenario_config(container, examples_dir)
    if not container.storage.exists(config.summary_output_uri):
        return None
    with container.storage.open(config.summary_output_uri, 'r') as handle:
        return json.load(handle)


def run_scenario_triage_demo(
    container: RuntimeContainer,
    examples_dir: Path | None = None,
) -> dict[str, Any]:
    """跑一遍 scenario_triage demo：会写 metadata、lineage、export 文件。

    并发安全：进程内有锁，避免重复跑产生冲突的 metadata 写入。
    """
    with _SCENARIO_TRIAGE_LOCK:
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
        container.metadata.create_dataset_version(
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
                'requirement_id': config.requirement_id,
                'operation_task_id': config.review_task_id,
                'trigger_source': 'requirement',
                'reason_code': 'requirement_fulfillment',
                'duration_seconds': float(max(scenario.record_count, 1) * 1.5),
                'cpu_seconds': float(max(scenario.record_count, 1) * 2.2),
                'gpu_seconds': 0.0,
                'input_bytes': int(max(scenario.record_count, 1) * 4_000_000),
                'output_bytes': int(max(scenario.scenario_clip_count, 1) * 2_000_000),
                'estimated_cost': round(max(scenario.record_count, 1) * 0.0035, 4),
                'derived_assets': [
                    {'type': 'dataset_version', 'id': config.dataset_version_id},
                    {'type': 'summary', 'uri': scenario.summary_output_uri},
                    {'type': 'export', 'id': config.export_id, 'path': scenario.export_output_path},
                ],
            }
        )
        task = container.metadata.create_task(
            {
                'task_id': config.review_task_id,
                'title': config.review_task_title,
                'status': 'done',
                'task_type': 'scenario-triage',
                'requirement_id': config.requirement_id,
                'pipeline_run_id': scenario.run_id,
                'assignee': operator.display_name if operator else None,
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
                    'priority_clip_ids': scenario.priority_clip_ids,
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


__all__ = [
    'get_scenario_triage_summary',
    'run_scenario_triage_demo',
]
