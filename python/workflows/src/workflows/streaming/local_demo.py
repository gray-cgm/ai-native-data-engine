import json
from collections.abc import Iterable
from pathlib import Path
from typing import Any

from adapters.query.duckdb.adapter import DuckDBQueryAdapter
from adapters.table.lance.adapter import LanceTableAdapter
from adapters.vector.lance.adapter import LanceVectorAdapter
from core.domain.models import LineageEvent, SampleRecord
from core.profiles.runtime import RuntimeContainer

DEFAULT_EVENT_LOG_PATH = Path('data/raw/streaming/local-events.jsonl')
# v3：放弃 ingest/curate/publish 三段；产物按 Asset 概念落到 data/raw/ 与
# data/assets/，发版数据集落到 data/exports/。
DEFAULT_NORMALIZED_LOG_PATH = Path('data/raw/streaming/normalized-events.jsonl')
DEFAULT_QUERY_DB_PATH = Path('data/duckdb/streaming_demo.duckdb')
DEFAULT_QUERY_DATASET_PATH = Path('data/assets/streaming_samples.lance')
DEFAULT_SEARCH_INDEX_PATH = Path('data/lance/streaming_samples.lance')
DEFAULT_RELEASE_ROOT = Path('data/exports/streaming')
DEFAULT_EXPORT_PATH = Path('data/exports/local-streaming-demo-latest.jsonl')
DEFAULT_SUMMARY_PATH = Path('data/exports/local-streaming-summary.json')

STREAM_WORKSPACE_ID = 'local-streaming-workspace'
STREAM_DATASET_ID = 'local-streaming-demo'
STREAM_DATASET_NAME = 'Local First Streaming Demo'
STREAM_TABLE_NAME = 'streaming_samples'
STREAM_JOB_NAME = 'local_streaming_micro_batch'
STREAM_EXPORT_ID = 'local-streaming-export-latest'


def generate_demo_stream_events(
    output_path: Path = DEFAULT_EVENT_LOG_PATH,
    metadata_dir: Path = Path('examples/datasets/custom-local/metadata'),
    *,
    loops: int = 4,
) -> Path:
    templates = []
    for metadata_path in sorted(metadata_dir.glob('*.json')):
        payload = json.loads(metadata_path.read_text())
        templates.append(
            {
                'frame_id': metadata_path.stem,
                'image_path': str((metadata_path.parent.parent / 'images' / f'{metadata_path.stem}.jpg').as_posix()),
                'metadata_path': str(metadata_path.as_posix()),
                'scene': payload.get('scene', 'unknown'),
                'timestamp': payload.get('timestamp', '1970-01-01T00:00:00Z'),
                'tags': payload.get('tags', []),
            }
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open('w') as handle:
        sequence = 0
        for loop_index in range(loops):
            for template in templates:
                sequence += 1
                event = {
                    'event_id': f'stream-event-{sequence:04d}',
                    'source': 'local-file-simulator',
                    'sequence': sequence,
                    'event_time': template['timestamp'],
                    'ingested_at': f'2026-04-16T09:{sequence:02d}:00Z',
                    'sample_id': f"{template['frame_id']}-stream-{loop_index + 1:02d}",
                    'image_path': template['image_path'],
                    'metadata_path': template['metadata_path'],
                    'scene': template['scene'],
                    'tags': template['tags'],
                }
                handle.write(json.dumps(event, ensure_ascii=True) + '\n')

        if templates:
            duplicate = {
                'event_id': 'stream-event-0003',
                'source': 'local-file-simulator',
                'sequence': sequence + 1,
                'event_time': templates[0]['timestamp'],
                'ingested_at': '2026-04-16T09:59:00Z',
                'sample_id': 'duplicate-frame-event',
                'image_path': templates[0]['image_path'],
                'metadata_path': templates[0]['metadata_path'],
                'scene': templates[0]['scene'],
                'tags': templates[0]['tags'],
            }
            handle.write(json.dumps(duplicate, ensure_ascii=True) + '\n')

    return output_path


def _chunked(items: list[dict[str, Any]], batch_size: int) -> Iterable[list[dict[str, Any]]]:
    for start_index in range(0, len(items), batch_size):
        yield items[start_index:start_index + batch_size]


def _load_events(event_log_path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with event_log_path.open() as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def _append_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a') as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=True) + '\n')


def _serialize_records(records: list[SampleRecord]) -> list[dict[str, Any]]:
    return [record.model_dump() for record in records]


def _build_distribution_by_tag(records: list[SampleRecord]) -> list[dict[str, Any]]:
    counts: dict[str, int] = {}
    for record in records:
        for tag in record.tags:
            counts[tag] = counts.get(tag, 0) + 1
    return [
        {'tag': tag, 'sample_count': sample_count}
        for tag, sample_count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    ]


def run_local_streaming_demo(
    container: RuntimeContainer,
    *,
    event_log_path: Path = DEFAULT_EVENT_LOG_PATH,
    batch_size: int = 4,
) -> dict[str, Any]:
    if batch_size <= 0:
        raise ValueError('batch_size must be greater than 0')

    if not event_log_path.exists():
        generate_demo_stream_events(event_log_path)

    events = _load_events(event_log_path)
    query = DuckDBQueryAdapter(
        db_path=DEFAULT_QUERY_DB_PATH,
        data_path=DEFAULT_QUERY_DATASET_PATH,
    )
    search = LanceVectorAdapter(DEFAULT_SEARCH_INDEX_PATH)
    table = LanceTableAdapter(DEFAULT_RELEASE_ROOT)

    container.metadata.create_workspace(
        {'workspace_id': STREAM_WORKSPACE_ID, 'name': 'Local Streaming Workspace'}
    )
    container.metadata.create_dataset(
        {
            'dataset_id': STREAM_DATASET_ID,
            'name': STREAM_DATASET_NAME,
            'workspace_id': STREAM_WORKSPACE_ID,
            'profile': container.profile.name,
        }
    )

    DEFAULT_NORMALIZED_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    DEFAULT_NORMALIZED_LOG_PATH.write_text('')

    seen_event_ids: set[str] = set()
    latest_records: dict[str, SampleRecord] = {}
    total_duplicates = 0
    batch_summaries: list[dict[str, Any]] = []

    for batch_number, batch in enumerate(_chunked(events, batch_size), start=1):
        run = container.compute.submit_job(
            STREAM_JOB_NAME,
            {
                'dataset_id': STREAM_DATASET_ID,
                'batch_number': batch_number,
                'event_count': len(batch),
                'mode': 'local-micro-batch',
            },
        )

        normalized_batch: list[dict[str, Any]] = []
        new_sample_ids: list[str] = []

        for event in batch:
            event_id = str(event['event_id'])
            if event_id in seen_event_ids:
                total_duplicates += 1
                continue

            seen_event_ids.add(event_id)
            record = SampleRecord(
                id=str(event['sample_id']),
                image_path=str(event['image_path']),
                metadata_path=str(event['metadata_path']),
                scene=str(event.get('scene', 'unknown')),
                timestamp=str(event.get('event_time', event.get('timestamp', '1970-01-01T00:00:00Z'))),
                tags=[str(tag) for tag in event.get('tags', [])],
            )
            latest_records[record.id] = record
            new_sample_ids.append(record.id)
            normalized_batch.append(
                {
                    'event_id': event_id,
                    'sample_id': record.id,
                    'sequence': int(event.get('sequence', batch_number)),
                    'source': str(event.get('source', 'local-file-simulator')),
                    'event_time': record.timestamp,
                    'ingested_at': str(event.get('ingested_at', record.timestamp)),
                    'scene': record.scene,
                    'tags': record.tags,
                }
            )

        _append_jsonl(DEFAULT_NORMALIZED_LOG_PATH, normalized_batch)

        current_records = sorted(latest_records.values(), key=lambda record: (record.timestamp, record.id))
        query.create_sample_table(current_records)
        search.build_index(current_records)
        table.overwrite(STREAM_TABLE_NAME, _serialize_records(current_records))

        version_id = f'stream-batch-{batch_number:03d}'
        distribution = query.query_distribution()
        batch_summary = {
            'batch_number': batch_number,
            'input_events': len(batch),
            'accepted_events': len(normalized_batch),
            'unique_samples': len(current_records),
            'new_sample_ids': new_sample_ids,
            'distribution': distribution,
            'run_id': run.run_id,
            'run_status': run.status,
        }
        batch_summaries.append(batch_summary)

        container.metadata.create_dataset_version(
            {
                'dataset_id': STREAM_DATASET_ID,
                'version_id': version_id,
                'sample_count': len(current_records),
                'table_name': STREAM_TABLE_NAME,
            }
        )
        container.metadata.create_job_run(
            {
                'run_id': run.run_id,
                'job_name': STREAM_JOB_NAME,
                'status': run.status,
            }
        )
        container.metadata.append_lineage_event(
            LineageEvent(
                event_type='stream_batch_materialized',
                subject_id=version_id,
                payload={
                    'dataset_id': STREAM_DATASET_ID,
                    'batch_number': batch_number,
                    'accepted_events': len(normalized_batch),
                    'duplicate_events_skipped': total_duplicates,
                    'release_table': STREAM_TABLE_NAME,
                },
            )
        )

    export_path = table.export(STREAM_TABLE_NAME, DEFAULT_EXPORT_PATH, format='jsonl')
    container.metadata.create_export_job(
        {
            'export_id': STREAM_EXPORT_ID,
            'dataset_id': STREAM_DATASET_ID,
            'format': 'jsonl',
            'status': 'ready',
            'output_path': str(export_path),
        }
    )

    current_records = sorted(latest_records.values(), key=lambda record: (record.timestamp, record.id))
    summary = {
        'workspace_id': STREAM_WORKSPACE_ID,
        'dataset_id': STREAM_DATASET_ID,
        'dataset_name': STREAM_DATASET_NAME,
        'profile': container.profile.name,
        'event_log_path': str(event_log_path),
        'normalized_log_path': str(DEFAULT_NORMALIZED_LOG_PATH),
        'query_db_path': str(DEFAULT_QUERY_DB_PATH),
        'sample_dataset_path': str(DEFAULT_QUERY_DATASET_PATH),
        'search_index_path': str(DEFAULT_SEARCH_INDEX_PATH),
        'release_table_root': str(DEFAULT_RELEASE_ROOT),
        'export_path': str(export_path),
        'event_count': len(events),
        'duplicate_events_skipped': total_duplicates,
        'batch_count': len(batch_summaries),
        'latest_sample_count': len(current_records),
        'distribution': query.query_distribution(),
        'tag_distribution': _build_distribution_by_tag(current_records),
        'search_preview': search.search_by_filters({}, top_k=5),
        'batch_summaries': batch_summaries,
    }

    DEFAULT_SUMMARY_PATH.parent.mkdir(parents=True, exist_ok=True)
    with container.storage.open(str(DEFAULT_SUMMARY_PATH), 'w') as handle:
        json.dump(summary, handle, ensure_ascii=True, indent=2)

    return summary