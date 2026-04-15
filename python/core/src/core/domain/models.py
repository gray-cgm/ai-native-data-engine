from typing import Any, Literal

from pydantic import BaseModel, Field


class SampleRecord(BaseModel):
    id: str
    image_path: str
    metadata_path: str
    scene: str
    timestamp: str
    tags: list[str]


class DatasetSummary(BaseModel):
    dataset_id: str
    name: str
    sample_count: int
    profile: str = "personal"


class ScenarioTriageConfig(BaseModel):
    workspace_id: str = 'local-workspace'
    dataset_id: str = 'demo-dataset'
    dataset_name: str = 'Night Intersection VRU Hard Cases'
    dataset_version_id: str = 'v1'
    table_name: str = 'dataset_samples'
    examples_dir: str = 'examples/datasets/custom-local'
    scenario_id: str = 'night-intersection-vru-triage'
    scenario_name: str = 'Night Intersection VRU Hard-Case Triage'
    scenario_goal: str = 'Surface night-time and junction samples that are likely to require braking, yielding, or relabel review.'
    focus_scenes: list[str] = Field(default_factory=lambda: ['urban-night', 'intersection'])
    focus_tags: list[str] = Field(default_factory=lambda: ['night', 'pedestrian', 'crosswalk', 'junction', 'traffic-light', 'occlusion'])
    summary_output_uri: str = './data/exports/night-intersection-vru-summary.json'
    export_output_uri: str = './data/exports/demo-dataset-v1.lance'
    export_format: Literal['lance', 'csv', 'jsonl'] = 'lance'
    export_id: str = 'export-demo-v1'
    review_task_id: str = 'task-night-intersection-vru-review'
    review_task_title: str = 'Review night intersection vulnerable road user hard cases'
    operator_username: str = 'demo-operator'
    operator_password: str = 'local-demo'
    orchestrator_job_name: str = 'night_intersection_vru_triage_job'
    orchestrator_asset_key: str = 'night_intersection_vru_triage_asset'


class ScenarioTriageSummary(BaseModel):
    workspace_id: str
    dataset_id: str
    dataset_version_id: str
    table_name: str
    profile_name: str
    scenario_id: str
    scenario_name: str
    scenario_goal: str
    focus_scenes: list[str] = Field(default_factory=list)
    focus_tags: list[str] = Field(default_factory=list)
    record_count: int
    scenario_sample_count: int
    dominant_scene: str
    candidate_sample_ids: list[str] = Field(default_factory=list)
    priority_sample_ids: list[str] = Field(default_factory=list)
    distribution: list[dict[str, Any]] = Field(default_factory=list)
    search_preview: list[dict[str, Any]] = Field(default_factory=list)
    summary_output_uri: str
    export_id: str
    export_format: str
    export_output_path: str
    run_id: str
    run_status: str
    orchestrator_job_name: str
    orchestrator_asset_key: str
    operator: dict[str, Any] = Field(default_factory=dict)


class ComputeRun(BaseModel):
    run_id: str
    status: Literal["queued", "running", "success", "failed", "canceled"]
    metadata: dict[str, Any] = Field(default_factory=dict)


class AuthenticatedUser(BaseModel):
    user_id: str
    email: str
    display_name: str
    roles: list[str] = Field(default_factory=list)


class LineageEvent(BaseModel):
    event_type: str
    subject_id: str
    payload: dict[str, Any] = Field(default_factory=dict)


class ProfileCapabilities(BaseModel):
    multi_tenant: bool = False
    sso: bool = False
    distributed_compute: bool = False
    advanced_governance: bool = False
    object_storage: bool = False


class FileFormatProfile(BaseModel):
    current_primary: Literal['parquet', 'lance'] = 'lance'
    target_primary: Literal['parquet', 'lance'] = 'lance'
    retrieval_format: Literal['parquet', 'lance'] = 'lance'
    export_default: Literal['lance', 'csv', 'jsonl'] = 'lance'


class RuntimeProfile(BaseModel):
    name: Literal["local-dev", "team-dev", "enterprise-saas"]
    storage: dict[str, Any]
    file_formats: FileFormatProfile = Field(default_factory=FileFormatProfile)
    query: dict[str, Any]
    compute: dict[str, Any]
    metadata: dict[str, Any]
    search: dict[str, Any]
    auth: dict[str, Any]
    capabilities: ProfileCapabilities
    scenario: ScenarioTriageConfig = Field(default_factory=ScenarioTriageConfig)
