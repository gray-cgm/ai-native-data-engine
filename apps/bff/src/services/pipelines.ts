import { platformFetch } from './platform.js'

const API_PREFIX = '/api/v1'

export type PipelineRunDto = {
  id: string
  data_task_id: string
  pipeline_name: string
  stage: string
  input_uri: string
  output_uri?: string | null
  status: string
  config?: Record<string, unknown> | null
  metrics?: Record<string, unknown> | null
  started_at?: string | null
  completed_at?: string | null
  x_trace_id?: string | null
  trace_parent_id?: string | null
  requirement_id?: string | null
  operations_task_id?: string | null
  trigger_source: string
  run_purpose: string
  created_at: string
  updated_at: string
}

export type RunBreadcrumbDto = {
  requirement: Record<string, unknown> | null
  data_task: Record<string, unknown> | null
  operations_task: Record<string, unknown> | null
  run: Record<string, unknown>
}

export type TraceChainDto = {
  x_trace_id: string
  requirements: Array<Record<string, unknown>>
  data_tasks: Array<Record<string, unknown>>
  operations_tasks: Array<Record<string, unknown>>
  pipeline_runs: Array<Record<string, unknown>>
}

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (entries.length === 0) return ''
  const usp = new URLSearchParams()
  for (const [k, v] of entries) usp.set(k, String(v))
  return `?${usp.toString()}`
}

export async function listPipelineRuns(query: Record<string, string>) {
  const qs = buildQuery(query)
  return platformFetch(`${API_PREFIX}/pipeline-runs${qs}`) as Promise<PipelineRunDto[]>
}

export async function getPipelineRunBreadcrumb(runId: string) {
  return platformFetch(`${API_PREFIX}/pipeline-runs/${encodeURIComponent(runId)}`) as Promise<RunBreadcrumbDto>
}

export async function getTraceChain(xTraceId: string) {
  return platformFetch(`${API_PREFIX}/trace/${encodeURIComponent(xTraceId)}`) as Promise<TraceChainDto>
}

export async function getPipelineStageStats() {
  return platformFetch(`${API_PREFIX}/pipeline-stats/stages`) as Promise<
    Record<string, Record<string, number>>
  >
}

export async function getPipelineQualityStats() {
  return platformFetch(`${API_PREFIX}/pipeline-stats/quality`) as Promise<{
    total_runs: number
    total_with_metrics: number
    pass_rate: number
    by_gate_result: Record<string, number>
    top_failure_reasons: Array<{ reason: string; count: number }>
    by_run_purpose: Record<string, Record<string, number>>
    by_stage: Record<string, Record<string, number>>
  }>
}

export async function getPipelineCostStats() {
  return platformFetch(`${API_PREFIX}/pipeline-stats/cost`) as Promise<{
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
  }>
}

export async function listRecentTraces(limit = 50) {
  return platformFetch(`${API_PREFIX}/traces?limit=${limit}`) as Promise<{
    items: Array<{
      x_trace_id: string
      requirement_id: string | null
      requirement_title: string | null
      run_count: number
      latest_at: string | null
    }>
  }>
}
