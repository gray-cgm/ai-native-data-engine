from pathlib import Path

import yaml

from adapters.auth.local.adapter import LocalAuthAdapter
from adapters.auth.oidc.adapter import OIDCAuthAdapter
from adapters.compute.dagster_local.adapter import DagsterLocalComputeAdapter
from adapters.compute.local_python.adapter import LocalPythonComputeAdapter
from adapters.metadata.postgres.adapter import PostgresMetadataAdapter
from adapters.metadata.sqlite.adapter import SQLiteMetadataAdapter
from adapters.table.lance.adapter import LanceTableAdapter
from adapters.query.duckdb.adapter import DuckDBQueryAdapter
from adapters.query.starrocks.adapter import StarRocksQueryAdapter
from adapters.storage.local_fs.adapter import LocalFileStorageAdapter
from adapters.storage.opendal.adapter import OpenDALStorageAdapter
from adapters.storage.s3.adapter import S3StorageAdapter
from adapters.vector.lance.adapter import LanceVectorAdapter
from core.domain.models import ProfileCapabilities, RuntimeProfile
from core.profiles.runtime import RuntimeContainer


def load_profile(profile_path: Path) -> RuntimeProfile:
    payload = yaml.safe_load(profile_path.read_text())
    payload['capabilities'] = ProfileCapabilities(**payload['capabilities'])
    return RuntimeProfile(**payload)


def build_container(profile_path: Path) -> RuntimeContainer:
    profile = load_profile(profile_path)

    storage_provider = profile.storage['provider']
    if storage_provider == 'local_fs':
        storage = LocalFileStorageAdapter()
    elif storage_provider == 'opendal':
        reserved = {'provider', 'scheme', 'root', 'base'}
        options = {k: v for k, v in profile.storage.items() if k not in reserved}
        storage = OpenDALStorageAdapter(
            profile.storage['scheme'],
            root=profile.storage.get('root', '.'),
            base=profile.storage.get('base'),
            **options,
        )
    else:
        storage = S3StorageAdapter(
            bucket=profile.storage.get('bucket', ''),
            region=profile.storage.get('region'),
        )

    if profile.query['provider'] == 'duckdb':
        query = DuckDBQueryAdapter(
            db_path=Path(profile.query['database']),
            data_path=Path('./data/silver/samples.lance'),
        )
    else:
        query = StarRocksQueryAdapter(
            jdbc_url=profile.query['jdbc_url'],
            database=profile.query['database'],
        )

    compute_provider = profile.compute['provider']
    if compute_provider == 'local_python':
        compute = LocalPythonComputeAdapter()
    else:
        compute = DagsterLocalComputeAdapter()

    metadata_provider = profile.metadata['provider']
    if metadata_provider == 'sqlite':
        metadata = SQLiteMetadataAdapter(Path(profile.metadata['database']))
    else:
        metadata = PostgresMetadataAdapter()
    search = LanceVectorAdapter(Path(profile.search['uri']))
    table = LanceTableAdapter(Path('./data/gold'))

    if profile.auth['provider'] == 'local':
        auth = LocalAuthAdapter()
    else:
        auth = OIDCAuthAdapter()

    return RuntimeContainer(
        profile=profile,
        capabilities=profile.capabilities,
        storage=storage,
        query=query,
        compute=compute,
        metadata=metadata,
        search=search,
        auth=auth,
        table=table,
    )
