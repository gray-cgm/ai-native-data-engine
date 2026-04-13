import { apiGet, apiPost } from '@/shared/api/client'
import type { TaskItem, ExportItem, DashboardPayload } from '@/shared/types/common'

export async function fetchTasks(): Promise<TaskItem[]> {
  const data = await apiGet<DashboardPayload>('/dashboard')
  return data.tasks
}

export async function fetchExports(): Promise<ExportItem[]> {
  const data = await apiGet<DashboardPayload>('/dashboard')
  return data.exports
}

export async function triggerExport(datasetId: string): Promise<unknown> {
  return apiPost(`/datasets/${datasetId}/exports`)
}
