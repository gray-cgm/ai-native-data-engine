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

export type SearchRow = {
  id: string
  scene: string
  dataset_version_id?: string
}

export type DashboardPayload = {
  distribution: DistributionRow[]
  datasets: DatasetItem[]
  datasetVersions: Record<string, DatasetVersion[]>
  tasks: TaskItem[]
  workspaces: WorkspaceItem[]
  exports: ExportItem[]
  searchRows: SearchRow[]
}
