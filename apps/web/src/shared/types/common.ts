// Page state machine states
export type PageState = 'idle' | 'loading' | 'ready' | 'empty' | 'error'

export type StatusEnum = 'pending' | 'running' | 'done' | 'failed' | 'canceled'

export type DistributionRow = { scene: string; sample_count: number }

export type DatasetVersion = {
  version_id: string
  dataset_id: string
  sample_count: number
  table_name: string
}

export type DatasetItem = {
  dataset_id: string
  name: string
  workspace_id: string
  profile: string
}

export type TaskItem = {
  task_id: string
  title: string
  status: string
  task_type: string
}

export type WorkspaceItem = {
  workspace_id: string
  name: string
}

export type ExportItem = {
  export_id: string
  dataset_id: string
  format: string
  status: string
  output_path: string
}

export type RunItem = {
  run_id: string
  job_name: string
  status: string
}

export type PaginatedResponse<T> = {
  items: T[]
  pagination: {
    total: number
    skip: number
    limit: number
  }
}

export type SearchRow = {
  id: string
  scene: string
  dataset_version_id?: string
}

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
  scenario_sample_count: number
  dominant_scene: string
  candidate_sample_ids: string[]
  priority_sample_ids: string[]
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
  operator: {
    user_id?: string
    email?: string
    display_name?: string
    roles?: string[]
  }
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
