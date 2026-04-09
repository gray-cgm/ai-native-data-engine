from pathlib import Path

from dagster import Definitions, asset

from profiles import build_container
from workflows.assets.pipeline import materialize_local_assets


@asset
def dataset_asset_manifest() -> dict:
    container = build_container(Path('infra/profiles/local-dev.yaml'))
    return materialize_local_assets(container, Path('examples/datasets/custom-local'))


@asset(deps=[dataset_asset_manifest])
def dataset_distribution_asset() -> dict:
    container = build_container(Path('infra/profiles/local-dev.yaml'))
    return {
        'distribution': container.query.query_distribution(),
        'profile': container.profile.name,
    }


defs = Definitions(assets=[dataset_asset_manifest, dataset_distribution_asset])
