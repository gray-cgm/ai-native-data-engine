from fastapi import APIRouter

from services import get_scenario_triage_summary, run_scenario_triage
from src.core.runtime import get_runtime_container

router = APIRouter(prefix='/samples', tags=['samples'])


@router.post('/ingest-demo')
def ingest_demo() -> dict:
    container = get_runtime_container()
    return run_scenario_triage(container)


@router.get('/distribution')
def sample_distribution() -> dict:
    container = get_runtime_container()
    summary = get_scenario_triage_summary(container)
    if summary is None:
        summary = run_scenario_triage(container)['scenario']
    return {'distribution': summary.get('distribution', []), 'scenario': summary}


@router.get('/search-preview')
def search_preview() -> dict:
    container = get_runtime_container()
    summary = get_scenario_triage_summary(container)
    if summary is None:
        summary = run_scenario_triage(container)['scenario']
    return {'rows': summary.get('search_preview', []), 'scenario': summary}
