from pathlib import Path

from fastapi import APIRouter

from src.core.runtime import get_runtime_container
from workflows.assets.pipeline import load_lance_rows, materialize_local_assets

router = APIRouter(prefix='/samples', tags=['samples'])


@router.post('/ingest-demo')
def ingest_demo() -> dict:
    container = get_runtime_container()
    return materialize_local_assets(container, Path('examples/datasets/custom-local'))


@router.get('/distribution')
def sample_distribution() -> dict:
    container = get_runtime_container()
    return materialize_local_assets(container, Path('examples/datasets/custom-local'))


@router.get('/search-preview')
def search_preview() -> dict:
    container = get_runtime_container()
    rows = load_lance_rows(container)
    return {'rows': rows}
