"""``make ingest`` — register every clip under ``data/lance/`` into the
catalog.

For each clip directory we:
1. Read ``meta.lance`` + ``topic.lance`` via ``adapters.clip_reader``.
2. Upsert a workspace / dataset / dataset_version into the metadata adapter,
   using the clip id as dataset id.
3. Append a lineage event describing what we ingested.
"""

from __future__ import annotations

import json
from pathlib import Path
from pprint import pprint

from adapters import clip_reader
from core.domain.models import LineageEvent
from profiles import build_container


DEFAULT_LANCE_ROOT = Path('data/lance')


def ingest_clips(lance_root: Path = DEFAULT_LANCE_ROOT) -> dict:
    container = build_container(Path('infra/profiles/local-dev.yaml'))
    workspace_id = container.profile.scenario.workspace_id
    container.metadata.create_workspace(
        {'workspace_id': workspace_id, 'name': 'Local AD Workspace'}
    )

    clips = clip_reader.list_clips(lance_root)
    registered: list[dict] = []
    for clip in clips:
        dataset_id = clip.clip_id
        meta = clip_reader.load_meta(clip.path)
        version_id = f'v{meta.get("calibration_version") or 1}'
        dataset = container.metadata.create_dataset(
            {
                'dataset_id': dataset_id,
                'name': f'{clip.vehicle_name or "clip"}@{clip.city or "unknown"}',
                'workspace_id': workspace_id,
                'profile': container.profile.name,
            }
        )
        version = container.metadata.create_dataset_version(
            {
                'dataset_id': dataset_id,
                'version_id': version_id,
                'sample_count': clip.keyframe_count,
                'table_name': 'topic.lance',
            }
        )
        container.metadata.append_lineage_event(
            LineageEvent(
                event_type='clip_ingested',
                subject_id=f'{dataset_id}:{version_id}',
                payload={
                    'clip_id': dataset_id,
                    'scenario': clip.scenario,
                    'keyframe_count': clip.keyframe_count,
                    'vehicle_name': clip.vehicle_name,
                    'city': clip.city,
                    'district': clip.district,
                    'tags': clip.tags,
                    'da_tags': clip.da_tags,
                    'topic_count': len(clip.schema.topics),
                    'camera_count': len(clip.schema.cameras),
                    'standalone_topic_count': len(clip.schema.standalone_topics),
                },
            )
        )
        registered.append(
            {
                'clip_id': dataset_id,
                'dataset': dataset,
                'dataset_version': version,
                'keyframe_count': clip.keyframe_count,
                'vehicle_name': clip.vehicle_name,
                'scenario': clip.scenario,
            }
        )

    summary = {
        'lance_root': str(lance_root.resolve()),
        'workspace': workspace_id,
        'clip_count': len(registered),
        'clips': registered,
    }
    out_path = Path('data/exports/clip-ingest-summary.json')
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(summary, indent=2, default=str), encoding='utf-8')
    return summary


if __name__ == '__main__':
    pprint(ingest_clips())
