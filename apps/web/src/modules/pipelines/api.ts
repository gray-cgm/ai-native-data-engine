import { apiGet } from '@/shared/api/client'
import type { PaginatedResponse, RunItem, StreamingSummary } from '@/shared/types/common'

export async function fetchRuns(): Promise<RunItem[]> {
  const data = await apiGet<PaginatedResponse<RunItem>>('/runs')
  return data.items
}

export async function fetchStreamingSummary(): Promise<StreamingSummary | null> {
  try {
    const data = await apiGet<{ summary?: StreamingSummary | null } | StreamingSummary>('/streaming/summary')
    // The BFF may wrap the response in { summary: ... } (from platformFetch) or return directly
    if (data && typeof data === 'object' && 'summary' in data) {
      return (data as { summary?: StreamingSummary | null }).summary ?? null
    }
    return (data as StreamingSummary) ?? null
  } catch {
    return null
  }
}
