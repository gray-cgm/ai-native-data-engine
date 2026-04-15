import csv
import json
import shutil
from pathlib import Path
from typing import Any

import lance
import pyarrow as pa


class LanceTableAdapter:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def _table_path(self, name: str) -> Path:
        return self.root / f'{name}.lance'

    def create_table(self, name: str, schema: dict, partition_spec: dict | None = None) -> None:
        self.root.mkdir(parents=True, exist_ok=True)

    def _reset_path(self, path: Path) -> None:
        if path.is_dir():
            shutil.rmtree(path)
        elif path.exists():
            path.unlink()

    def _write_rows(self, path: Path, rows: list[dict[str, Any]], *, mode: str) -> None:
        if mode in {'create', 'overwrite'} and path.exists():
            self._reset_path(path)
        table = pa.Table.from_pylist(rows)
        lance.write_dataset(table, path, mode=mode)

    def _load_table(self, name: str) -> pa.Table:
        path = self._table_path(name)
        if not path.exists():
            return pa.Table.from_pylist([])
        return lance.dataset(path).to_table()

    def _filter_rows(self, rows: list[dict[str, Any]], filters: dict[str, Any] | None) -> list[dict[str, Any]]:
        if not filters:
            return rows
        return [row for row in rows if all(row.get(key) == value for key, value in filters.items())]

    def append(self, name: str, records: list[dict[str, Any]]) -> None:
        self._write_rows(self._table_path(name), records, mode='append')

    def overwrite(self, name: str, records: list[dict[str, Any]]) -> None:
        self._write_rows(self._table_path(name), records, mode='create')

    def read(self, name: str, filters: dict | None = None) -> list[dict[str, Any]]:
        rows = self._load_table(name).to_pylist()
        return self._filter_rows(rows, filters)

    def export(
        self,
        source_name: str,
        output_path: Path,
        filters: dict[str, Any] | None = None,
        format: str = 'lance',
    ) -> Path:
        rows = self.read(source_name, filters=filters)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        if format == 'csv':
            with output_path.open('w', newline='') as handle:
                writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()) if rows else [])
                if rows:
                    writer.writeheader()
                    writer.writerows(rows)
            return output_path
        if format == 'jsonl':
            with output_path.open('w') as handle:
                for row in rows:
                    handle.write(json.dumps(row) + '\n')
            return output_path
        if output_path.exists():
            self._reset_path(output_path)
        table = pa.Table.from_pylist(rows)
        lance.write_dataset(table, output_path, mode='create')
        return output_path

    def snapshot(self, name: str) -> str:
        return f'lance://{name}'