from pathlib import Path

from dagster import Definitions, asset

from profiles import build_container
from services import get_scenario_triage_summary, run_scenario_triage

# 数据湖仓流水线资产（collect → clip-extract → feature-compute → release）
from src.assets.data_pipeline import (
    feature_extraction_with_quality_check,
    multimodal_clip_extraction,
    raw_collection_ingest,
    structured_dataset_release,
)


@asset
def night_intersection_vru_triage_asset() -> dict:
    container = build_container(Path('infra/profiles/local-dev.yaml'))
    return run_scenario_triage(container)


@asset(deps=[night_intersection_vru_triage_asset])
def night_intersection_vru_summary_asset() -> dict:
    container = build_container(Path('infra/profiles/local-dev.yaml'))
    return {'scenario': get_scenario_triage_summary(container), 'profile': container.profile.name}


defs = Definitions(
    assets=[
        # 现有资产
        night_intersection_vru_triage_asset,
        night_intersection_vru_summary_asset,
        # 数据湖仓流水线（ingest → curate → publish）
        raw_collection_ingest,
        multimodal_clip_extraction,
        feature_extraction_with_quality_check,
        structured_dataset_release,
    ]
)
