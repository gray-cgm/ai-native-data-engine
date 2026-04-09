from fastapi import APIRouter

from src.core.runtime import get_runtime_container

router = APIRouter(tags=['operations'])


@router.get('/tasks')
def list_tasks() -> dict:
    container = get_runtime_container()
    return {'items': container.metadata.list_tasks()}


@router.get('/runs')
def list_runs() -> dict:
    container = get_runtime_container()
    return {'items': container.metadata.list_job_runs()}


@router.get('/exports')
def list_exports() -> dict:
    container = get_runtime_container()
    return {'items': container.metadata.list_export_jobs()}
