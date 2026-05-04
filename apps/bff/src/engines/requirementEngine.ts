import {
  listRequirements,
  getRequirement,
  getRequirementStats,
  createRequirement,
  updateRequirement,
  createDataTask,
  updateDataTask,
  signOffDataTask,
} from '../services/requirements.js'
import { platformFetch } from '../services/platform.js'

type Query = Record<string, unknown>

export async function queryRequirements(query: Query) {
  const apiQuery: Record<string, string> = {}
  if (typeof query.status === 'string' && query.status) apiQuery.status = query.status
  if (typeof query.priority === 'string' && query.priority) apiQuery.priority = query.priority
  if (typeof query.source === 'string' && query.source) apiQuery.source = query.source
  if (typeof query.keyword === 'string' && query.keyword) apiQuery.keyword = query.keyword

  const page = typeof query.page === 'string' ? query.page : '1'
  const pageSize = typeof query.pageSize === 'string' ? query.pageSize : '20'
  apiQuery.page = page
  apiQuery.page_size = pageSize

  return listRequirements(apiQuery)
}

export async function findRequirement(id: string) {
  return getRequirement(id)
}

export async function fetchRequirementStats() {
  return getRequirementStats()
}

export async function submitRequirement(body: Record<string, unknown>) {
  return createRequirement(body)
}

export async function patchRequirement(id: string, body: Record<string, unknown>) {
  return updateRequirement(id, body)
}

export async function submitDataTask(body: Record<string, unknown>) {
  return createDataTask(body)
}

export async function patchDataTask(id: string, body: Record<string, unknown>) {
  return updateDataTask(id, body)
}

export async function approveOrRejectDataTask(id: string, body: Record<string, unknown>) {
  return signOffDataTask(id, body)
}

// ─────────────────────── Requirement Report (Role-Based) ───────────────────────
//
// 设计与 Overview Dashboard 一致：3 段（Manager / DE / MLE）。
// 数据全部走 platform v1 endpoints（/api/v1/...），不再读 legacy metadata adapter
// 的 /tasks /runs /exports —— 那些只覆盖 metadata.db，与 requirement.db 不通。

type AnyObj = Record<string, unknown>

function asArray(payload: unknown): AnyObj[] {
  if (Array.isArray(payload)) return payload as AnyObj[]
  if (payload && typeof payload === 'object' && Array.isArray((payload as { items?: unknown }).items)) {
    return (payload as { items: AnyObj[] }).items
  }
  return []
}

function num(v: unknown): number {
  return typeof v === 'number' ? v : 0
}

function readMetric(metrics: unknown, key: string): number {
  if (metrics && typeof metrics === 'object') {
    const v = (metrics as Record<string, unknown>)[key]
    if (typeof v === 'number') return v
  }
  return 0
}

export async function buildRequirementReport(id: string) {
  // 单需求 fanout：8 个 v1 endpoint 并发拉
  const [
    requirement,
    dataTasksRes,
    opsTasksRes,
    pipelineRunsRes,
    snapshotsRes,
    exportSnapshotsRes,
    datasetsRes,
    eventsRes,
  ] = await Promise.all([
    getRequirement(id),
    platformFetch(`/api/v1/data-tasks?requirement_id=${encodeURIComponent(id)}&limit=200`).catch(() => ({ items: [] })),
    platformFetch(`/api/v1/operations-tasks?requirement_id=${encodeURIComponent(id)}&page_size=100`).catch(() => []),
    platformFetch(`/api/v1/pipeline-runs?requirement_id=${encodeURIComponent(id)}&page_size=100`).catch(() => []),
    platformFetch(`/api/v1/snapshots?requirement_id=${encodeURIComponent(id)}&limit=50`).catch(() => ({ items: [] })),
    platformFetch(`/api/v1/exports/snapshots?requirement_id=${encodeURIComponent(id)}&limit=50`).catch(() => ({ items: [] })),
    platformFetch(`/api/v1/datasets?requirement_id=${encodeURIComponent(id)}&limit=50`).catch(() => ({ items: [] })),
    platformFetch(`/api/v1/events?requirement_id=${encodeURIComponent(id)}&limit=200`).catch(() => ({ items: [] })),
  ])

  const dataTasks = asArray(dataTasksRes)
  const opsTasks = asArray(opsTasksRes)
  const pipelineRuns = asArray(pipelineRunsRes)
  const snapshots = asArray(snapshotsRes)
  const exportSnapshots = asArray(exportSnapshotsRes)
  const datasets = asArray(datasetsRes)
  const events = asArray(eventsRes)

  // ── Manager 视角：funnel + cost ──
  const dataTaskByType: Record<string, AnyObj[]> = {}
  for (const t of dataTasks) {
    const k = String(t.task_type ?? 'unknown')
    ;(dataTaskByType[k] ||= []).push(t)
  }
  const fundedFunnel = ['collection', 'mining', 'tagging', 'labeling', 'checking', 'release'].map((tt) => {
    const items = dataTaskByType[tt] ?? []
    const target = items.reduce((s, t) => s + num(t.target_count), 0)
    const actual = items.reduce((s, t) => s + num(t.actual_count), 0)
    const completed = items.filter((t) => t.status === 'completed').length
    return {
      task_type: tt,
      task_count: items.length,
      target_count: target,
      actual_count: actual,
      completion_ratio: target > 0 ? Math.min(1, actual / target) : 0,
      completed_task_count: completed,
    }
  })

  const totalCost = pipelineRuns.reduce((s, r) => s + readMetric(r.metrics, 'cost_usd'), 0)
  const totalCpu = pipelineRuns.reduce((s, r) => s + readMetric(r.metrics, 'cpu_seconds'), 0)
  const totalGpu = pipelineRuns.reduce((s, r) => s + readMetric(r.metrics, 'gpu_seconds'), 0)
  const totalDuration = pipelineRuns.reduce((s, r) => s + readMetric(r.metrics, 'duration_s'), 0)
  const totalRowsIn = pipelineRuns.reduce((s, r) => s + readMetric(r.metrics, 'rows_in'), 0)
  const totalRowsOut = pipelineRuns.reduce((s, r) => s + readMetric(r.metrics, 'rows_out'), 0)

  // ── DE 视角：pipeline health + ops by module + snapshot receipts ──
  const runHealth = { running: 0, success: 0, failed: 0, pending: 0 }
  for (const r of pipelineRuns) {
    const s = String(r.status ?? '')
    if (s in runHealth) (runHealth as Record<string, number>)[s] += 1
  }
  const failedTop = pipelineRuns
    .filter((r) => r.status === 'failed')
    .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
    .slice(0, 5)

  const opsByModule: Record<string, AnyObj[]> = {}
  for (const t of opsTasks) {
    const m = String(t.module ?? 'unknown')
    ;(opsByModule[m] ||= []).push(t)
  }

  // ── MLE 视角：1:N datasets + training impact + closed-loop ──
  const datasetSummaries = datasets.map((d) => ({
    id: String(d.id ?? ''),
    name: String(d.name ?? ''),
    dataset_type: String(d.dataset_type ?? ''),
    dataset_version: num(d.dataset_version),
    allow_train: Boolean(d.allow_train),
    status: String(d.status ?? ''),
    created_at: String(d.created_at ?? ''),
  }))
  const customizedCount = datasetSummaries.filter((d) => d.dataset_type === 'customized').length
  const officialCount = datasetSummaries.filter((d) => d.dataset_type === 'official').length

  // 对每个 official dataset 单独查 contributions/rollup（N+1 但 N≤5 OK）
  const officialIds = datasetSummaries.filter((d) => d.dataset_type === 'official').map((d) => d.id)
  const rollupResults = await Promise.all(
    officialIds.map((did) =>
      platformFetch(`/api/v1/exports/contributions/rollup?dataset_id=${encodeURIComponent(did)}`)
        .then((r) => asArray(r)[0] ?? null)
        .catch(() => null),
    ),
  )
  const datasetImpacts = officialIds.map((did, i) => ({
    dataset_id: did,
    rollup: rollupResults[i],
  }))
  type ImpactTotals = {
    consumed_count: number
    train_run_count: number
    snapshot_count: number
    hard_sample_count: number
    sample_count: number
  }
  const trainingImpactTotals: ImpactTotals = rollupResults.reduce<ImpactTotals>(
    (acc, r) => {
      if (!r) return acc
      acc.consumed_count += num(r.consumed_count)
      acc.train_run_count += num(r.train_run_count)
      acc.snapshot_count += num(r.snapshot_count)
      acc.hard_sample_count += num(r.hard_sample_count)
      acc.sample_count += num(r.sample_count)
      return acc
    },
    { consumed_count: 0, train_run_count: 0, snapshot_count: 0, hard_sample_count: 0, sample_count: 0 },
  )

  // Closed-loop：本需求挂的 ops_task 中，payload.parent_trace_id != null 的就是被本需求触发的下一轮回流
  const loopBackTasks = opsTasks.filter((t) => {
    const p = t.payload as Record<string, unknown> | undefined
    return p && typeof p.parent_trace_id === 'string'
  })

  return {
    requirement,
    sections: {
      // Section A · Manager
      manager: {
        funnel: fundedFunnel,
        cost: {
          total_cost_usd: Number(totalCost.toFixed(4)),
          total_cpu_seconds: Number(totalCpu.toFixed(2)),
          total_gpu_seconds: Number(totalGpu.toFixed(2)),
          total_duration_seconds: totalDuration,
          total_rows_in: totalRowsIn,
          total_rows_out: totalRowsOut,
          run_count: pipelineRuns.length,
        },
      },
      // Section B · Data Engineer
      data_engineer: {
        pipeline_health: runHealth,
        failed_top: failedTop,
        ops_by_module: opsByModule,
        snapshots,
      },
      // Section C · Machine Learning Engineer
      mle: {
        datasets: datasetSummaries,
        customized_count: customizedCount,
        official_count: officialCount,
        training_impact_totals: trainingImpactTotals,
        dataset_impacts: datasetImpacts,
        export_snapshots: exportSnapshots,
        loop_back_tasks: loopBackTasks,
      },
    },
    // 顶部 KPI
    headline: {
      data_task_count: dataTasks.length,
      data_task_completed: dataTasks.filter((t) => t.status === 'completed').length,
      ops_task_count: opsTasks.length,
      pipeline_run_count: pipelineRuns.length,
      dataset_count: datasets.length,
      snapshot_count: snapshots.length,
      lineage_event_count: events.length,
    },
  }
}
