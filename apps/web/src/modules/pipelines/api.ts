import { apiGet } from '@/shared/api/client'
import type { DashboardPayload, RunItem } from '@/shared/types/common'

export async function fetchRuns(): Promise<RunItem[]> {
  const data = await apiGet<DashboardPayload>('/dashboard')
  return data.runs
}
