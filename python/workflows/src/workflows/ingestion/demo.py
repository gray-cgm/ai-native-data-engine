import json
from pathlib import Path

from core.domain.models import SampleRecord


def ingest_local_dataset(images_dir: Path, metadata_dir: Path) -> list[SampleRecord]:
    records: list[SampleRecord] = []
    for image_path in sorted(images_dir.glob('*')):
        if image_path.suffix.lower() not in {'.jpg', '.jpeg', '.png'}:
            continue
        metadata_path = metadata_dir / f'{image_path.stem}.json'
        payload = {
            'scene': 'unknown',
            'timestamp': '1970-01-01T00:00:00Z',
            'tags': []
        }
        if metadata_path.exists():
            payload = {**payload, **json.loads(metadata_path.read_text())}
        records.append(
            SampleRecord(
                id=image_path.stem,
                image_path=str(image_path),
                metadata_path=str(metadata_path),
                scene=payload['scene'],
                timestamp=payload['timestamp'],
                tags=payload.get('tags', []),
            )
        )
    return records
