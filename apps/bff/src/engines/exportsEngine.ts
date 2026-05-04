import {
  createTrainRun,
  getContribution,
  getContributionsRollup,
  getSnapshot,
  getTrainRun,
  listContributions,
  listSnapshots,
  listTrainRuns,
  listUsage,
  patchTrainRun,
  type CreateTrainRunBody,
  type ListContributionsQuery,
  type ListSnapshotsQuery,
  type ListTrainRunsQuery,
  type ListUsageQuery,
  type PatchTrainRunBody,
} from '../services/exports.js'

export type SnapshotsListVM = {
  items: Array<Record<string, unknown> & {
    x_trace_id: string
    consumed_count: number
    train_run_count: number
    last_consumed_at: string | null
    hard_sample_count: number
    consumption_state: 'fresh' | 'used' | 'cold'
  }>
  total: number
  summary: {
    total: number
    used: number
    fresh: number
    cold: number
  }
}

function deriveConsumptionState(item: {
  consumed_count: number
  train_run_count: number
  last_consumed_at: string | null
}): 'fresh' | 'used' | 'cold' {
  if (item.train_run_count === 0 && item.consumed_count === 0) {
    return 'fresh'
  }
  if (item.train_run_count > 0 || item.consumed_count > 0) {
    return 'used'
  }
  return 'cold'
}

export async function listSnapshotsVM(query: ListSnapshotsQuery): Promise<SnapshotsListVM> {
  const raw = (await listSnapshots(query)) as {
    items: Array<Record<string, unknown>>
    total: number
  }
  const items = raw.items.map((it) => {
    const norm = it as SnapshotsListVM['items'][number]
    return { ...norm, consumption_state: deriveConsumptionState(norm) }
  })
  const summary = items.reduce(
    (acc, it) => {
      acc.total += 1
      if (it.consumption_state === 'used') acc.used += 1
      else if (it.consumption_state === 'fresh') acc.fresh += 1
      else acc.cold += 1
      return acc
    },
    { total: 0, used: 0, fresh: 0, cold: 0 }
  )
  return { items, total: raw.total, summary }
}

export async function getSnapshotVM(traceId: string) {
  return getSnapshot(traceId)
}

export async function listTrainRunsVM(query: ListTrainRunsQuery) {
  return listTrainRuns(query)
}

export async function getTrainRunVM(runId: string) {
  return getTrainRun(runId)
}

export async function createTrainRunVM(body: CreateTrainRunBody) {
  return createTrainRun(body)
}

export async function patchTrainRunVM(runId: string, body: PatchTrainRunBody) {
  return patchTrainRun(runId, body)
}

export async function listUsageVM(query: ListUsageQuery) {
  return listUsage(query)
}

export async function listContributionsVM(query: ListContributionsQuery) {
  return listContributions(query)
}

export async function getContributionsRollupVM(query: { dataset_id?: string }) {
  return getContributionsRollup(query)
}

export async function getContributionVM(sampleUid: string) {
  return getContribution(sampleUid)
}
