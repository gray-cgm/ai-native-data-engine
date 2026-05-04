import { platformFetch } from './platform.js'

export type ListSnapshotsQuery = {
  limit?: number
  scenario?: string
  dataset_id?: string
  consumed?: 'yes' | 'no'
}

function toQuery(params: Record<string, string | number | undefined>) {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    usp.set(k, String(v))
  }
  const s = usp.toString()
  return s ? `?${s}` : ''
}

export async function listSnapshots(query: ListSnapshotsQuery) {
  return platformFetch(`/api/v1/exports/snapshots${toQuery(query)}`)
}

export async function getSnapshot(traceId: string) {
  return platformFetch(`/api/v1/exports/snapshots/${encodeURIComponent(traceId)}`)
}

export type ListTrainRunsQuery = {
  limit?: number
  snapshot_trace?: string
  consumer?: string
  status?: string
}

export async function listTrainRuns(query: ListTrainRunsQuery) {
  return platformFetch(`/api/v1/exports/train-runs${toQuery(query)}`)
}

export async function getTrainRun(runId: string) {
  return platformFetch(`/api/v1/exports/train-runs/${encodeURIComponent(runId)}`)
}

export type CreateTrainRunBody = {
  snapshot_ids: string[]
  name?: string
  consumer?: string
  external_run_id?: string
  model_version?: string
  notes?: string
}

export async function createTrainRun(body: CreateTrainRunBody) {
  return platformFetch('/api/v1/exports/train-runs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export type PatchTrainRunBody = {
  status?: string
  finished_at?: string
  notes?: string
}

export async function patchTrainRun(runId: string, body: PatchTrainRunBody) {
  return platformFetch(`/api/v1/exports/train-runs/${encodeURIComponent(runId)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Usage events (P1) ────────────────────────────────────────────────

export type ListUsageQuery = {
  snapshot_trace?: string
  train_run_id?: string
  sample_uid?: string
  limit?: number
}

export async function listUsage(query: ListUsageQuery) {
  return platformFetch(`/api/v1/exports/usage${toQuery(query)}`)
}

// ── Contributions (P2) ─────────────────────────────────────────────

export type ListContributionsQuery = {
  dataset_id?: string
  limit?: number
}

export async function listContributions(query: ListContributionsQuery) {
  return platformFetch(`/api/v1/exports/contributions${toQuery(query)}`)
}

export async function getContributionsRollup(query: { dataset_id?: string }) {
  return platformFetch(`/api/v1/exports/contributions/rollup${toQuery(query)}`)
}

export async function getContribution(sampleUid: string) {
  return platformFetch(`/api/v1/exports/contributions/${encodeURIComponent(sampleUid)}`)
}
