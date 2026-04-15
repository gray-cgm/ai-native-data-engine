import shutil
from pathlib import Path
from typing import Any

import lance
import pyarrow as pa

from core.domain.models import SampleRecord


class LanceVectorAdapter:
    def __init__(self, uri: Path) -> None:
        self.uri = uri

    def _reset_uri(self) -> None:
        if self.uri.is_dir():
            shutil.rmtree(self.uri)
        elif self.uri.exists():
            self.uri.unlink()

    def _write_table(self, table: pa.Table, *, mode: str) -> None:
        self.uri.parent.mkdir(parents=True, exist_ok=True)
        if mode == 'create' and self.uri.exists():
            self._reset_uri()
        lance.write_dataset(table, self.uri, mode=mode)

    def _dataset(self):
        if not self.uri.exists():
            return None
        return lance.dataset(self.uri)

    def _read_rows(self) -> list[dict[str, Any]]:
        dataset = self._dataset()
        if dataset is None:
            return []
        return dataset.to_table().to_pylist()

    def build_index(self, records: list[SampleRecord]) -> None:
        table = pa.table(
            {
                'id': [r.id for r in records],
                'scene': [r.scene for r in records],
                'vector': pa.array(
                    [[float(len(r.scene)), float(len(r.tags)), 1.0] for r in records],
                    type=pa.list_(pa.float32(), 3),
                ),
            }
        )
        self._write_table(table, mode='create')

    def index_samples(self, dataset_version_id: str, records: list[dict[str, Any]]) -> None:
        table = pa.table(
            {
                'dataset_version_id': [dataset_version_id for _ in records],
                'id': [str(record['id']) for record in records],
                'scene': [str(record.get('scene', 'unknown')) for record in records],
                'vector': pa.array(
                    [record.get('vector', [0.0, 0.0, 0.0]) for record in records],
                    type=pa.list_(pa.float32(), 3),
                ),
            }
        )
        self._write_table(table, mode='create')

    def search_similar(self, vector: list[float], top_k: int = 10) -> list[dict[str, Any]]:
        dataset = self._dataset()
        if dataset is None:
            return []
        table = dataset.to_table(
            nearest={
                'column': 'vector',
                'q': vector,
                'k': top_k,
                'use_index': False,
            }
        )
        return table.to_pylist()

    def search_by_filters(self, filters: dict[str, Any], top_k: int = 100) -> list[dict[str, Any]]:
        dataset = self._dataset()
        if dataset is None:
            return []
        if not filters:
            return dataset.to_table(limit=top_k).to_pylist()

        clauses = []
        for key, value in filters.items():
            if isinstance(value, str):
                escaped = value.replace("'", "''")
                clauses.append(f"{key} = '{escaped}'")
            elif isinstance(value, bool):
                clauses.append(f"{key} = {'true' if value else 'false'}")
            elif value is None:
                clauses.append(f'{key} IS NULL')
            else:
                clauses.append(f'{key} = {value}')

        return dataset.to_table(filter=' AND '.join(clauses), limit=top_k).to_pylist()
