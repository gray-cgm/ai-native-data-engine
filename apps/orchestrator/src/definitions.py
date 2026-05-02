"""Dagster code location 入口。

这里只做 Dagster binding：
- 把 ``python/workflows`` 暴露的流程函数 ``@asset`` 包装成 Dagster 资产；
- 通过 ``RuntimeContainerResource`` 注入容器，asset body 不再 ``build_container``。

业务流程本身仍在 ``python/workflows``，离开 Dagster 仍然能跑（FastAPI / CLI 复用同一组函数）。
"""

from __future__ import annotations

from dagster import Definitions, asset

from workflows.demo import get_scenario_triage_summary, run_scenario_triage_demo

from src.assets.data_pipeline import (
    feature_extraction_with_quality_check,
    multimodal_clip_extraction,
    raw_collection_ingest,
    structured_dataset_release,
)
from src.resources import RuntimeContainerResource


@asset(required_resource_keys={'container'})
def night_intersection_vru_triage_asset(context) -> dict:
    container = context.resources.container.get()
    return run_scenario_triage_demo(container)


@asset(deps=[night_intersection_vru_triage_asset], required_resource_keys={'container'})
def night_intersection_vru_summary_asset(context) -> dict:
    container = context.resources.container.get()
    return {
        'scenario': get_scenario_triage_summary(container),
        'profile': container.profile.name,
    }


defs = Definitions(
    assets=[
        # scenario triage demo
        night_intersection_vru_triage_asset,
        night_intersection_vru_summary_asset,
        # 数据湖仓流水线（collect → clip-extract → feature-compute → release）
        raw_collection_ingest,
        multimodal_clip_extraction,
        feature_extraction_with_quality_check,
        structured_dataset_release,
    ],
    resources={
        'container': RuntimeContainerResource(),
    },
)
