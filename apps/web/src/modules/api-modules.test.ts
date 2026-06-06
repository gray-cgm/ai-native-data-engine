import { afterEach, describe, expect, it, vi } from 'vitest'

const apiGet = vi.fn()
const apiPost = vi.fn()
const apiPatch = vi.fn()
const apiDelete = vi.fn()

vi.mock('@/shared/api/client', () => ({
  apiGet: (...a: unknown[]) => apiGet(...a),
  apiPost: (...a: unknown[]) => apiPost(...a),
  apiPatch: (...a: unknown[]) => apiPatch(...a),
  apiDelete: (...a: unknown[]) => apiDelete(...a),
}))

import * as overview from './overview/api'
import * as explorer from './explorer/api'
import * as exportsApi from './exports/api'
import * as pipelines from './pipelines/api'
import * as ops from './operations/api'
import { fetchToolsRegistry } from './tools/api/tools'

afterEach(() => {
  vi.clearAllMocks()
})

describe('overview api query-string building', () => {
  it('fetchRequirementStats hits /requirements/stats', async () => {
    apiGet.mockResolvedValue({ total: 0 })
    await overview.fetchRequirementStats()
    expect(apiGet).toHaveBeenCalledWith('/requirements/stats')
  })

  it('fetchRequirementList drops empty filters', async () => {
    apiGet.mockResolvedValue({ items: [], total: 0 })
    await overview.fetchRequirementList({ status: 'draft', priority: '', limit: 5 })
    expect(apiGet).toHaveBeenCalledWith('/requirements?status=draft&limit=5')
  })

  it('fetchRequirementList with no filters omits query', async () => {
    apiGet.mockResolvedValue({ items: [], total: 0 })
    await overview.fetchRequirementList()
    expect(apiGet).toHaveBeenCalledWith('/requirements')
  })

  it('fetchPipelineRuns normalizes bare array', async () => {
    apiGet.mockResolvedValue([{ id: '1' }, { id: '2' }])
    const r = await overview.fetchPipelineRuns({ status: 'running' })
    expect(apiGet).toHaveBeenCalledWith('/pipelines/runs?status=running')
    expect(r).toEqual({ items: [{ id: '1' }, { id: '2' }], total: 2 })
  })

  it('fetchPipelineRuns normalizes {items,total} object', async () => {
    apiGet.mockResolvedValue({ items: [{ id: '1' }] })
    const r = await overview.fetchPipelineRuns()
    expect(r).toEqual({ items: [{ id: '1' }], total: 1 })
  })

  it('fetchDatasets builds dataset_type query', async () => {
    apiGet.mockResolvedValue({ items: [], total: 0 })
    await overview.fetchDatasets({ dataset_type: 'official', limit: 10 })
    expect(apiGet).toHaveBeenCalledWith('/datasets?dataset_type=official&limit=10')
  })

  it('fetchSnapshotsSummary prefers summary, else derives', async () => {
    apiGet.mockResolvedValueOnce({ summary: { total: 3, used: 1, fresh: 2, cold: 0 }, total: 3, items: [] })
    expect(await overview.fetchSnapshotsSummary()).toEqual({ total: 3, used: 1, fresh: 2, cold: 0 })

    apiGet.mockResolvedValueOnce({ total: 7, items: [] })
    expect(await overview.fetchSnapshotsSummary()).toEqual({ total: 7, used: 0, fresh: 0, cold: 0 })
  })

  it('thin fetchers hit their endpoints', async () => {
    apiGet.mockResolvedValue({})
    await overview.fetchPipelineCostStats()
    await overview.fetchOpsOverview()
    await overview.fetchScenarios()
    await overview.fetchToolsRegistry()
    expect(apiGet).toHaveBeenCalledWith('/pipelines/cost-stats')
    expect(apiGet).toHaveBeenCalledWith('/ops/overview')
    expect(apiGet).toHaveBeenCalledWith('/clips/scenarios')
    expect(apiGet).toHaveBeenCalledWith('/tools/registry')
  })
})

describe('explorer api', () => {
  it('derives distribution / searchRows from dashboard', async () => {
    apiGet.mockResolvedValue({
      distribution: [{ scene: 's', sample_count: 1 }],
      searchRows: [{ id: 'x', scene: 's' }],
    })
    expect(await explorer.fetchDistribution()).toEqual([{ scene: 's', sample_count: 1 }])
    apiGet.mockResolvedValue({ distribution: [], searchRows: [{ id: 'y', scene: 't' }] })
    expect(await explorer.fetchSearchRows()).toEqual([{ id: 'y', scene: 't' }])
  })
})

describe('exports api', () => {
  it('fetchSnapshots builds query and drops empties', async () => {
    apiGet.mockResolvedValue({ items: [], total: 0 })
    await exportsApi.fetchSnapshots({ dataset_id: 'd1', limit: 50 } as never)
    const call = apiGet.mock.calls[0][0] as string
    expect(call.startsWith('/exports/snapshots?')).toBe(true)
    expect(call).toContain('dataset_id=d1')
  })

  it('fetchSnapshotDetail / fetchContribution encode ids', async () => {
    apiGet.mockResolvedValue({})
    await exportsApi.fetchSnapshotDetail('trace/1')
    expect(apiGet).toHaveBeenCalledWith('/exports/snapshots/trace%2F1')
    await exportsApi.fetchContribution('s u')
    expect(apiGet).toHaveBeenCalledWith('/exports/contributions/s%20u')
  })

  it('createTrainRun / patchTrainRun post and patch', async () => {
    apiPost.mockResolvedValue({})
    apiPatch.mockResolvedValue({})
    await exportsApi.createTrainRun({ dataset_id: 'd' } as never)
    expect(apiPost).toHaveBeenCalledWith('/exports/train-runs', { dataset_id: 'd' })
    await exportsApi.patchTrainRun('r1', { status: 'done' } as never)
    expect(apiPatch).toHaveBeenCalledWith('/exports/train-runs/r1', { status: 'done' })
  })

  it('fetchContributionsRollup builds query', async () => {
    apiGet.mockResolvedValue({ items: [], total: 0 })
    await exportsApi.fetchContributionsRollup({ dataset_id: 'd9' })
    expect(apiGet).toHaveBeenCalledWith('/exports/contributions/rollup?dataset_id=d9')
  })
})

describe('pipelines api', () => {
  it('fetchRuns reads dashboard.items', async () => {
    apiGet.mockResolvedValue({ items: [{ run_id: 'r' }] })
    expect(await pipelines.fetchRuns()).toEqual([{ run_id: 'r' }])
  })
  it('fetchPipelineRuns returns items array or empty', async () => {
    apiGet.mockResolvedValue({ items: undefined })
    expect(await pipelines.fetchPipelineRuns()).toEqual([])
  })
  it('fetchRunBreadcrumb / fetchTraceChain encode ids', async () => {
    apiGet.mockResolvedValue({})
    await pipelines.fetchRunBreadcrumb('run 1')
    expect(apiGet).toHaveBeenCalledWith('/pipelines/runs/run%201')
    await pipelines.fetchTraceChain('t/2')
    expect(apiGet).toHaveBeenCalledWith('/pipelines/trace/t%2F2')
  })
  it('fetchRecentTraces returns items', async () => {
    apiGet.mockResolvedValue({ items: [{ x_trace_id: 'a' }] })
    expect(await pipelines.fetchRecentTraces(5)).toEqual([{ x_trace_id: 'a' }])
    apiGet.mockResolvedValue({})
    expect(await pipelines.fetchRecentTraces()).toEqual([])
  })
})

describe('operations api', () => {
  it('fetchTasks / fetchExports read dashboard slices', async () => {
    apiGet.mockResolvedValue({ tasks: [{ task_id: 't' }], exports: [{ export_id: 'e' }] })
    expect(await ops.fetchTasks()).toEqual([{ task_id: 't' }])
    apiGet.mockResolvedValue({ tasks: [], exports: [{ export_id: 'e2' }] })
    expect(await ops.fetchExports()).toEqual([{ export_id: 'e2' }])
  })
  it('triggerExport posts to dataset exports', async () => {
    apiPost.mockResolvedValue({})
    await ops.triggerExport('d42')
    expect(apiPost).toHaveBeenCalledWith('/datasets/d42/exports')
  })
})

describe('tools registry transformer', () => {
  it('maps snake_case payload to ToolDescriptor + infers icon/links', async () => {
    apiGet.mockResolvedValue({
      items: [
        {
          id: 'dagster',
          name: 'Dagster',
          short_name: 'DG',
          category: 'orchestration',
          summary: 's',
          description: 'd',
          integration_mode: 'direct-iframe',
          base_url: 'http://x',
          gateway_path: '/gw',
          health_path: '/h',
          workspace_path: '/tools/dagster',
          capabilities: [],
          use_cases: [],
        },
        {
          id: 'custom',
          name: 'Custom',
          short_name: 'CT',
          category: 'analytics',
          summary: 's',
          description: 'd',
          integration_mode: 'proxy-iframe',
          base_url: 'http://y',
          gateway_path: '/gw2',
          health_path: '/h2',
          workspace_path: '/tools/custom',
          capabilities: [],
          use_cases: [],
        },
      ],
    })
    const tools = await fetchToolsRegistry()
    const dagster = tools.find((t) => t.id === 'dagster')!
    expect(dagster.icon).toBe('DR')
    expect(dagster.showLiveRuns).toBe(true)
    expect(dagster.route).toEqual({ path: '/tools/dagster', label: 'DG' })
    expect(dagster.quickLinks?.length).toBeGreaterThan(0)

    const custom = tools.find((t) => t.id === 'custom')!
    expect(custom.icon).toBe('TL')
    expect(custom.showLiveRuns).toBe(false)
    expect(custom.quickLinks).toEqual([])
    expect(custom.notes).toEqual([])
  })
})
