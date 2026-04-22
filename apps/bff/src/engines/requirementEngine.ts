import type { ExportItem, RunItem, TaskItem } from '../types.js'
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

export async function buildRequirementReport(id: string) {
  const requirement = await getRequirement(id)
  const [tasksRes, runsRes, exportsRes] = await Promise.all([
    platformFetch('/tasks').catch(() => ({ items: [] })),
    platformFetch('/runs').catch(() => ({ items: [] })),
    platformFetch('/exports').catch(() => ({ items: [] })),
  ])

  const allOpsTasks = ((tasksRes as { items?: TaskItem[] }).items ?? []) as TaskItem[]
  const allRuns = ((runsRes as { items?: RunItem[] }).items ?? []) as RunItem[]
  const allExports = ((exportsRes as { items?: ExportItem[] }).items ?? []) as ExportItem[]

  const opsTasks = allOpsTasks.filter((task) => task.requirement_id === id)
  const runItems = allRuns.filter((run) => run.requirement_id === id)

  const runIds = new Set(runItems.map((run) => run.run_id))
  const runExportIds = new Set(
    runItems
      .flatMap((run) => run.derived_assets ?? [])
      .map((asset) => {
        if (asset && typeof asset === 'object' && asset.type === 'export' && typeof asset.id === 'string') {
          return asset.id
        }
        return null
      })
      .filter((value): value is string => Boolean(value)),
  )
  const exportedArtifacts = allExports.filter((item) => runIds.has(item.export_id) || runExportIds.has(item.export_id))

  const totalEstimatedCost = runItems.reduce((sum, run) => sum + (run.estimated_cost ?? 0), 0)
  const totalDurationSeconds = runItems.reduce((sum, run) => sum + (run.duration_seconds ?? 0), 0)
  const totalCpuSeconds = runItems.reduce((sum, run) => sum + (run.cpu_seconds ?? 0), 0)
  const totalGpuSeconds = runItems.reduce((sum, run) => sum + (run.gpu_seconds ?? 0), 0)
  const totalInputBytes = runItems.reduce((sum, run) => sum + (run.input_bytes ?? 0), 0)
  const totalOutputBytes = runItems.reduce((sum, run) => sum + (run.output_bytes ?? 0), 0)

  const dataTasks = requirement.data_tasks ?? []
  const signedOffCount = dataTasks.filter((task) => task.sign_off_status === 'approved').length
  const completedDataTaskCount = dataTasks.filter((task) => task.status === 'completed').length

  const latestRun = [...runItems].sort((a, b) => {
    const tsA = Date.parse(a.created_at ?? '') || 0
    const tsB = Date.parse(b.created_at ?? '') || 0
    return tsB - tsA
  })[0] ?? null

  return {
    requirement,
    result_summary: {
      data_task_count: dataTasks.length,
      data_task_completed_count: completedDataTaskCount,
      data_task_signed_off_count: signedOffCount,
      operations_task_count: opsTasks.length,
      run_count: runItems.length,
      latest_run_status: latestRun?.status ?? null,
      export_count: exportedArtifacts.length,
      total_actual_count: dataTasks.reduce((sum, task) => sum + (task.actual_count ?? 0), 0),
      total_target_count: dataTasks.reduce((sum, task) => sum + (task.target_count ?? 0), 0),
    },
    cost_summary: {
      estimated_cost: Number(totalEstimatedCost.toFixed(4)),
      duration_seconds: totalDurationSeconds,
      cpu_seconds: totalCpuSeconds,
      gpu_seconds: totalGpuSeconds,
      input_bytes: totalInputBytes,
      output_bytes: totalOutputBytes,
    },
    linked_items: {
      operations_tasks: opsTasks,
      runs: runItems,
      exports: exportedArtifacts,
    },
    automation: {
      superset: {
        status: 'planned',
        can_auto_create: true,
        dashboard_name: `requirement-${id}-report`,
      },
      llm_analysis: {
        status: 'planned',
        trigger: 'post-run or on-demand',
      },
    },
  }
}
