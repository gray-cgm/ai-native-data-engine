import json
from pathlib import Path

from adapters.query.duckdb.adapter import DuckDBQueryAdapter
from adapters.vector.lance.adapter import LanceVectorAdapter
from core.domain.models import AuthenticatedUser, ComputeRun, SampleRecord, ScenarioTriageConfig, ScenarioTriageSummary
from core.profiles.runtime import RuntimeContainer
from workflows.ingestion.demo import ingest_local_dataset


def run_local_demo(base_dir: Path, examples_dir: Path) -> dict:
    records = ingest_local_dataset(examples_dir / 'images', examples_dir / 'metadata')

    duckdb_adapter = DuckDBQueryAdapter(
        db_path=base_dir / 'duckdb' / 'samples.duckdb',
        data_path=base_dir / 'silver' / 'samples.lance',
    )
    duckdb_adapter.create_sample_table(records)

    lance_adapter = LanceVectorAdapter(base_dir / 'lance' / 'samples.lance')
    lance_adapter.build_index(records)

    distribution = duckdb_adapter.query_distribution()
    return {
        'record_count': len(records),
        'distribution': distribution,
    }


def _score_record(record: SampleRecord, config: ScenarioTriageConfig) -> int:
    score = 0
    if record.scene in config.focus_scenes:
        score += 3
    for tag in record.tags:
        if tag in config.focus_tags:
            score += 2
    if {'pedestrian', 'crosswalk'}.issubset(set(record.tags)):
        score += 2
    if {'junction', 'traffic-light'}.intersection(set(record.tags)) and record.scene == 'intersection':
        score += 2
    return score


def run_scenario_triage_flow(
    container: RuntimeContainer,
    config: ScenarioTriageConfig,
    run: ComputeRun,
    operator: AuthenticatedUser | None = None,
) -> ScenarioTriageSummary:
    examples_dir = Path(config.examples_dir)
    records = ingest_local_dataset(examples_dir / 'images', examples_dir / 'metadata')
    record_rows = [record.model_dump() for record in records]

    container.query.create_sample_table(records)
    container.search.build_index(records)
    container.table.overwrite(config.table_name, record_rows)

    output_path = container.table.export(
        config.table_name,
        Path(config.export_output_uri),
        format=config.export_format,
    )
    distribution = container.query.query_distribution()
    search_rows = container.search.search_by_filters({}, top_k=100)

    scored_records = sorted(
        [
            {
                'id': record.id,
                'scene': record.scene,
                'tags': record.tags,
                'score': _score_record(record, config),
            }
            for record in records
        ],
        key=lambda item: item['score'],
        reverse=True,
    )
    scenario_rows = [item for item in scored_records if item['score'] > 0]
    priority_clip_ids = [item['id'] for item in scenario_rows[:3]]
    candidate_clip_ids = [item['id'] for item in scenario_rows]
    dominant_scene = scenario_rows[0]['scene'] if scenario_rows else (distribution[0]['scene'] if distribution else 'unknown')
    search_preview = [
        row
        for row in search_rows
        if row.get('id') in priority_clip_ids or row.get('scene') in config.focus_scenes
    ][:5]

    result = ScenarioTriageSummary(
        workspace_id=config.workspace_id,
        dataset_id=config.dataset_id,
        dataset_version_id=config.dataset_version_id,
        table_name=config.table_name,
        profile_name=container.profile.name,
        scenario_id=config.scenario_id,
        scenario_name=config.scenario_name,
        scenario_goal=config.scenario_goal,
        focus_scenes=config.focus_scenes,
        focus_tags=config.focus_tags,
        record_count=len(records),
        scenario_clip_count=len(candidate_clip_ids),
        dominant_scene=dominant_scene,
        candidate_clip_ids=candidate_clip_ids,
        priority_clip_ids=priority_clip_ids,
        distribution=distribution,
        search_preview=search_preview,
        summary_output_uri=config.summary_output_uri,
        export_id=config.export_id,
        export_format=config.export_format,
        export_output_path=str(output_path),
        run_id=run.run_id,
        run_status=run.status,
        orchestrator_job_name=config.orchestrator_job_name,
        orchestrator_asset_key=config.orchestrator_asset_key,
        operator=(operator.model_dump() if operator else {}),
    )

    with container.storage.open(config.summary_output_uri, 'w') as handle:
        json.dump(result.model_dump(), handle, ensure_ascii=True, indent=2)

    return result
