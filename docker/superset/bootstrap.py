import os
from pathlib import Path

from superset import db
from superset.models.core import Database


def upsert_database(database_name: str, sqlalchemy_uri: str) -> None:
    existing = db.session.query(Database).filter_by(database_name=database_name).one_or_none()
    if existing is None:
        db.session.add(Database(database_name=database_name, sqlalchemy_uri=sqlalchemy_uri))
    else:
        existing.sqlalchemy_uri = sqlalchemy_uri
    db.session.commit()


workspace_root = Path(os.getenv('SUPERSET_PROJECT_ROOT', '/workspace'))
duckdb_path = Path(os.getenv('SUPERSET_DUCKDB_PATH', workspace_root / 'data/duckdb/app.duckdb'))
postgres_host = os.getenv('SUPERSET_INTERNAL_DB_HOST', 'postgres')
postgres_port = os.getenv('SUPERSET_INTERNAL_DB_PORT', '5432')
postgres_db = os.getenv('SUPERSET_INTERNAL_DB_NAME', 'ad_closure')
postgres_user = os.getenv('SUPERSET_INTERNAL_DB_USER', 'postgres')
postgres_password = os.getenv('SUPERSET_INTERNAL_DB_PASSWORD', 'postgres')
postgres_uri = (
    f'postgresql+psycopg2://{postgres_user}:{postgres_password}@{postgres_host}:{postgres_port}/{postgres_db}'
)

upsert_database('metadata-postgres', postgres_uri)

if duckdb_path.exists():
    upsert_database('local-duckdb', f'duckdb:///{duckdb_path}')
