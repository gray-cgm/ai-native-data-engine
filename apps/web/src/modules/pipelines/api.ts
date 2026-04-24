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

// ── Full-chain pipeline runs (x_trace_id) ────────────────────────────────

export type PipelineRunRow = {
  id: string
  pipeline_name: string
  stage: string
  status: string
  input_uri: string
  output_uri?: string | null
  data_task_id: string
  requirement_id?: string | null
  operations_task_id?: string | null
  x_trace_id?: string | null
  trace_parent_id?: string | null
  trigger_source: string
  run_purpose: string
  started_at?: string | null
  completed_at?: string | null
  created_at: string
  metrics?: Record<string, unknown> | null
}

export type RunBreadcrumb = {
  requirement: Record<string, unknown> | null
  data_task: Record<string, unknown> | null
  operations_task: Record<string, unknown> | null
  run: Record<string, unknown>
}

export type PipelineRunFilters = Partial<{
  requirement_id: string
  data_task_id: string
  operations_task_id: string
  x_trace_id: string
  stage: string
  status: string
  trigger_source: string
  run_purpose: string
}>

export async function fetchPipelineRuns(filters: PipelineRunFilters = {}): Promise<PipelineRunRow[]> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v) qs.set(k, v)
  }
  const tail = qs.toString()
  const data = await apiGet<{ items: PipelineRunRow[] }>(`/pipelines/runs${tail ? `?${tail}` : ''}`)
  return data.items ?? []
}

export async function fetchRunBreadcrumb(runId: string): Promise<RunBreadcrumb> {
  return apiGet<RunBreadcrumb>(`/pipelines/runs/${encodeURIComponent(runId)}`)
}

export async function fetchPipelineStageStats(): Promise<Record<string, Record<string, number>>> {
  return apiGet<Record<string, Record<string, number>>>('/pipelines/stage-stats')
}

// ── Quality stats ────────────────────────────────────────────────────────

export type QualityStats = {
  total_runs: number
  total_with_metrics: number
  pass_rate: number
  by_gate_result: Record<string, number>
  top_failure_reasons: Array<{ reason: string; count: number }>
  by_run_purpose: Record<string, Record<string, number>>
  by_stage: Record<string, Record<string, number>>
}

export async function fetchQualityStats(): Promise<QualityStats> {
  return apiGet<QualityStats>('/pipelines/quality-stats')
}

// ── Cost stats ───────────────────────────────────────────────────────────

export type CostStats = {
  total_runs: number
  totals: {
    cost_usd: number
    cpu_seconds: number
    gpu_seconds: number
    storage_gb: number
    duration_seconds: number
  }
  by_requirement: Array<{ requirement_id: string; title: string; cost_usd: number }>
  by_pipeline: Array<{ pipeline_name: string; cost_usd: number }>
  by_stage: Array<{ stage: string; cost_usd: number }>
  by_run_purpose: Array<{ run_purpose: string; cost_usd: number }>
}

export async function fetchCostStats(): Promise<CostStats> {
  return apiGet<CostStats>('/pipelines/cost-stats')
}

// ── Lineage / traces ─────────────────────────────────────────────────────

export type TraceSummary = {
  x_trace_id: string
  requirement_id: string | null
  requirement_title: string | null
  run_count: number
  latest_at: string | null
}

export async function fetchRecentTraces(limit = 50): Promise<TraceSummary[]> {
  const res = await apiGet<{ items: TraceSummary[] }>(`/pipelines/traces?limit=${limit}`)
  return res.items ?? []
}

export type TraceChain = {
  x_trace_id: string
  requirements: Array<Record<string, unknown>>
  data_tasks: Array<Record<string, unknown>>
  operations_tasks: Array<Record<string, unknown>>
  pipeline_runs: Array<Record<string, unknown>>
}

export async function fetchTraceChain(xTraceId: string): Promise<TraceChain> {
  return apiGet<TraceChain>(`/pipelines/trace/${encodeURIComponent(xTraceId)}`)
}
