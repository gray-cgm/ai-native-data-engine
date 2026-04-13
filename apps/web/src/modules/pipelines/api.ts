import { apiGet } from '@/shared/api/client'
import type { DashboardPayload } from '@/shared/types/common'

export interface RunItem {
  task_id: string
  title: string
  task_type: string
  status: string
}

export async function fetchRuns(): Promise<RunItem[]> {
  // Current MVP surfaces pipeline runs via the tasks endpoint
  // with task_type indicating the run kind (ingestion, materialization, etc.)
  const data = await apiGet<DashboardPayload>('/dashboard')
  return data.tasks
}
