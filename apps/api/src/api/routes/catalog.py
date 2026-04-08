from fastapi import APIRouter

from src.core.runtime import get_runtime_container

router = APIRouter(tags=['catalog'])


@router.get('/workspaces')
def list_workspaces() -> dict:
    container = get_runtime_container()
    return {'items': container.metadata.list_workspaces()}


@router.get('/datasets')
def list_datasets() -> dict:
    container = get_runtime_container()
    return {'items': container.metadata.list_datasets()}


@router.get('/datasets/{dataset_id}')
def get_dataset(dataset_id: str) -> dict:
    container = get_runtime_container()
    dataset = container.metadata.get_dataset(dataset_id)
    versions = container.metadata.list_dataset_versions(dataset_id)
    return {'item': dataset, 'versions': versions}


@router.get('/datasets/{dataset_id}/versions')
def list_dataset_versions(dataset_id: str) -> dict:
    container = get_runtime_container()
    return {'items': container.metadata.list_dataset_versions(dataset_id)}
