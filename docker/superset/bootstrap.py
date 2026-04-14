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


def delete_database(database_name: str) -> None:
    existing = db.session.query(Database).filter_by(database_name=database_name).one_or_none()
    if existing is not None:
        db.session.delete(existing)
        db.session.commit()


workspace_root = Path(os.getenv('SUPERSET_PROJECT_ROOT', '/workspace'))
duckdb_path = Path(os.getenv('SUPERSET_DUCKDB_PATH', workspace_root / 'data/duckdb/app.duckdb'))

# delete_database('metadata-postgres')
# delete_database('platform-postgres')

if duckdb_path.exists():
    upsert_database('local-duckdb', f'duckdb:///{duckdb_path}')
