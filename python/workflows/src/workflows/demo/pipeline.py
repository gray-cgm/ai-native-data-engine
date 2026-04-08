from pathlib import Path

from adapters.query.duckdb.adapter import DuckDBQueryAdapter
from adapters.vector.lance.adapter import LanceVectorAdapter
from workflows.ingestion.demo import ingest_local_dataset


def run_local_demo(base_dir: Path, examples_dir: Path) -> dict:
    records = ingest_local_dataset(examples_dir / 'images', examples_dir / 'metadata')

    duckdb_adapter = DuckDBQueryAdapter(
        db_path=base_dir / 'duckdb' / 'samples.duckdb',
        parquet_path=base_dir / 'silver' / 'samples.parquet',
    )
    duckdb_adapter.create_sample_table(records)

    lance_adapter = LanceVectorAdapter(base_dir / 'lance' / 'samples.lance')
    lance_adapter.build_index(records)

    distribution = duckdb_adapter.query_distribution()
    return {
        'record_count': len(records),
        'distribution': distribution,
    }
