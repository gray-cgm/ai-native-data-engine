import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { config } from '../../src/config/index.js'
import { installFetchMock } from '../helpers/fetchMock.js'

import { fetchToolRegistry, fetchToolWorkspaceContext, fetchToolHealth } from '../../src/services/tools.js'
import {
  listPipelineRuns,
  getPipelineRunBreadcrumb,
  getTraceChain,
  getPipelineStageStats,
  getPipelineQualityStats,
  getPipelineCostStats,
  listRecentTraces,
} from '../../src/services/pipelines.js'

let mock: ReturnType<typeof installFetchMock>
const base = config.platformApiBaseUrl

beforeEach(() => {
  mock = installFetchMock()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('tools service', () => {
  it('builds the tool registry with gateway paths for all four tools', async () => {
    const registry = await fetchToolRegistry()
    const ids = registry.items.map((t) => t.id).sort()
    expect(ids).toEqual(['dagster', 'jupyter', 'kafka-ui', 'superset'])
    const dagster = registry.items.find((t) => t.id === 'dagster')!
    expect(dagster.gateway_path).toBe(`${config.apiPrefix}/tools-gateway/dagster/`)
    expect(dagster.base_url).toBe(config.toolBaseUrls.dagster)
  })

  it('assembles workspace context from datasets/versions/workspaces', async () => {
    mock.on('/datasets/d1/versions', { body: { items: [{ version_id: 'v1' }] } })
    mock.on('/datasets', { body: { items: [{ dataset_id: 'd1' }] } })
    mock.on('/workspaces', { body: { items: [{ workspace_id: 'w1' }] } })
    const ctx = await fetchToolWorkspaceContext('superset', { requestId: 'req1', actor: 'alice' })
    expect(ctx).toMatchObject({
      tool_id: 'superset',
      workspace_id: 'w1',
      dataset_id: 'd1',
      dataset_version_id: 'v1',
      request_id: 'req1',
      actor: 'alice',
    })
  })

  it('tolerates upstream failures with null context fields', async () => {
    mock.on('/datasets', { status: 500, body: { detailMessage: 'x' } })
    mock.on('/workspaces', { status: 500, body: { detailMessage: 'x' } })
    const ctx = await fetchToolWorkspaceContext('jupyter')
    expect(ctx.dataset_id).toBeNull()
    expect(ctx.workspace_id).toBeNull()
    expect(ctx.actor).toBe('platform-operator')
  })

  it('rejects an unknown tool id', async () => {
    await expect(fetchToolWorkspaceContext('nope')).rejects.toThrowError(/Unknown tool id/)
  })

  it('fetches tool health by id', async () => {
    mock.on('/tools/dagster/health', { body: { status: 'ok' } })
    await fetchToolHealth('dagster')
    expect(mock.lastCall().url).toBe(`${base}/tools/dagster/health`)
  })
})

describe('pipelines service', () => {
  it('covers run/trace/stat endpoints with query construction', async () => {
    mock.setFallback({ body: {} })

    await listPipelineRuns({ requirement_id: 'r1', empty: '' })
    expect(mock.lastCall().url).toContain('/api/v1/pipeline-runs?requirement_id=r1')
    expect(mock.lastCall().url).not.toContain('empty')

    await listPipelineRuns({})
    expect(mock.lastCall().url).toBe(`${base}/api/v1/pipeline-runs`)

    await getPipelineRunBreadcrumb('run 1')
    expect(mock.lastCall().url).toBe(`${base}/api/v1/pipeline-runs/run%201`)

    await getTraceChain('t/1')
    expect(mock.lastCall().url).toBe(`${base}/api/v1/trace/t%2F1`)

    await getPipelineStageStats()
    expect(mock.lastCall().url).toBe(`${base}/api/v1/pipeline-stats/stages`)

    await getPipelineQualityStats()
    expect(mock.lastCall().url).toBe(`${base}/api/v1/pipeline-stats/quality`)

    await getPipelineCostStats()
    expect(mock.lastCall().url).toBe(`${base}/api/v1/pipeline-stats/cost`)

    await listRecentTraces(25)
    expect(mock.lastCall().url).toBe(`${base}/api/v1/traces?limit=25`)
  })
})
