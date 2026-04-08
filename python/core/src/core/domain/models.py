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


class RuntimeProfile(BaseModel):
    name: Literal["local-dev", "team-dev", "enterprise-saas"]
    storage: dict[str, Any]
    query: dict[str, Any]
    compute: dict[str, Any]
    metadata: dict[str, Any]
    search: dict[str, Any]
    auth: dict[str, Any]
    capabilities: ProfileCapabilities
