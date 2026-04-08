import csv
import json
from pathlib import Path
from typing import Any

import pyarrow as pa
import pyarrow.parquet as pq


class ParquetTableAdapter:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def create_table(self, name: str, schema: dict, partition_spec: dict | None = None) -> None:
        self.root.mkdir(parents=True, exist_ok=True)

    def append(self, name: str, records: list[dict[str, Any]]) -> None:
        table = pa.Table.from_pylist(records)
        pq.write_table(table, self.root / f'{name}.parquet')

    def overwrite(self, name: str, records: list[dict[str, Any]]) -> None:
        self.append(name, records)

    def read(self, name: str, filters: dict | None = None) -> list[dict[str, Any]]:
        rows = pq.read_table(self.root / f'{name}.parquet').to_pylist()
        if not filters:
            return rows
        result = []
        for row in rows:
            if all(row.get(key) == value for key, value in filters.items()):
                result.append(row)
        return result

    def export(
        self,
        source_name: str,
        output_path: Path,
        filters: dict[str, Any] | None = None,
        format: str = 'parquet',
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
        table = pa.Table.from_pylist(rows)
        pq.write_table(table, output_path)
        return output_path

    def snapshot(self, name: str) -> str:
        return f'parquet://{name}'
