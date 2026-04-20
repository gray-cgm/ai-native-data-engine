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

export async function signOffTask(taskId: string, approved: boolean, signOffBy: string, comment?: string) {
  return apiPost(`/data-tasks/${taskId}/sign-off`, {
    approved,
    sign_off_by: signOffBy,
    comment: comment || null,
  })
}
