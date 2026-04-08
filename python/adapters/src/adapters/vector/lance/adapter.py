from pathlib import Path
from typing import Any

import lance
import pyarrow as pa

from core.domain.models import SampleRecord


class LanceVectorAdapter:
    def __init__(self, uri: Path) -> None:
        self.uri = uri

    def build_index(self, records: list[SampleRecord]) -> None:
        self.uri.parent.mkdir(parents=True, exist_ok=True)
        table = pa.table(
            {
                'id': [r.id for r in records],
                'scene': [r.scene for r in records],
                'vector': [[float(len(r.scene)), float(len(r.tags)), 1.0] for r in records],
            }
        )
        lance.write_dataset(table, str(self.uri), mode='overwrite')

    def index_samples(self, dataset_version_id: str, records: list[dict[str, Any]]) -> None:
        self.uri.parent.mkdir(parents=True, exist_ok=True)
        table = pa.table(
            {
                'dataset_version_id': [dataset_version_id for _ in records],
                'id': [str(record['id']) for record in records],
                'scene': [str(record.get('scene', 'unknown')) for record in records],
                'vector': [record.get('vector', [0.0, 0.0, 0.0]) for record in records],
            }
        )
        lance.write_dataset(table, str(self.uri), mode='overwrite')

    def search_similar(self, vector: list[float], top_k: int = 10) -> list[dict[str, Any]]:
        dataset = lance.dataset(str(self.uri))
        table = dataset.to_table()
        rows = table.to_pylist()
        return rows[:top_k]

    def search_by_filters(self, filters: dict[str, Any], top_k: int = 100) -> list[dict[str, Any]]:
        dataset = lance.dataset(str(self.uri))
        rows = dataset.to_table().to_pylist()
        result = []
        for row in rows:
            if all(row.get(key) == value for key, value in filters.items()):
                result.append(row)
            if len(result) >= top_k:
                break
        return result
