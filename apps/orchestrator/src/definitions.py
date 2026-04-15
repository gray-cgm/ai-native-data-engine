from pathlib import Path

from dagster import Definitions, asset

from profiles import build_container
from services import get_scenario_triage_summary, run_scenario_triage


@asset
def night_intersection_vru_triage_asset() -> dict:
    container = build_container(Path('infra/profiles/local-dev.yaml'))
    return run_scenario_triage(container)


@asset(deps=[night_intersection_vru_triage_asset])
def night_intersection_vru_summary_asset() -> dict:
    container = build_container(Path('infra/profiles/local-dev.yaml'))
    return {'scenario': get_scenario_triage_summary(container), 'profile': container.profile.name}


defs = Definitions(assets=[night_intersection_vru_triage_asset, night_intersection_vru_summary_asset])
