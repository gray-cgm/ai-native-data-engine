import { apiGet, apiPost } from '@/shared/api/client'

export type DatasetV2 = {
  id: string
  name: string
  dataset_type: 'official' | 'customized'
  dataset_version: number
  source_type: 'tags' | 'csv' | 'other'
  requirement_id: string | null
  allow_train: boolean
  status: 'active' | 'frozen' | 'deprecated'
  tag_expr: string | null
  slice_strategy: 'one_to_four' | 'flexible' | 'random_sample' | 'no_ts'
  ts_policy: string
  default_range_l: number
  default_range_r: number
  created_by: string
  resolved_meta: Record<string, unknown> | null
  created_at: string | null
  updated_at: string | null
}

export type DatasetSampleV2 = {
  id: string
  dataset_id: string
  clip_id: string
  ts: number
  range_l: number
  range_r: number
  ts_origin: string
  origin_ref: string | null
  extra_meta: Record<string, unknown> | null
  training_type: 'train' | 'test' | 'holdout'
  created_at: string | null
}

export type CutResponse = {
  sample: DatasetSampleV2 | null
  event: Record<string, unknown>
  deduplicated: boolean
}

export async function listDatasets(query: Record<string, string | number | undefined> = {}) {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v == null || v === '') continue
    search.set(k, String(v))
  }
  const qs = search.toString() ? `?${search.toString()}` : ''
  return apiGet<{ items: DatasetV2[]; total: number }>(`/datasets${qs}`)
}

export async function createDataset(body: {
  name: string
  dataset_type: 'official' | 'customized'
  source_type: 'tags' | 'csv' | 'other'
  requirement_id?: string
  allow_train?: boolean
  tag_expr?: string
  default_range_l?: number
  default_range_r?: number
  created_by?: string
}) {
  return apiPost<DatasetV2>('/datasets', body)
}

export async function getDataset(datasetId: string) {
  return apiGet<{ item: DatasetV2; sample_count: number }>(
    `/datasets/${encodeURIComponent(datasetId)}`,
  )
}

export async function flexibleCut(
  datasetId: string,
  body: {
    clip_id: string
    ts_start: number
    ts_end: number
    ts_center?: number
    range_l?: number
    range_r?: number
    requirement_id?: string
    operations_task_id?: string
    note?: string
  },
) {
  return apiPost<CutResponse>(`/datasets/${encodeURIComponent(datasetId)}/cut`, body)
}

export async function listSamples(
  datasetId: string,
  query: { clip_id?: string; training_type?: string; limit?: number; offset?: number } = {},
) {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v == null || v === '') continue
    search.set(k, String(v))
  }
  const qs = search.toString() ? `?${search.toString()}` : ''
  return apiGet<{ items: DatasetSampleV2[]; total: number; limit: number; offset: number }>(
    `/datasets/${encodeURIComponent(datasetId)}/samples${qs}`,
  )
}

export type PromoteResponse = {
  official_dataset: DatasetV2
  samples_copied: number
  samples_deduped: number
  event: Record<string, unknown>
  ops_item: Record<string, unknown> | null
}

export async function promoteDataset(
  datasetId: string,
  body: {
    name?: string
    tag_expr?: string
    allow_train?: boolean
    requirement_id?: string
    ops_item_id?: string
    x_trace_id?: string
    created_by?: string
  } = {},
) {
  return apiPost<PromoteResponse>(
    `/datasets/${encodeURIComponent(datasetId)}/promote`,
    body,
  )
}
