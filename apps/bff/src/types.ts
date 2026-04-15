export type DistributionRow = { scene: string; sample_count: number }
export type DatasetVersion = { version_id: string; dataset_id: string; sample_count: number; table_name: string }
export type DatasetItem = { dataset_id: string; name: string; workspace_id: string; profile: string }
export type TaskItem = { task_id: string; title: string; status: string; task_type: string }
export type WorkspaceItem = { workspace_id: string; name: string }
export type ExportItem = { export_id: string; dataset_id: string; format: string; status: string; output_path: string }
export type SearchRow = { id: string; scene: string; dataset_version_id?: string }
export type RunItem = { run_id: string; job_name: string; status: string }

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
  operator: { user_id?: string; email?: string; display_name?: string; roles?: string[] }
}

export type DashboardPayload = {
  distribution: DistributionRow[]
  scenario: ScenarioTriageSummary | null
  datasets: DatasetItem[]
  datasetVersions: Record<string, DatasetVersion[]>
  tasks: TaskItem[]
  workspaces: WorkspaceItem[]
  exports: ExportItem[]
  runs: RunItem[]
  searchRows: SearchRow[]
}
