import { apiGet, apiPost } from '@/shared/api/client'

// ── Types ──

export type RequirementListItem = {
  id: string
  title: string
  description: string | null
  priority: string
  source: string
  status: string
  dre_owner: string
  scene_tags: string[] | null
  vehicle_tags: string[] | null
  task_count: number
  created_at: string
  updated_at: string
}

export type DataTaskView = {
  id: string
  requirement_id: string
  title: string
  description: string | null
  task_type: string
  status: string
  sign_off_status: string
  sign_off_by: string | null
  sign_off_at: string | null
  sign_off_comment: string | null
  assigned_to: string | null
  target_count: number
  actual_count: number
  due_date: string | null
  created_at: string
  updated_at: string
}

export type RequirementDetailView = RequirementListItem & {
  feishu_doc_id: string | null
  target_scene: string | null
  estimated_data_volume: number | null
  due_date: string | null
  data_tasks: DataTaskView[]
}

export type RequirementStats = {
  total: number
  by_status: Record<string, number>
  by_priority: Record<string, number>
  by_source: Record<string, number>
}

// Role-Based Requirement Report —— 与 BFF requirementEngine.buildRequirementReport 同形
export type FunnelStage = {
  task_type: string
  task_count: number
  target_count: number
  actual_count: number
  completion_ratio: number
  completed_task_count: number
}

export type DatasetSummaryItem = {
  id: string
  name: string
  dataset_type: string
  dataset_version: number
  allow_train: boolean
  status: string
  created_at: string
}

export type RollupRow = {
  dataset_id: string
  sample_count: number
  consumed_count: number
  train_run_count: number
  snapshot_count: number
  mean_loss: number | null
  hard_sample_count: number
  hard_ratio: number
}

export type RequirementReportView = {
  requirement: RequirementDetailView
  headline: {
    data_task_count: number
    data_task_completed: number
    ops_task_count: number
    pipeline_run_count: number
    dataset_count: number
    snapshot_count: number
    lineage_event_count: number
  }
  sections: {
    manager: {
      funnel: FunnelStage[]
      cost: {
        total_cost_usd: number
        total_cpu_seconds: number
        total_gpu_seconds: number
        total_duration_seconds: number
        total_rows_in: number
        total_rows_out: number
        run_count: number
      }
    }
    data_engineer: {
      pipeline_health: { running: number; success: number; failed: number; pending: number }
      failed_top: Array<Record<string, unknown>>
      ops_by_module: Record<string, Array<Record<string, unknown>>>
      snapshots: Array<Record<string, unknown>>
    }
    mle: {
      datasets: DatasetSummaryItem[]
      customized_count: number
      official_count: number
      training_impact_totals: {
        consumed_count: number
        train_run_count: number
        snapshot_count: number
        hard_sample_count: number
        sample_count: number
      }
      dataset_impacts: Array<{ dataset_id: string; rollup: RollupRow | null }>
      export_snapshots: Array<Record<string, unknown>>
      loop_back_tasks: Array<Record<string, unknown>>
    }
  }
}

type PaginatedList<T> = {
  total: number
  page: number
  page_size: number
  items: T[]
}

// ── API calls ──

export type RequirementListQuery = {
  status?: string
  priority?: string
  source?: string
  keyword?: string
  page?: number
  pageSize?: number
}

export async function fetchRequirements(query: RequirementListQuery = {}): Promise<PaginatedList<RequirementListItem>> {
  const params = new URLSearchParams()
  if (query.status) params.set('status', query.status)
  if (query.priority) params.set('priority', query.priority)
  if (query.source) params.set('source', query.source)
  if (query.keyword) params.set('keyword', query.keyword)
  if (query.page) params.set('page', String(query.page))
  if (query.pageSize) params.set('pageSize', String(query.pageSize))
  const qs = params.toString()
  return apiGet<PaginatedList<RequirementListItem>>(`/requirements${qs ? `?${qs}` : ''}`)
}

export async function fetchRequirementDetail(id: string): Promise<RequirementDetailView> {
  return apiGet<RequirementDetailView>(`/requirements/${id}`)
}

export async function fetchRequirementStats(): Promise<RequirementStats> {
  return apiGet<RequirementStats>('/requirements/stats')
}

export async function fetchRequirementReport(id: string): Promise<RequirementReportView> {
  return apiGet<RequirementReportView>(`/requirements/${id}/report`)
}

export async function signOffTask(taskId: string, approved: boolean, signOffBy: string, comment?: string) {
  return apiPost(`/data-tasks/${taskId}/sign-off`, {
    approved,
    sign_off_by: signOffBy,
    comment: comment || null,
  })
}
