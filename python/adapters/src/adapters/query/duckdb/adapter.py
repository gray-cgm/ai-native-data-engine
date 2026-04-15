from pathlib import Path
from typing import Any

import duckdb
import lance
import pyarrow as pa

from core.domain.models import SampleRecord


class DuckDBQueryAdapter:
    def __init__(self, db_path: Path, data_path: Path) -> None:
        self.db_path = db_path
        self.data_path = data_path

    def query(self, sql: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        con = duckdb.connect(str(self.db_path))
        cursor = con.execute(sql, list((params or {}).values()))
        columns = [item[0] for item in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
        con.close()
        return rows

    def create_view(self, name: str, sql: str) -> None:
        con = duckdb.connect(str(self.db_path))
        con.execute(f'create or replace view {name} as {sql}')
        con.close()

    def _load_arrow_table(self, source: str) -> pa.Table:
        return lance.dataset(source).to_table()

    def register_table(self, name: str, source: str) -> None:
        con = duckdb.connect(str(self.db_path))
        arrow_table = self._load_arrow_table(source)
        con.register('__lance_source__', arrow_table)
        con.execute(f'create or replace table {name} as select * from __lance_source__')
        con.close()

    def materialize_table(self, name: str, sql: str) -> None:
        con = duckdb.connect(str(self.db_path))
        con.execute(f'create or replace table {name} as {sql}')
        con.close()

    def create_sample_table(self, records: list[SampleRecord]) -> None:
        self.data_path.parent.mkdir(parents=True, exist_ok=True)
        table = pa.table(
            {
                'id': [r.id for r in records],
                'image_path': [r.image_path for r in records],
                'metadata_path': [r.metadata_path for r in records],
                'scene': [r.scene for r in records],
                'timestamp': [r.timestamp for r in records],
                'tags': [','.join(r.tags) for r in records],
            }
        )
        if self.data_path.exists() and not self.data_path.is_dir():
            self.data_path.unlink()
        lance.write_dataset(table, self.data_path, mode='create')
        self.register_table('samples', str(self.data_path))

    def query_distribution(self) -> list[dict[str, Any]]:
        return self.query(
            'select scene, count(*) as sample_count from samples group by scene order by sample_count desc'
        )
