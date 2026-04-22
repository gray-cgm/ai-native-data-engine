import { fetchClips, type ClipSummary } from '@/modules/explorer/clips-api'

/**
 * Clip-centric dataset view derived from `/clips`.
 *
 * The platform's catalog is clip-centric: clips are grouped into "datasets" by
 * a stable grouping key (currently `scenario`, falling back to `unassigned`).
 * This lets Catalog -> Dataset Detail -> Clip Detail drill-downs stay
 * meaningful without a separate dataset registry. When a real dataset registry
 * arrives, the grouping key can be swapped to the registered dataset id.
 */

export type ClipDataset = {
  dataset_id: string
  grouping_key: 'scenario'
  scenario: string | null
  name: string
  clip_count: number
  keyframe_total: number
  duration_total_seconds: number
  vehicle_names: string[]
  cities: string[]
  tags: string[]
  sample_clip_ids: string[]
}

export type ClipDatasetDetail = {
  dataset: ClipDataset
  clips: ClipSummary[]
}

const UNASSIGNED = 'unassigned'

export function deriveDatasetId(scenario: string | null | undefined): string {
  const key = (scenario ?? '').trim()
  return key ? `scenario:${key}` : `scenario:${UNASSIGNED}`
}

export function parseDatasetId(datasetId: string): { grouping: 'scenario'; value: string | null } {
  if (datasetId.startsWith('scenario:')) {
    const value = datasetId.slice('scenario:'.length)
    return { grouping: 'scenario', value: value === UNASSIGNED ? null : value }
  }
  // unknown prefix — fall back to treating the whole thing as a scenario value
  return { grouping: 'scenario', value: datasetId || null }
}

export function clipBelongsToDataset(clip: ClipSummary, datasetId: string): boolean {
  return deriveDatasetId(clip.scenario) === datasetId
}

function unique<T>(values: Iterable<T>): T[] {
  return Array.from(new Set(values)).filter((v) => v !== null && v !== undefined && v !== '')
}

export function buildClipDatasets(clips: ClipSummary[]): ClipDataset[] {
  const buckets = new Map<string, ClipSummary[]>()
  for (const clip of clips) {
    const key = deriveDatasetId(clip.scenario)
    const existing = buckets.get(key)
    if (existing) existing.push(clip)
    else buckets.set(key, [clip])
  }
  const datasets: ClipDataset[] = []
  for (const [datasetId, bucket] of buckets) {
    const scenario = parseDatasetId(datasetId).value
    const tags = unique(
      bucket.flatMap((c) => (c.tags ?? '').split(',').map((t) => t.trim())),
    )
    datasets.push({
      dataset_id: datasetId,
      grouping_key: 'scenario',
      scenario,
      name: scenario ? scenario : 'Unassigned clips',
      clip_count: bucket.length,
      keyframe_total: bucket.reduce((s, c) => s + (c.keyframe_count || 0), 0),
      duration_total_seconds: bucket.reduce((s, c) => s + (c.duration_seconds || 0), 0),
      vehicle_names: unique(bucket.map((c) => c.vehicle_name ?? '').filter(Boolean)),
      cities: unique(bucket.map((c) => c.city ?? '').filter(Boolean)),
      tags,
      sample_clip_ids: bucket.slice(0, 6).map((c) => c.clip_id),
    })
  }
  // Stable ordering: largest first, then name
  datasets.sort((a, b) => {
    if (b.clip_count !== a.clip_count) return b.clip_count - a.clip_count
    return a.name.localeCompare(b.name)
  })
  return datasets
}

export async function fetchClipDatasets(): Promise<ClipDataset[]> {
  const resp = await fetchClips()
  return buildClipDatasets(resp.items ?? [])
}

export async function fetchClipDatasetDetail(datasetId: string): Promise<ClipDatasetDetail | null> {
  const resp = await fetchClips()
  const clips = (resp.items ?? []).filter((c) => clipBelongsToDataset(c, datasetId))
  const all = buildClipDatasets(resp.items ?? [])
  const dataset = all.find((d) => d.dataset_id === datasetId)
  if (!dataset) return null
  return { dataset, clips }
}
