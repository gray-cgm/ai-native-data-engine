import { apiGet } from '@/shared/api/client'
import type { DistributionRow, SearchRow, DashboardPayload } from '@/shared/types/common'

export async function fetchExplorerDashboard(): Promise<DashboardPayload> {
  return apiGet<DashboardPayload>('/dashboard')
}

export async function fetchDistribution(): Promise<DistributionRow[]> {
  const data = await fetchExplorerDashboard()
  return data.distribution
}

export async function fetchSearchRows(): Promise<SearchRow[]> {
  const data = await fetchExplorerDashboard()
  return data.searchRows
}
