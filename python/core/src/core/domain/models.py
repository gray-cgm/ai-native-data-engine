"""Core domain models for the AI data-loop engine.

The primary unit of data is a **Clip** — a directory ``data/lance/c-<uuid>/``
containing a ``meta.lance`` row, a ``topic.lance`` keyframe table and zero or
more sibling ``<TopicName>.lance`` tables. Clip-centric types live here
together with scenario/dataset aggregates and the query-layer index model
consumed by ``adapters.catalog.sqlite_clip_index``.

The legacy :class:`SampleRecord` is retained only for the bundled demo
triage fixture (``examples/datasets/custom-local``) which pre-dates the
clip-centric ingestion path.
"""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


# ── Clip domain: on-disk / wire shapes ───────────────────────────────────────

class ClipTopicRef(BaseModel):
    """A topic struct column discovered inside ``topic.lance``."""

    name: str
    non_null_count: int = 0


class ClipCameraRef(BaseModel):
    """A camera struct column discovered inside ``topic.lance``."""

    name: str
    frame_count: int = 0


class ClipStandaloneTopicRef(BaseModel):
    """A sibling ``<TopicName>.lance`` directory next to ``topic.lance``."""

    name: str
    row_count: int = 0


class ClipSummary(BaseModel):
    """List + point-query shape emitted by ``/clips`` and ``/clips/{id}``.

    Wire format preserves the CSV encoding of ``tags``/``da_tags`` that the
    Web/BFF already consume.
    """

    clip_id: str
    keyframe_count: int = 0
    start_time: int | None = None
    end_time: int | None = None
    duration_seconds: float | None = None
    vehicle_name: str | None = None
    city: str | None = None
    district: str | None = None
    scenario: str | None = None
    tags: str | None = None
    da_tags: str | None = None
    topics: list[ClipTopicRef] = Field(default_factory=list)
    cameras: list[ClipCameraRef] = Field(default_factory=list)
    standalone_topics: list[ClipStandaloneTopicRef] = Field(default_factory=list)
    has_wm: bool = False


class ClipMeta(BaseModel):
    """Materialised ``meta.lance`` row; extra fields are preserved for forward
    compatibility with schema evolution."""

    model_config = ConfigDict(extra='allow')

    vehicle_name: str | None = None
    vehicle_model: str | None = None
    vehicle_info: dict[str, Any] = Field(default_factory=dict)
    city: str | None = None
    district: str | None = None
    scenario: str | None = None
    tags: str | None = None
    da_tags: str | None = None
    jira_id: str | None = None
    start_time: int | None = None
    end_time: int | None = None
    calibration_version: str | int | None = None
    calibration_info: dict[str, Any] = Field(default_factory=dict)
    mp4_path: dict[str, str] = Field(default_factory=dict)
    mp4_resize_path: dict[str, list[str]] = Field(default_factory=dict)


class ClipRecord(BaseModel):
    """Aggregate descriptor combining summary metrics + meta row."""

    summary: ClipSummary
    meta: ClipMeta = Field(default_factory=ClipMeta)


# ── Scenario / Dataset aggregates ────────────────────────────────────────────

class ScenarioSummary(BaseModel):
    """Aggregate rolled up per ``meta.scenario`` value.

    ``scenario_id`` is stable (``scenario:<slug>``). Clips with no scenario
    fall into ``scenario:unassigned``.
    """

    scenario_id: str
    scenario_name: str
    clip_count: int = 0
    keyframe_count: int = 0
    duration_seconds: float = 0.0
    tag_histogram: dict[str, int] = Field(default_factory=dict)
    vehicle_histogram: dict[str, int] = Field(default_factory=dict)
    city_histogram: dict[str, int] = Field(default_factory=dict)
    first_start_time: int | None = None
    last_end_time: int | None = None


class DatasetSummary(BaseModel):
    """A scenario-grouped virtual dataset surfaced by Catalog.

    Scenario is currently the single grouping key; when a registered dataset
    store arrives, ``dataset_id`` may adopt an additional namespace prefix.
    """

    dataset_id: str
    name: str
    scenario: str | None = None
    clip_count: int = 0
    keyframe_count: int = 0
    duration_seconds: float = 0.0
    profile: str = 'personal'
    tag_histogram: dict[str, int] = Field(default_factory=dict)


# ── Query layer: index entry + request/response contracts ───────────────────

class ClipIndexEntry(BaseModel):
    """Denormalised row stored by the clip catalog index.

    Mirrors the subset of columns used for filtering and ordering. The full
    :class:`ClipSummary` / :class:`ClipMeta` payloads are kept alongside as
    JSON blobs so point queries never have to re-open Lance files.
    """

    clip_id: str
    scenario: str | None = None
    vehicle_name: str | None = None
    vehicle_model: str | None = None
    city: str | None = None
    district: str | None = None
    start_time: int | None = None
    end_time: int | None = None
    duration_seconds: float | None = None
    keyframe_count: int = 0
    topic_count: int = 0
    camera_count: int = 0
    standalone_topic_count: int = 0
    has_wm: bool = False
    tags: list[str] = Field(default_factory=list)
    da_tags: list[str] = Field(default_factory=list)
    source_mtime_ns: int = 0


ClipSort = Literal['start_time_desc', 'start_time_asc', 'clip_id_asc', 'duration_desc']


class ClipCatalogQuery(BaseModel):
    """Filter + pagination request understood by ``ClipCatalogIndex``.

    Every field is optional; an empty query lists all clips sorted by
    ``start_time`` descending.
    """

    scenario: str | None = None
    vehicle_name: str | None = None
    city: str | None = None
    district: str | None = None
    tags: list[str] = Field(default_factory=list)     # AND-semantics
    da_tags: list[str] = Field(default_factory=list)  # AND-semantics
    has_wm: bool | None = None
    start_after: int | None = None
    start_before: int | None = None
    keyword: str | None = None
    clip_ids: list[str] = Field(default_factory=list)  # batch point-query
    sort: ClipSort = 'start_time_desc'
    limit: int = 50
    offset: int = 0


class ClipCatalogPage(BaseModel):
    """Paginated ``query`` response."""

    items: list[ClipSummary]
    total: int
    limit: int
    offset: int


# ── Legacy sample-centric demo types (retained for compatibility) ────────────

class SampleRecord(BaseModel):
    """Legacy per-image sample used by the bundled demo triage pipeline.

    The primary domain unit is now :class:`ClipRecord`. ``SampleRecord`` is
    kept so the ``examples/datasets/custom-local`` fixture and the companion
    ``workflows.demo`` flow remain runnable without rewriting the demo data.
    """

    id: str
    image_path: str
    metadata_path: str
    scene: str
    timestamp: str
    tags: list[str]


class ScenarioTriageConfig(BaseModel):
    workspace_id: str = 'local-workspace'
    dataset_id: str = 'demo-dataset'
    dataset_name: str = 'Night Intersection VRU Hard Cases'
    dataset_version_id: str = 'v1'
    table_name: str = 'dataset_samples'
    examples_dir: str = 'examples/datasets/custom-local'
    scenario_id: str = 'night-intersection-vru-triage'
    scenario_name: str = 'Night Intersection VRU Hard-Case Triage'
    scenario_goal: str = 'Surface night-time and junction clips that are likely to require braking, yielding, or relabel review.'
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
    scenario_clip_count: int
    dominant_scene: str
    candidate_clip_ids: list[str] = Field(default_factory=list)
    priority_clip_ids: list[str] = Field(default_factory=list)
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
