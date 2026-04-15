import { apiGet } from '@/shared/api/client'
import type { PaginatedResponse, RunItem } from '@/shared/types/common'

export async function fetchRuns(): Promise<RunItem[]> {
  const data = await apiGet<PaginatedResponse<RunItem>>('/runs')
  return data.items
}
