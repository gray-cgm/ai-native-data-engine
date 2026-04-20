import { platformFetch } from './platform.js'

export type RequirementItem = {
  id: string
  title: string
  description: string | null
  priority: string
  source: string
  status: string
  dre_owner: string
  feishu_doc_id: string | null
  target_scene: string | null
  scene_tags: string[] | null
  vehicle_tags: string[] | null
  estimated_data_volume: number | null
  due_date: string | null
  task_count: number
  created_at: string
  updated_at: string
}

export type RequirementDetail = RequirementItem & {
  data_tasks: DataTaskItem[]
}

export type DataTaskItem = {
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

export async function listRequirements(query: Record<string, string>) {
  const params = new URLSearchParams(query)
  return (await platformFetch(`/api/v1/requirements?${params.toString()}`)) as PaginatedList<RequirementItem>
}

export async function getRequirement(id: string) {
  return (await platformFetch(`/api/v1/requirements/${id}`)) as RequirementDetail
}

export async function getRequirementStats() {
  return (await platformFetch('/api/v1/requirements/stats')) as RequirementStats
}

export async function createRequirement(body: Record<string, unknown>) {
  return platformFetch('/api/v1/requirements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function updateRequirement(id: string, body: Record<string, unknown>) {
  return platformFetch(`/api/v1/requirements/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function createDataTask(body: Record<string, unknown>) {
  return platformFetch('/api/v1/data-tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function updateDataTask(id: string, body: Record<string, unknown>) {
  return platformFetch(`/api/v1/data-tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function signOffDataTask(id: string, body: Record<string, unknown>) {
  return platformFetch(`/api/v1/data-tasks/${id}/sign-off`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
