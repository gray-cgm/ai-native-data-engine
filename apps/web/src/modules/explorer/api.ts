import { apiGet } from '@/shared/api/client'
import type { DistributionRow, SearchRow, DashboardPayload } from '@/shared/types/common'

export async function fetchDistribution(): Promise<DistributionRow[]> {
  const data = await apiGet<DashboardPayload>('/dashboard')
  return data.distribution
}

export async function fetchSearchRows(): Promise<SearchRow[]> {
  const data = await apiGet<DashboardPayload>('/dashboard')
  return data.searchRows
}
