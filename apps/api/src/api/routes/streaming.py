from fastapi import APIRouter

from services import get_local_streaming_summary, run_local_streaming
from src.core.runtime import get_runtime_container

router = APIRouter(prefix='/streaming', tags=['streaming'])


@router.post('/bootstrap')
def bootstrap_streaming_demo() -> dict:
    container = get_runtime_container()
    return run_local_streaming(container)


@router.get('/summary')
def get_streaming_summary() -> dict:
    container = get_runtime_container()
    summary = get_local_streaming_summary(container)
    if summary is None:
        summary = run_local_streaming(container)['summary']
    return {'summary': summary}