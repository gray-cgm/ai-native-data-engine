/**
 * Overview module API wrappers.
 *
 * Calls go through the BFF (`/api` prefix injected by `apiGet`); BFF aggregates
 * or proxies to the Platform API. We keep this file as the single source of
 * truth for endpoint paths used by the Overview Dashboard.
 *
 * NOTE — keep MVP-skinny: don't materialize a `/api/overview/dashboard`
 * aggregate endpoint (D1 in PRD). Each card calls one endpoint; failures are
 * isolated per card by `useQuery` state.
 */

import { apiGet } from '@/shared/api/client'

// ─────────────────────────── Requirement stats ───────────────────────────

export type RequirementStats = {
  total: number
  by_status: Record<string, number>
  by_priority: Record<string, number>
  by_source: Record<string, number>
}

export async function fetchRequirementStats(): Promise<RequirementStats> {
  return apiGet<RequirementStats>('/requirements/stats')
}

export type RequirementListItem = {
  id: string
  title: string
  priority: string
  status: string
  source: string
  scene_tags?: string[] | null
  created_at: string
  updated_at: string
}

export async function fetchRequirementList(filters: Partial<{
  status: string
  priority: string
  limit: number
}> = {}): Promise<{ items: RequirementListItem[]; total: number }> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v == null || v === '') continue
    qs.set(k, String(v))
  }
  const tail = qs.toString()
  return apiGet<{ items: RequirementListItem[]; total: number }>(
    `/requirements${tail ? `?${tail}` : ''}`,
  )
}

// ─────────────────────────── Pipelines ───────────────────────────

export type PipelineRunRow = {
  id: string
  pipeline_name: string
  stage: string
  status: string
  trigger_source: string
  run_purpose: string
  x_trace_id?: string | null
  requirement_id?: string | null
  started_at?: string | null
  completed_at?: string | null
  created_at: string
  metrics?: Record<string, unknown> | null
}

/** /pipelines/runs returns either {items, total} OR a bare array depending
 *  on platform version. Normalize to {items, total}. */
export async function fetchPipelineRuns(filters: Partial<{
  status: string
  page_size: number
}> = {}): Promise<{ items: PipelineRunRow[]; total: number }> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v == null || v === '') continue
    qs.set(k, String(v))
  }
  const tail = qs.toString()
  const raw = await apiGet<unknown>(`/pipelines/runs${tail ? `?${tail}` : ''}`)
  if (Array.isArray(raw)) {
    return { items: raw as PipelineRunRow[], total: raw.length }
  }
  const obj = raw as { items?: PipelineRunRow[]; total?: number }
  return { items: obj.items ?? [], total: obj.total ?? obj.items?.length ?? 0 }
}

export type PipelineCostStats = {
  total_runs: number
  totals: {
    cost_usd?: number
    cpu_s?: number
    gpu_s?: number
    storage_gb?: number
    duration_s?: number
  }
  by_requirement?: Record<string, { cost_usd: number; runs: number }>
  by_pipeline?: Record<string, { cost_usd: number; runs: number }>
  by_stage?: Record<string, { cost_usd: number; runs: number }>
  by_run_purpose?: Record<string, { cost_usd: number; runs: number }>
}

export async function fetchPipelineCostStats(): Promise<PipelineCostStats> {
  return apiGet<PipelineCostStats>('/pipelines/cost-stats')
}

// ─────────────────────────── Datasets ───────────────────────────

export type DatasetSummary = {
  id: string
  name: string
  dataset_type: 'customized' | 'official'
  dataset_version: number
  allow_train: boolean
  status: string
  requirement_id?: string | null
  created_at: string
  updated_at: string
}

export async function fetchDatasets(filters: Partial<{
  dataset_type: 'official' | 'customized'
  limit: number
}> = {}): Promise<{ items: DatasetSummary[]; total: number }> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v == null) continue
    const s = String(v)
    if (!s) continue
    qs.set(k, s)
  }
  const tail = qs.toString()
  return apiGet<{ items: DatasetSummary[]; total: number }>(
    `/datasets${tail ? `?${tail}` : ''}`,
  )
}

// ─────────────────────────── Ops overview ───────────────────────────

export type OpsModuleCounts = {
  total?: number
  draft?: number
  in_progress?: number
  review?: number
  done?: number
  blocked?: number
  failed?: number
  running?: number
  candidates_ready?: number
  approved?: number
  published?: number
  gated?: number
  drafted?: number
  applied?: number
  rolled_back?: number
  [k: string]: number | undefined
}

export type OpsModuleSummary = {
  module: string
  counts: OpsModuleCounts
}

export async function fetchOpsOverview(): Promise<{ modules: OpsModuleSummary[] }> {
  return apiGet<{ modules: OpsModuleSummary[] }>('/ops/overview')
}

// ─────────────────────────── Clip scenarios ───────────────────────────

export type ScenarioSummary = {
  scenario_id: string
  scenario_name: string
  clip_count: number
  keyframe_count: number
  duration_seconds: number
  tag_histogram?: Record<string, number>
}

export async function fetchScenarios(): Promise<{ items: ScenarioSummary[] }> {
  return apiGet<{ items: ScenarioSummary[] }>('/clips/scenarios')
}

// ─────────────────────────── Tools registry (BFF-native) ───────────────────────────

export type ToolRegistryItem = {
  id: string
  name: string
  short_name?: string
  category: string
  summary?: string
  workspace_path?: string
  health_path?: string
}

export async function fetchToolsRegistry(): Promise<{ items: ToolRegistryItem[] }> {
  return apiGet<{ items: ToolRegistryItem[] }>('/tools/registry')
}

// ─────────────────────────── Exports snapshots (used for asset NSM) ───────────────────────────

export type SnapshotsSummary = {
  total: number
  used: number
  fresh: number
  cold: number
}

export async function fetchSnapshotsSummary(): Promise<SnapshotsSummary> {
  const r = await apiGet<{ summary?: SnapshotsSummary; total: number; items: unknown[] }>(
    '/exports/snapshots?limit=200',
  )
  return r.summary ?? { total: r.total ?? 0, used: 0, fresh: 0, cold: 0 }
}
