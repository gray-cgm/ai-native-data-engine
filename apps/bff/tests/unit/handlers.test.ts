import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { config } from '../../src/config/index.js'
import { installFetchMock } from '../helpers/fetchMock.js'

import assetsHandler from '../../src/handlers/assetsHandler.js'
import bootstrapHandler from '../../src/handlers/bootstrapHandler.js'
import catalogHandler from '../../src/handlers/catalogHandler.js'
import clipsHandler from '../../src/handlers/clipsHandler.js'
import dashboardHandler from '../../src/handlers/dashboardHandler.js'
import dataTasksHandler from '../../src/handlers/dataTasksHandler.js'
import datasetsHandler from '../../src/handlers/datasetsHandler.js'
import eventsHandler from '../../src/handlers/eventsHandler.js'
import exportHandler from '../../src/handlers/exportHandler.js'
import exportsHandler from '../../src/handlers/exportsHandler.js'
import operationsHandler from '../../src/handlers/operationsHandler.js'
import opsModulesHandler from '../../src/handlers/opsModulesHandler.js'
import pipelinesHandler from '../../src/handlers/pipelinesHandler.js'
import requirementHandler from '../../src/handlers/requirementHandler.js'
import streamingHandler from '../../src/handlers/streamingHandler.js'
import toolsHandler from '../../src/handlers/toolsHandler.js'

let mock: ReturnType<typeof installFetchMock>
const base = config.platformApiBaseUrl

beforeEach(() => {
  mock = installFetchMock()
  mock.setFallback({ body: { ok: true } })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

type CtxOpts = {
  query?: Record<string, unknown>
  body?: unknown
  params?: Record<string, string>
  headers?: Record<string, string>
  state?: Record<string, unknown>
}

function ctx(opts: CtxOpts = {}) {
  const headers = opts.headers ?? {}
  const c = {
    params: opts.params ?? {},
    state: opts.state ?? {},
    status: 200,
    body: undefined as unknown,
    request: {
      query: opts.query ?? {},
      body: opts.body,
      header: headers,
      params: opts.params ?? {},
    },
    _setHeaders: {} as Record<string, string>,
    get(name: string) {
      return headers[name.toLowerCase()] ?? ''
    },
    set(name: string, value: string) {
      ;(this as unknown as { _setHeaders: Record<string, string> })._setHeaders[name.toLowerCase()] = value
    },
    throw(code: number, message?: string) {
      const err = new Error(message ?? 'error') as Error & { status: number }
      err.status = code
      throw err
    },
  }
  return c as unknown as import('koa').Context
}

describe('assetsHandler', () => {
  it('list / create / detail', async () => {
    const list = ctx({ query: { clip_id: 'c1' } })
    await assetsHandler.list(list)
    expect(mock.lastCall().url).toContain('/api/v1/assets?clip_id=c1')

    const create = ctx({ body: { name: 'x' } })
    await assetsHandler.create(create)
    expect(mock.lastCall().method).toBe('POST')

    const detail = ctx({ params: { assetId: 'a1' } })
    await assetsHandler.detail(detail)
    expect(mock.lastCall().url).toBe(`${base}/api/v1/assets/a1`)
  })
})

describe('catalog / bootstrap / dashboard handlers', () => {
  it('catalog lists workspaces', async () => {
    mock.on('/workspaces', { body: { items: [] } })
    const c = ctx()
    await catalogHandler.listWorkspaces(c)
    expect(c.body).toMatchObject({ items: [] })
  })

  it('bootstrap triggers demo', async () => {
    const c = ctx()
    await bootstrapHandler.create(c)
    expect(mock.lastCall().url).toBe(`${base}/samples/ingest-demo`)
  })

  it('dashboard aggregates payload', async () => {
    mock.setFallback({ body: { items: [], distribution: [], rows: [], summary: null } })
    const c = ctx()
    await dashboardHandler.get(c)
    expect(c.body).toHaveProperty('datasets')
  })
})

describe('datasetsHandler', () => {
  it('list/create/detail/listSamples/addSamples', async () => {
    const c1 = ctx({ query: { q: 'x' } })
    await datasetsHandler.list(c1)
    expect(mock.lastCall().url).toContain('/api/v1/datasets?q=x')

    await datasetsHandler.create(ctx({ body: { name: 'd' } }))
    expect(mock.lastCall().method).toBe('POST')

    await datasetsHandler.detail(ctx({ params: { datasetId: 'd1' } }))
    expect(mock.lastCall().url).toBe(`${base}/api/v1/datasets/d1`)

    await datasetsHandler.listSamples(ctx({ params: { datasetId: 'd1' }, query: { limit: 2 } }))
    expect(mock.lastCall().url).toContain('/api/v1/datasets/d1/samples?limit=2')

    await datasetsHandler.addSamples(ctx({ params: { datasetId: 'd1' }, body: { ids: ['s1'] } }))
    expect(mock.lastCall().url).toBe(`${base}/api/v1/datasets/d1/samples`)
  })

  it('cut & promote forward the x-trace-id header', async () => {
    await datasetsHandler.cut(
      ctx({ params: { datasetId: 'd1' }, body: { range: [0, 1] }, headers: { 'x-trace-id': 't1' } }),
    )
    expect(mock.lastCall().headers['x-trace-id']).toBe('t1')

    await datasetsHandler.promote(
      ctx({ params: { datasetId: 'd1' }, body: {}, headers: { 'x-trace-id': 't2' } }),
    )
    expect(mock.lastCall().headers['x-trace-id']).toBe('t2')
  })
})

describe('eventsHandler', () => {
  it('list/create/detail/dimension', async () => {
    await eventsHandler.list(ctx({ query: { a: '1' } }))
    expect(mock.lastCall().url).toContain('/api/v1/events?a=1')

    await eventsHandler.create(ctx({ body: { k: 'v' } }))
    expect(mock.lastCall().method).toBe('POST')

    await eventsHandler.detail(ctx({ params: { eventPk: 'e1' } }))
    expect(mock.lastCall().url).toBe(`${base}/api/v1/events/e1`)

    await eventsHandler.dimension(ctx({ params: { dimension: 'scene' }, query: { limit: 5 } }))
    expect(mock.lastCall().url).toContain('/api/v1/events/dimensions/scene?limit=5')
  })
})

describe('dataTasksHandler', () => {
  it('get a data task by id', async () => {
    await dataTasksHandler.get(ctx({ params: { id: 'dt 1' } }))
    expect(mock.lastCall().url).toBe(`${base}/api/v1/data-tasks/dt%201`)
  })

  it('lists operations-tasks filtering allowed query keys', async () => {
    mock.on('/api/v1/operations-tasks', { body: [{ id: 'o1' }] })
    const c = ctx({ query: { requirement_id: 'r1', module: 'labeling', bogus: 'drop-me' } })
    await dataTasksHandler.listOperationsTasks(c)
    const url = mock.lastCall().url
    expect(url).toContain('requirement_id=r1')
    expect(url).toContain('module=labeling')
    expect(url).not.toContain('bogus')
    expect(c.body).toMatchObject({ items: [{ id: 'o1' }] })
  })
})

describe('exportHandler', () => {
  it('defaults the export format to lance', async () => {
    await exportHandler.createDatasetExport(ctx({ params: { datasetId: 'd1' }, body: {} }))
    expect(mock.lastCall().url).toBe(`${base}/api/v1/exports/datasets/d1?format=lance`)
  })

  it('honours an explicit format', async () => {
    await exportHandler.createDatasetExport(ctx({ params: { datasetId: 'd1' }, body: { format: 'parquet' } }))
    expect(mock.lastCall().url).toContain('format=parquet')
  })
})

describe('exportsHandler', () => {
  it('covers snapshots/train-runs/contributions/usage flows', async () => {
    mock.on('/api/v1/exports/snapshots', { body: { total: 0, items: [] } })
    const snaps = ctx({ query: { limit: '5', scenario: 's' } })
    await exportsHandler.listSnapshots(snaps)
    expect((snaps.body as { summary: unknown }).summary).toBeTruthy()

    await exportsHandler.getSnapshot(ctx({ params: { traceId: 't1' } }))
    expect(mock.lastCall().url).toBe(`${base}/api/v1/exports/snapshots/t1`)

    await exportsHandler.listTrainRuns(ctx({ query: { status: 'running' } }))
    expect(mock.lastCall().url).toContain('train-runs?status=running')

    await exportsHandler.getTrainRun(ctx({ params: { runId: 'run1' } }))
    expect(mock.lastCall().url).toBe(`${base}/api/v1/exports/train-runs/run1`)

    const created = ctx({ body: { snapshot_ids: ['s1'] } })
    await exportsHandler.createTrainRun(created)
    expect(created.status).toBe(201)

    await exportsHandler.patchTrainRun(ctx({ params: { runId: 'run1' }, body: { status: 'done' } }))
    expect(mock.lastCall().method).toBe('PATCH')

    await exportsHandler.listContributions(ctx({ query: { dataset_id: 'd1' } }))
    expect(mock.lastCall().url).toContain('contributions?dataset_id=d1')

    await exportsHandler.getContributionsRollup(ctx({ query: { dataset_id: 'd1' } }))
    expect(mock.lastCall().url).toContain('contributions/rollup?dataset_id=d1')

    await exportsHandler.getContribution(ctx({ params: { sampleUid: 'u1' } }))
    expect(mock.lastCall().url).toBe(`${base}/api/v1/exports/contributions/u1`)

    await exportsHandler.listUsage(ctx({ query: { sample_uid: 'u1' } }))
    expect(mock.lastCall().url).toContain('usage?sample_uid=u1')
  })

  it('rejects createTrainRun without snapshot_ids', async () => {
    await expect(exportsHandler.createTrainRun(ctx({ body: {} }))).rejects.toThrowError()
  })
})

describe('operationsHandler', () => {
  it('lists tasks/runs/exports', async () => {
    mock.on('/tasks', { body: { items: [] } })
    mock.on('/runs', { body: { items: [] } })
    mock.on('/exports', { body: { items: [] } })
    await operationsHandler.listTasks(ctx())
    await operationsHandler.listRuns(ctx())
    await operationsHandler.listExports(ctx())
    expect(mock.calls.some((c) => c.url.includes('/exports'))).toBe(true)
  })
})

describe('opsModulesHandler', () => {
  it('list/detail/create/patch/remove/vocab/stats/overview/annotations', async () => {
    mock.on('/api/v1/ops/labeling?', { body: { items: [], total: 0, limit: 50, offset: 0 } })
    mock.on('/api/v1/ops/overview', { body: { modules: [] } })
    mock.on('/api/v1/ops/labeling/vocab', { body: { module: 'labeling', status_options: [], kind_options: [] } })
    mock.on('/api/v1/ops/labeling/stats', { body: { module: 'labeling', counts: {} } })
    mock.on('/api/v1/ops/labeling/annotations', { body: { ok: true } })

    await opsModulesHandler.list(ctx({ params: { module: 'labeling' }, query: {} }))
    await opsModulesHandler.overview(ctx())
    await opsModulesHandler.vocab(ctx({ params: { module: 'labeling' } }))
    await opsModulesHandler.stats(ctx({ params: { module: 'labeling' } }))

    mock.on('/api/v1/ops/labeling/i1', { body: { id: 'i1' } })
    await opsModulesHandler.detail(ctx({ params: { module: 'labeling', id: 'i1' } }))

    const created = ctx({ params: { module: 'mining' }, body: { title: 'X' } })
    mock.on('/api/v1/ops/mining', { body: { id: 'm1' } }, 'POST')
    await opsModulesHandler.create(created)
    expect(created.status).toBe(201)

    mock.on('/api/v1/ops/labeling/i1', { body: { id: 'i1' } }, 'PATCH')
    await opsModulesHandler.patch(ctx({ params: { module: 'labeling', id: 'i1' }, body: { status: 'done' } }))

    mock.on('/api/v1/ops/labeling/i1', { status: 204, text: '' }, 'DELETE')
    await opsModulesHandler.remove(ctx({ params: { module: 'labeling', id: 'i1' } }))

    await opsModulesHandler.saveAnnotations(ctx({ body: { clip_id: 'c1', annotations: [] } }))
    await opsModulesHandler.loadAnnotations(ctx({ query: { clip_id: 'c1', x_trace_id: 't1' } }))
    expect(mock.calls.some((c) => c.url.includes('/annotations'))).toBe(true)
  })
})

describe('pipelinesHandler', () => {
  it('covers runs/run/trace/stage/quality/cost/traces/streamingHealth', async () => {
    mock.on('/api/v1/pipeline-runs/run1', { body: { run: {} } })
    mock.on('/api/v1/pipeline-runs', { body: [] })
    mock.on('/api/v1/trace/t1', { body: { x_trace_id: 't1' } })
    mock.on('/api/v1/pipeline-stats/stages', { body: {} })
    mock.on('/api/v1/pipeline-stats/quality', { body: {} })
    mock.on('/api/v1/pipeline-stats/cost', { body: {} })
    mock.on('/api/v1/traces', { body: { items: [] } })
    mock.on('/streaming/health', { body: {} })
    mock.on('/actuator/health', { body: { status: 'UP' } })

    const runs = ctx({ query: { requirement_id: 'r1', drop: 'x' } })
    await pipelinesHandler.listRuns(runs)
    expect((runs.body as { items: unknown }).items).toBeDefined()
    expect(mock.lastCall().url).not.toContain('drop')

    await pipelinesHandler.getRun(ctx({ params: { id: 'run1' } }))
    await pipelinesHandler.getTrace(ctx({ params: { traceId: 't1' } }))
    await pipelinesHandler.stageStats(ctx())
    await pipelinesHandler.qualityStats(ctx())
    await pipelinesHandler.costStats(ctx())
    await pipelinesHandler.listTraces(ctx({ query: { limit: '5' } }))
    await pipelinesHandler.streamingHealth(ctx())
    expect(mock.calls.some((c) => c.url.includes('/api/v1/traces?limit=5'))).toBe(true)
  })

  it('clamps the traces limit', async () => {
    mock.on('/api/v1/traces', { body: { items: [] } })
    await pipelinesHandler.listTraces(ctx({ query: { limit: '99999' } }))
    expect(mock.lastCall().url).toContain('limit=200')
  })
})

describe('requirementHandler', () => {
  it('covers list/get/stats/create/update/createTask/updateTask/signOff/report', async () => {
    mock.on('/api/v1/requirements?', { body: { total: 0, items: [] } })
    mock.on('/api/v1/requirements/stats', { body: { total: 0, by_status: {}, by_priority: {}, by_source: {} } })
    mock.on('/api/v1/requirements/r1', { body: { id: 'r1' } })

    await requirementHandler.list(ctx({ query: {} }))
    await requirementHandler.get(ctx({ params: { id: 'r1' } }))
    await requirementHandler.stats(ctx())

    const created = ctx({ body: { title: 't' } })
    mock.on('/api/v1/requirements', { body: { id: 'r2' } }, 'POST')
    await requirementHandler.create(created)
    expect(created.status).toBe(201)

    await requirementHandler.update(ctx({ params: { id: 'r1' }, body: { status: 'closed' } }))

    const task = ctx({ params: { id: 'r1' }, body: {} })
    mock.on('/api/v1/data-tasks', { body: { id: 'dt1' } }, 'POST')
    await requirementHandler.createTask(task)
    expect(task.status).toBe(201)
    expect((task.request.body as { requirement_id: string }).requirement_id).toBe('r1')

    await requirementHandler.updateTask(ctx({ params: { id: 'dt1' }, body: { status: 'done' } }))
    await requirementHandler.signOffTask(ctx({ params: { id: 'dt1' }, body: { decision: 'approve' } }))

    // report fan-out: fallback covers the parallel calls
    await requirementHandler.report(ctx({ params: { id: 'r1' } }))
    expect(mock.calls.some((c) => c.url.includes('/api/v1/requirements/r1'))).toBe(true)
  })
})

describe('streamingHandler', () => {
  it('create + getSummary', async () => {
    mock.on('/streaming/bootstrap', { body: { ok: true } }, 'POST')
    mock.on('/streaming/summary', { body: { summary: {} } })
    await streamingHandler.create(ctx())
    await streamingHandler.getSummary(ctx())
    expect(mock.calls.some((c) => c.url.includes('/streaming/summary'))).toBe(true)
  })
})

describe('toolsHandler', () => {
  it('registry / workspace-context / health', async () => {
    const reg = ctx()
    await toolsHandler.getRegistry(reg)
    expect((reg.body as { items: unknown[] }).items).toHaveLength(4)

    mock.on('/datasets', { body: { items: [] } })
    mock.on('/workspaces', { body: { items: [] } })
    const wc = ctx({ params: { toolId: 'superset' }, headers: { 'x-actor-id': 'alice' }, state: { requestId: 'req1' } })
    await toolsHandler.getWorkspaceContext(wc)
    expect((wc.body as { actor: string }).actor).toBe('alice')

    mock.on('/tools/dagster/health', { body: { status: 'ok' } })
    await toolsHandler.getHealth(ctx({ params: { toolId: 'dagster' } }))
    expect(mock.lastCall().url).toBe(`${base}/tools/dagster/health`)
  })
})

describe('clipsHandler', () => {
  it('list/detail/frames/standaloneTopic/aligned', async () => {
    mock.on('/clips', { body: { items: [] } })
    await clipsHandler.list(ctx({ query: {} }))

    mock.on('/clips/c1/frames', { body: { items: [] } })
    mock.on('/clips/c1/standalone/', { body: { items: [] } })
    mock.on('/clips/c1/cameras/', { body: { items: [] } })
    mock.on('/clips/c1', { body: { clip_id: 'c1' } })

    await clipsHandler.detail(ctx({ params: { clipId: 'c1' } }))
    await clipsHandler.frames(ctx({ params: { clipId: 'c1' }, query: { topic: 't', limit: '5', offset: '0' } }))
    await clipsHandler.standaloneTopic(ctx({ params: { clipId: 'c1', name: 'lidar' }, query: { limit: '5' } }))
    await clipsHandler.aligned(ctx({ params: { clipId: 'c1', camera: 'front' }, query: { limit: '3' } }))
    expect(mock.calls.some((c) => c.url.includes('/aligned'))).toBe(true)
  })

  it('video streams the upstream response and forwards range', async () => {
    mock.on('/clips/c1/cameras/front/video', {
      status: 206,
      text: 'bytes',
      headers: { 'content-type': 'video/mp4', 'accept-ranges': 'bytes', 'content-range': 'bytes 0-4/10' },
    })
    const c = ctx({ params: { clipId: 'c1', camera: 'front' }, headers: { range: 'bytes=0-4' } })
    await clipsHandler.video(c)
    expect(c.status).toBe(206)
    expect(c.state.skipResponseEnvelope).toBe(true)
    // range header was forwarded upstream
    expect(mock.lastCall().headers.range).toBe('bytes=0-4')
  })
})
