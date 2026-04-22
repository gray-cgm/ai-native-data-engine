export type DistributionRow = { scene: string; sample_count: number }
export type DatasetVersion = { version_id: string; dataset_id: string; sample_count: number; table_name: string }
export type DatasetItem = { dataset_id: string; name: string; workspace_id: string; profile: string }
export type TaskItem = {
  task_id: string
  title: string
  status: string
  task_type: string
  requirement_id?: string | null
  pipeline_run_id?: string | null
  assignee?: string | null
  created_at?: string | null
  updated_at?: string | null
}
export type WorkspaceItem = { workspace_id: string; name: string }
export type ExportItem = { export_id: string; dataset_id: string; format: string; status: string; output_path: string }
export type SearchRow = { id: string; scene: string; dataset_version_id?: string }
export type RunItem = {
  run_id: string
  job_name: string
  status: string
  requirement_id?: string | null
  operation_task_id?: string | null
  trigger_source?: string | null
  reason_code?: string | null
  duration_seconds?: number | null
  cpu_seconds?: number | null
  gpu_seconds?: number | null
  input_bytes?: number | null
  output_bytes?: number | null
  estimated_cost?: number | null
  derived_assets?: Array<Record<string, unknown>>
  created_at?: string | null
}
export type PaginationMeta = { total: number; skip: number; limit: number }
export type PaginatedList<T> = { items: T[]; pagination: PaginationMeta }
export type DatasetDetail = { item: DatasetItem | null; versions: DatasetVersion[] }

export type ScenarioTriageSummary = {
  workspace_id: string
  dataset_id: string
  dataset_version_id: string
  table_name: string
  profile_name: string
  scenario_id: string
  scenario_name: string
  scenario_goal: string
  focus_scenes: string[]
  focus_tags: string[]
  record_count: number
  scenario_clip_count: number
  dominant_scene: string
  candidate_clip_ids: string[]
  priority_clip_ids: string[]
  distribution: DistributionRow[]
  search_preview: SearchRow[]
  summary_output_uri: string
  export_id: string
  export_format: string
  export_output_path: string
  run_id: string
  run_status: string
  orchestrator_job_name: string
  orchestrator_asset_key: string
  operator: { user_id?: string; email?: string; display_name?: string; roles?: string[] }
}

export type StreamingBatchSummary = {
  batch_number: number
  input_events: number
  accepted_events: number
  unique_samples: number
  new_sample_ids: string[]
  distribution: DistributionRow[]
  run_id: string
  run_status: string
}

export type StreamingTagDistributionRow = {
  tag: string
  sample_count: number
}

export type StreamingSummary = {
  workspace_id: string
  dataset_id: string
  dataset_name: string
  profile: string
  event_log_path: string
  bronze_log_path: string
  query_db_path: string
  silver_dataset_path: string
  search_index_path: string
  gold_table_root: string
  export_path: string
  event_count: number
  duplicate_events_skipped: number
  batch_count: number
  latest_sample_count: number
  distribution: DistributionRow[]
  tag_distribution: StreamingTagDistributionRow[]
  search_preview: SearchRow[]
  batch_summaries: StreamingBatchSummary[]
}

export type DashboardPayload = {
  distribution: DistributionRow[]
  scenario: ScenarioTriageSummary | null
  streaming: StreamingSummary | null
  datasets: DatasetItem[]
  datasetVersions: Record<string, DatasetVersion[]>
  tasks: TaskItem[]
  workspaces: WorkspaceItem[]
  exports: ExportItem[]
  runs: RunItem[]
  searchRows: SearchRow[]
}

export type ToolRegistryItem = {
  id: string
  name: string
  short_name: string
  category: string
  summary: string
  description: string
  integration_mode: 'direct-iframe' | 'proxy-iframe'
  base_url: string
  gateway_path: string
  health_path: string
  workspace_path: string
  contract_version: string
  policy_profile: string
  owner: string
  capabilities: string[]
  use_cases: string[]
  notes: string[]
}

export type ToolRegistryPayload = {
  items: ToolRegistryItem[]
}

export type ToolWorkspaceContextPayload = {
  tool_id: string
  workspace_id: string | null
  dataset_id: string | null
  dataset_version_id: string | null
  request_id: string | null
  actor: string
}

export type ToolHealthPayload = {
  tool_id: string
  status: 'healthy' | 'degraded' | 'down'
  endpoint: string
  checked_at: string
  status_code: number | null
  detail: string | null
}

// ── Clip-centric Lance types ───────────────────────────────────────────────

export type ClipTopicRef = { name: string; non_null_count: number }
export type ClipCameraRef = { name: string; frame_count: number }
export type ClipStandaloneRef = { name: string; row_count: number }

export type ClipSummary = {
  clip_id: string
  keyframe_count: number
  start_time: number | null
  end_time: number | null
  duration_seconds: number | null
  vehicle_name: string | null
  city: string | null
  district: string | null
  scenario: string | null
  tags: string | null
  da_tags: string | null
  topics: ClipTopicRef[]
  cameras: ClipCameraRef[]
  standalone_topics: ClipStandaloneRef[]
  has_wm: boolean
}

export type ClipListResponse = { items: ClipSummary[]; total: number }

export type ClipCameraCatalogItem = {
  name: string
  position: string | null
  ros_topic: string | null
  model: string | null
  vendor: string | null
  width: number | null
  height: number | null
  hfov: number | null
  vfov: number | null
  is_avm: boolean
  extrinsic_xyz: [number | null, number | null, number | null] | null
  mp4_path: string | null
  mp4_resize_paths: string[]
  has_local_video: boolean
}

export type ClipDetail = {
  item: ClipSummary
  meta: {
    vehicle_name: string | null
    vehicle_model: number | null
    vehicle_info: Record<string, number> | null
    city: string | null
    district: string | null
    scenario: string | null
    tags: string | null
    da_tags: string | null
    jira_id: string | null
    start_time: number | null
    end_time: number | null
    calibration_version: number | null
  }
  camera_catalog: ClipCameraCatalogItem[]
}

export type ClipFrameRow = Record<string, unknown>

export type ClipFramesResponse = {
  items: ClipFrameRow[]
  limit: number
  offset: number
}

export type ClipAlignedFrame = {
  timestamp: number
  video_frame_timestamp: number
  video_frame_index: number | null
}

export type ClipAlignedResponse = {
  camera: string
  items: ClipAlignedFrame[]
}
