import { apiGet, apiPost, apiPatch } from '@/shared/api/client'

export type SnapshotConsumptionState = 'fresh' | 'used' | 'cold'

export type ExportSnapshot = {
  id: string
  x_trace_id: string
  requirement_id: string | null
  data_task_id: string | null
  operations_task_id: string | null
  gold_pipeline_run_id: string | null
  pipeline_run_count: number
  dataset_id: string | null
  dataset_version_id: string | null
  export_job_id: string | null
  export_artifact_uri: string | null
  export_format: string | null
  clip_ids: string[]
  scenario: string | null
  title: string | null
  summary: string | null
  sealed_at: string | null
  consumed_count: number
  train_run_count: number
  last_consumed_at: string | null
  hard_sample_count: number
  consumption_state: SnapshotConsumptionState
  created_at: string | null
  updated_at: string | null
}

export type SnapshotsListResponse = {
  items: ExportSnapshot[]
  total: number
  summary: {
    total: number
    used: number
    fresh: number
    cold: number
  }
}

export type SnapshotsFilters = Partial<{
  scenario: string
  dataset_id: string
  consumed: 'yes' | 'no'
  limit: number
}>

export type TrainRun = {
  id: string
  name: string | null
  consumer: string | null
  external_run_id: string | null
  model_version: string | null
  started_at: string | null
  finished_at: string | null
  status: string
  snapshot_ids: string[]
  parent_trace_ids: string[]
  x_trace_id: string
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

export type SnapshotDetail = ExportSnapshot & {
  manifest_json: Record<string, unknown> | null
  train_runs: TrainRun[]
}

export async function fetchSnapshots(filters: SnapshotsFilters = {}): Promise<SnapshotsListResponse> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === '') continue
    qs.set(k, String(v))
  }
  const tail = qs.toString()
  return apiGet<SnapshotsListResponse>(`/exports/snapshots${tail ? `?${tail}` : ''}`)
}

export async function fetchSnapshotDetail(traceId: string): Promise<SnapshotDetail> {
  return apiGet<SnapshotDetail>(`/exports/snapshots/${encodeURIComponent(traceId)}`)
}

export async function fetchTrainRuns(filters: Partial<{
  snapshot_trace: string
  consumer: string
  status: string
  limit: number
}> = {}): Promise<{ items: TrainRun[]; total: number }> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === '') continue
    qs.set(k, String(v))
  }
  const tail = qs.toString()
  return apiGet<{ items: TrainRun[]; total: number }>(`/exports/train-runs${tail ? `?${tail}` : ''}`)
}

export type CreateTrainRunBody = {
  snapshot_ids: string[]
  name?: string
  consumer?: string
  external_run_id?: string
  model_version?: string
  notes?: string
}

export async function createTrainRun(body: CreateTrainRunBody): Promise<TrainRun> {
  return apiPost<TrainRun>('/exports/train-runs', body)
}

export async function patchTrainRun(
  runId: string,
  body: { status?: string; finished_at?: string; notes?: string }
): Promise<TrainRun> {
  return apiPatch<TrainRun>(`/exports/train-runs/${encodeURIComponent(runId)}`, body)
}

// ── Usage events (P1) ────────────────────────────────────────────────────────

export type ConsumptionEvent = {
  id: string
  snapshot_trace: string
  sample_uid: string
  train_run_id: string
  epoch: number | null
  step: number | null
  loss: number | null
  ts: string | null
  x_trace_id: string
  created_at: string | null
}

export async function fetchUsage(filters: Partial<{
  snapshot_trace: string
  train_run_id: string
  sample_uid: string
  sample_uid_prefix: string
  limit: number
}> = {}): Promise<{ items: ConsumptionEvent[]; total: number }> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === '') continue
    qs.set(k, String(v))
  }
  const tail = qs.toString()
  return apiGet<{ items: ConsumptionEvent[]; total: number }>(`/exports/usage${tail ? `?${tail}` : ''}`)
}

// ── Contributions (P2) ───────────────────────────────────────────────────────

export type HardSampleRow = {
  sample_uid: string
  dataset_id: string | null
  clip_id: string | null
  ts: string | null
  consumed_count: number
  train_run_count: number
  mean_loss: number
  max_loss: number
  hard_score: number
  last_used_at: string | null
}

export type DatasetRollupRow = {
  dataset_id: string
  sample_count: number
  consumed_count: number
  train_run_count: number
  snapshot_count: number
  mean_loss: number | null
  hard_sample_count: number
  hard_ratio: number
}

export type SampleContribution = {
  sample_uid: string
  dataset_id: string | null
  clip_id: string | null
  ts: string | null
  consumed_count: number
  train_run_count: number
  snapshot_count: number
  mean_loss: number | null
  max_loss: number | null
  hard_score: number | null
  train_run_ids: string[]
  snapshot_traces: string[]
  events: Array<{
    ts: string | null
    epoch: number | null
    step: number | null
    loss: number | null
    train_run_id: string
  }>
}

export async function fetchContributions(filters: Partial<{
  dataset_id: string
  limit: number
}> = {}): Promise<{ items: HardSampleRow[]; total: number }> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === '') continue
    qs.set(k, String(v))
  }
  const tail = qs.toString()
  return apiGet<{ items: HardSampleRow[]; total: number }>(`/exports/contributions${tail ? `?${tail}` : ''}`)
}

export async function fetchContributionsRollup(filters: Partial<{
  dataset_id: string
}> = {}): Promise<{ items: DatasetRollupRow[]; total: number }> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === '') continue
    qs.set(k, String(v))
  }
  const tail = qs.toString()
  return apiGet<{ items: DatasetRollupRow[]; total: number }>(`/exports/contributions/rollup${tail ? `?${tail}` : ''}`)
}

export async function fetchContribution(sampleUid: string): Promise<SampleContribution> {
  return apiGet<SampleContribution>(`/exports/contributions/${encodeURIComponent(sampleUid)}`)
}
