import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { config } from '../../src/config/index.js'
import { installFetchMock } from '../helpers/fetchMock.js'

import { listAssets, createAsset, getAsset } from '../../src/engines/assetsEngine.js'
import { listEvents, createEvent, getEvent, getDimension } from '../../src/engines/eventsEngine.js'
import {
  listDatasets,
  createDataset,
  getDataset,
  listSamples,
  cutClip,
  addSamples,
  promoteDataset,
} from '../../src/engines/datasetsEngine.js'
import { queryWorkspaces } from '../../src/engines/catalogEngine.js'
import { queryClips, getClipDetail, getClipFrames, getStandaloneTopic, getAlignedCameraFrames, buildUpstreamVideoUrl } from '../../src/engines/clipsEngine.js'
import { queryTasks, queryRuns, queryExports } from '../../src/engines/operationsEngine.js'
import { getDashboardPayload } from '../../src/engines/dashboardEngine.js'
import { triggerDemoBootstrap } from '../../src/engines/bootstrapEngine.js'
import { createDatasetExport } from '../../src/engines/exportEngine.js'
import { triggerStreamingBootstrap, getStreamingSummary, getStreamingHealth } from '../../src/engines/streamingEngine.js'
import {
  listSnapshotsVM,
  getSnapshotVM,
  listTrainRunsVM,
  getTrainRunVM,
  createTrainRunVM,
  patchTrainRunVM,
  listUsageVM,
  listContributionsVM,
  getContributionsRollupVM,
  getContributionVM,
} from '../../src/engines/exportsEngine.js'
import {
  queryRequirements,
  findRequirement,
  fetchRequirementStats,
  submitRequirement,
  patchRequirement,
  submitDataTask,
  patchDataTask,
  approveOrRejectDataTask,
  buildRequirementReport,
} from '../../src/engines/requirementEngine.js'
import {
  assertOpsModule,
  isOpsModule,
  queryOpsItems,
  getOpsItemDetail,
  createOpsItemForModule,
  patchOpsItemForModule,
  deleteOpsItemForModule,
  getOpsVocab,
  getOpsStats,
  getOpsOverview,
  saveLabelingAnnotations,
  loadLabelingAnnotations,
} from '../../src/engines/opsModulesEngine.js'

let mock: ReturnType<typeof installFetchMock>
const base = config.platformApiBaseUrl

beforeEach(() => {
  mock = installFetchMock()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('assetsEngine', () => {
  it('lists with serialized query, dropping empty values', async () => {
    mock.on('/api/v1/assets', { body: { items: [] } })
    await listAssets({ clip_id: 'c1', empty: '', nil: null, n: 3 })
    const url = mock.lastCall().url
    expect(url).toContain(`${base}/api/v1/assets?`)
    expect(url).toContain('clip_id=c1')
    expect(url).toContain('n=3')
    expect(url).not.toContain('empty')
    expect(url).not.toContain('nil')
  })

  it('omits the query string entirely when nothing to send', async () => {
    mock.on('/api/v1/assets', { body: {} })
    await listAssets({})
    expect(mock.lastCall().url).toBe(`${base}/api/v1/assets`)
  })

  it('creates via POST with JSON body', async () => {
    mock.on('/api/v1/assets', { body: { id: 'a1' } }, 'POST')
    await createAsset({ name: 'x' })
    const call = mock.lastCall()
    expect(call.method).toBe('POST')
    expect(call.body).toEqual({ name: 'x' })
  })

  it('encodes asset id in detail path', async () => {
    mock.on('/api/v1/assets/', { body: {} })
    await getAsset('a b/c')
    expect(mock.lastCall().url).toBe(`${base}/api/v1/assets/a%20b%2Fc`)
  })
})

describe('eventsEngine', () => {
  it('lists, creates, gets, and fetches a dimension', async () => {
    mock.on('/api/v1/events/dimensions/', { body: { values: [] } })
    mock.on('/api/v1/events/', { body: { id: 'e1' } })
    mock.on('/api/v1/events', { body: { items: [] } })

    await listEvents({ a: '1' })
    expect(mock.lastCall().url).toContain('/api/v1/events?a=1')

    await createEvent({ k: 'v' })
    expect(mock.lastCall().method).toBe('POST')

    await getEvent('e1')
    expect(mock.lastCall().url).toBe(`${base}/api/v1/events/e1`)

    await getDimension('scene', { limit: 5 })
    expect(mock.lastCall().url).toContain('/api/v1/events/dimensions/scene?limit=5')
  })
})

describe('datasetsEngine', () => {
  it('covers list/create/detail/samples and merges trace headers on cut & promote', async () => {
    mock.setFallback({ body: { ok: true } })
    await listDatasets({ q: 'x' })
    expect(mock.lastCall().url).toContain('/api/v1/datasets?q=x')

    await createDataset({ name: 'd' })
    expect(mock.lastCall().method).toBe('POST')

    await getDataset('d1')
    expect(mock.lastCall().url).toBe(`${base}/api/v1/datasets/d1`)

    await listSamples('d1', { limit: 2 })
    expect(mock.lastCall().url).toContain('/api/v1/datasets/d1/samples?limit=2')

    await cutClip('d1', { range: [0, 1] }, { 'X-Trace-Id': 't1' })
    let call = mock.lastCall()
    expect(call.url).toBe(`${base}/api/v1/datasets/d1/cut`)
    expect(call.headers['x-trace-id']).toBe('t1')
    expect(call.headers['content-type']).toBe('application/json')

    await addSamples('d1', { ids: ['s1'] })
    expect(mock.lastCall().url).toBe(`${base}/api/v1/datasets/d1/samples`)

    await promoteDataset('d1', undefined, { 'X-Trace-Id': 't2' })
    call = mock.lastCall()
    expect(call.body).toEqual({})
    expect(call.headers['x-trace-id']).toBe('t2')
  })
})

describe('catalogEngine', () => {
  it('queries workspaces and applies default name sort', async () => {
    mock.on('/workspaces', {
      body: {
        items: [
          { workspace_id: 'w2', name: 'Zeta' },
          { workspace_id: 'w1', name: 'Alpha' },
        ],
      },
    })
    const result = await queryWorkspaces({})
    expect(result.items.map((w) => w.name)).toEqual(['Alpha', 'Zeta'])
    expect(result.pagination.total).toBe(2)
  })

  it('returns empty list when upstream omits items', async () => {
    mock.on('/workspaces', { body: {} })
    const result = await queryWorkspaces({})
    expect(result.items).toEqual([])
  })
})

describe('clipsEngine', () => {
  it('queries clips with default desc start_time sort and search', async () => {
    mock.on('/clips', {
      body: {
        items: [
          { clip_id: 'c1', start_time: '2024-01-01', city: 'SF' },
          { clip_id: 'c2', start_time: '2024-02-01', city: 'LA' },
        ],
      },
    })
    const result = await queryClips({})
    expect(result.items.map((c) => c.clip_id)).toEqual(['c2', 'c1'])
  })

  it('builds frame, standalone, and aligned URLs with query', async () => {
    mock.setFallback({ body: { items: [] } })
    await getClipDetail('c1')
    expect(mock.lastCall().url).toBe(`${base}/clips/c1`)

    await getClipFrames('c1', { topic: 't', limit: 10, offset: 0 })
    expect(mock.lastCall().url).toContain('/clips/c1/frames?topic=t&limit=10&offset=0')

    await getStandaloneTopic('c1', 'lidar/top', { limit: 5 })
    expect(mock.lastCall().url).toContain('/clips/c1/standalone/lidar%2Ftop?limit=5')

    await getAlignedCameraFrames('c1', 'front cam', { limit: 3 })
    expect(mock.lastCall().url).toContain('/clips/c1/cameras/front%20cam/aligned?limit=3')
  })

  it('builds an upstream video url against the platform base', () => {
    expect(buildUpstreamVideoUrl('c 1', 'cam/a')).toBe(`${base}/clips/c%201/cameras/cam%2Fa/video`)
  })
})

describe('operationsEngine', () => {
  it('filters tasks by status/type/requirement', async () => {
    mock.on('/tasks', {
      body: {
        items: [
          { task_id: 't1', title: 'A', status: 'open', task_type: 'collection', requirement_id: 'r1' },
          { task_id: 't2', title: 'B', status: 'done', task_type: 'mining', requirement_id: 'r2' },
        ],
      },
    })
    const result = await queryTasks({ status: 'open', taskType: 'collection', requirementId: 'r1' })
    expect(result.items.map((t) => t.task_id)).toEqual(['t1'])
  })

  it('filters runs and exports', async () => {
    mock.on('/runs', {
      body: { items: [{ run_id: 'r1', job_name: 'j', status: 'failed', requirement_id: 'q1' }] },
    })
    const runs = await queryRuns({ status: 'failed', requirementId: 'q1' })
    expect(runs.items).toHaveLength(1)

    mock.on('/exports', {
      body: { items: [{ export_id: 'e1', dataset_id: 'd1', format: 'lance', status: 'ready' }] },
    })
    const exports = await queryExports({ datasetId: 'd1', status: 'ready', format: 'lance' })
    expect(exports.items).toHaveLength(1)

    const none = await queryExports({ format: 'parquet' })
    expect(none.items).toHaveLength(0)
  })
})

describe('dashboardEngine', () => {
  it('aggregates a dashboard payload and tolerates a failing endpoint', async () => {
    mock.on('/samples/distribution', { body: { distribution: [{ scene: 's', sample_count: 2 }], scenario: { x: 1 } } })
    mock.on('/datasets/d1', { body: { versions: [{ version_id: 'v1' }] } })
    mock.on('/datasets', { body: { items: [{ dataset_id: 'd1', name: 'D' }] } })
    mock.on('/tasks', { body: { items: [{ task_id: 't1' }] } })
    mock.on('/workspaces', { body: { items: [{ workspace_id: 'w1' }] } })
    mock.on('/exports', { body: { items: [] } })
    mock.on('/samples/search-preview', { body: { rows: [{ id: 'r' }] } })
    mock.on('/runs', { status: 500, body: { detailMessage: 'down' } }) // failing endpoint
    mock.on('/streaming/summary', { body: { summary: { lag: 0 } } })

    const payload = await getDashboardPayload()
    expect(payload.distribution).toHaveLength(1)
    expect(payload.datasets).toHaveLength(1)
    expect(payload.datasetVersions.d1).toEqual([{ version_id: 'v1' }])
    expect(payload.runs).toEqual([]) // failed → fallback
    expect(payload.searchRows).toHaveLength(1)
    expect(payload.streaming).toEqual({ lag: 0 })
  })
})

describe('bootstrap & export & streaming engines', () => {
  it('triggers demo bootstrap via POST', async () => {
    mock.on('/samples/ingest-demo', { body: { ok: true } }, 'POST')
    await triggerDemoBootstrap()
    expect(mock.lastCall().method).toBe('POST')
  })

  it('requests a dataset export with format query', async () => {
    mock.on('/api/v1/exports/datasets/', { body: { export_id: 'e1' } }, 'POST')
    await createDatasetExport('d 1', 'lance')
    expect(mock.lastCall().url).toBe(`${base}/api/v1/exports/datasets/d%201?format=lance`)
  })

  it('triggers streaming bootstrap and reads summary', async () => {
    mock.on('/streaming/bootstrap', { body: { ok: true } }, 'POST')
    await triggerStreamingBootstrap()
    expect(mock.lastCall().method).toBe('POST')

    mock.on('/streaming/summary', { body: { summary: {} } })
    await getStreamingSummary()
    expect(mock.lastCall().url).toBe(`${base}/streaming/summary`)
  })

  it('combines kafka-ui probe and platform health into one viewmodel (healthy)', async () => {
    mock.on('/streaming/health', { body: { consumer: { status: 'healthy' } } })
    mock.on('/actuator/health', { body: { status: 'UP' } })
    const vm = await getStreamingHealth()
    expect(vm.kafka_ui.status).toBe('healthy')
    expect((vm.platform as { consumer: { status: string } }).consumer.status).toBe('healthy')
    expect(vm.checked_at).toBeTruthy()
  })

  it('reports kafka-ui down when probe fails', async () => {
    mock.on('/streaming/health', { status: 500, body: { detailMessage: 'x' } })
    mock.on('/actuator/health', { networkError: true })
    const vm = await getStreamingHealth()
    expect(vm.kafka_ui.status).toBe('down')
    expect((vm.platform as { error: string }).error).toBeTruthy()
  })
})

describe('exportsEngine', () => {
  it('derives consumption_state and a summary for snapshots', async () => {
    mock.on('/api/v1/exports/snapshots', {
      body: {
        total: 2,
        items: [
          { x_trace_id: 'a', consumed_count: 0, train_run_count: 0, last_consumed_at: null, hard_sample_count: 0 },
          { x_trace_id: 'b', consumed_count: 3, train_run_count: 1, last_consumed_at: '2024', hard_sample_count: 1 },
        ],
      },
    })
    const vm = await listSnapshotsVM({ limit: 10 })
    expect(vm.items[0].consumption_state).toBe('fresh')
    expect(vm.items[1].consumption_state).toBe('used')
    expect(vm.summary).toEqual({ total: 2, used: 1, fresh: 1, cold: 0 })
    expect(mock.lastCall().url).toContain('/api/v1/exports/snapshots?limit=10')
  })

  it('passes through the remaining export endpoints', async () => {
    mock.setFallback({ body: { ok: true } })
    await getSnapshotVM('t1')
    expect(mock.lastCall().url).toBe(`${base}/api/v1/exports/snapshots/t1`)

    await listTrainRunsVM({ status: 'running' })
    expect(mock.lastCall().url).toContain('/api/v1/exports/train-runs?status=running')

    await getTrainRunVM('run1')
    expect(mock.lastCall().url).toBe(`${base}/api/v1/exports/train-runs/run1`)

    await createTrainRunVM({ snapshot_ids: ['s1'] })
    expect(mock.lastCall().method).toBe('POST')

    await patchTrainRunVM('run1', { status: 'done' })
    expect(mock.lastCall().method).toBe('PATCH')

    await listUsageVM({ sample_uid: 'u1' })
    expect(mock.lastCall().url).toContain('/api/v1/exports/usage?sample_uid=u1')

    await listContributionsVM({ dataset_id: 'd1' })
    expect(mock.lastCall().url).toContain('/api/v1/exports/contributions?dataset_id=d1')

    await getContributionsRollupVM({ dataset_id: 'd1' })
    expect(mock.lastCall().url).toContain('/api/v1/exports/contributions/rollup?dataset_id=d1')

    await getContributionVM('s 1')
    expect(mock.lastCall().url).toBe(`${base}/api/v1/exports/contributions/s%201`)
  })
})

describe('requirementEngine', () => {
  it('builds the platform list query with paging defaults', async () => {
    mock.on('/api/v1/requirements?', { body: { total: 0, page: 1, page_size: 20, items: [] } })
    await queryRequirements({ status: 'open', priority: 'P0' })
    const url = mock.lastCall().url
    expect(url).toContain('status=open')
    expect(url).toContain('priority=P0')
    expect(url).toContain('page=1')
    expect(url).toContain('page_size=20')
  })

  it('passes through CRUD operations for requirements & data tasks', async () => {
    mock.setFallback({ body: { ok: true } })
    await findRequirement('r1')
    expect(mock.lastCall().url).toBe(`${base}/api/v1/requirements/r1`)

    await fetchRequirementStats()
    expect(mock.lastCall().url).toBe(`${base}/api/v1/requirements/stats`)

    await submitRequirement({ title: 't' })
    expect(mock.lastCall().method).toBe('POST')

    await patchRequirement('r1', { status: 'closed' })
    expect(mock.lastCall().method).toBe('PATCH')

    await submitDataTask({ requirement_id: 'r1' })
    expect(mock.lastCall().url).toBe(`${base}/api/v1/data-tasks`)

    await patchDataTask('dt1', { status: 'done' })
    expect(mock.lastCall().url).toBe(`${base}/api/v1/data-tasks/dt1`)

    await approveOrRejectDataTask('dt1', { decision: 'approve' })
    expect(mock.lastCall().url).toBe(`${base}/api/v1/data-tasks/dt1/sign-off`)
  })

  it('falls back to an empty list when requirements listing errors', async () => {
    mock.on('/api/v1/requirements?', { status: 500, body: { detailMessage: 'down' } })
    const result = (await queryRequirements({})) as { total: number; items: unknown[] }
    expect(result.total).toBe(0)
    expect(result.items).toEqual([])
  })

  it('assembles a 3-section requirement report with fan-out aggregation', async () => {
    mock.on('/api/v1/requirements/r1', { body: { id: 'r1', title: 'Req' } })
    mock.on('/api/v1/data-tasks?', {
      body: {
        items: [
          { task_type: 'collection', target_count: 10, actual_count: 5, status: 'completed' },
          { task_type: 'mining', target_count: 4, actual_count: 4, status: 'in_progress' },
        ],
      },
    })
    mock.on('/api/v1/operations-tasks?', {
      body: [{ module: 'labeling', payload: { parent_trace_id: 'p1' } }],
    })
    mock.on('/api/v1/pipeline-runs?', {
      body: [
        { status: 'success', metrics: { cost_usd: 1.5, cpu_seconds: 10, rows_in: 100, rows_out: 90 } },
        { status: 'failed', created_at: '2024-02-01', metrics: { cost_usd: 0.5 } },
      ],
    })
    mock.on('/api/v1/snapshots?', { body: { items: [{ x_trace_id: 's1' }] } })
    mock.on('/api/v1/exports/snapshots?', { body: { items: [{ id: 'es1' }] } })
    mock.on('/api/v1/datasets?', {
      body: {
        items: [
          { id: 'd1', name: 'Off', dataset_type: 'official' },
          { id: 'd2', name: 'Cust', dataset_type: 'customized' },
        ],
      },
    })
    mock.on('/api/v1/events?', { body: { items: [{ id: 'ev1' }] } })
    mock.on('/api/v1/exports/contributions/rollup?', {
      body: [{ consumed_count: 2, train_run_count: 1, snapshot_count: 1, hard_sample_count: 1, sample_count: 5 }],
    })

    const report = await buildRequirementReport('r1')
    expect(report.requirement).toEqual({ id: 'r1', title: 'Req' })
    expect(report.headline.data_task_count).toBe(2)
    expect(report.headline.dataset_count).toBe(2)
    expect(report.sections.manager.cost.total_cost_usd).toBeCloseTo(2.0)
    expect(report.sections.data_engineer.pipeline_health.failed).toBe(1)
    expect(report.sections.mle.official_count).toBe(1)
    expect(report.sections.mle.customized_count).toBe(1)
    expect(report.sections.mle.training_impact_totals.consumed_count).toBe(2)
    expect(report.sections.mle.loop_back_tasks).toHaveLength(1)
  })
})

describe('opsModulesEngine', () => {
  it('validates module keys', () => {
    expect(isOpsModule('labeling')).toBe(true)
    expect(isOpsModule('nope')).toBe(false)
    expect(assertOpsModule('mining')).toBe('mining')
    expect(() => assertOpsModule('bad')).toThrowError(/Unknown ops module/)
  })

  it('pushes scalar filters down and applies local search/sort', async () => {
    mock.on('/api/v1/ops/labeling?', {
      body: {
        total: 2,
        limit: 50,
        offset: 0,
        items: [
          { id: 'i1', title: 'Older', status: 'draft', updated_at: '2024-01-01', clip_ids: [] },
          { id: 'i2', title: 'Newer', status: 'draft', updated_at: '2024-02-01', clip_ids: [] },
        ],
      },
    })
    const result = await queryOpsItems('labeling', { status: 'draft', datasetId: 'd1' })
    expect(result.items.map((i) => i.id)).toEqual(['i2', 'i1']) // updated_at desc
    const url = mock.lastCall().url
    expect(url).toContain('status=draft')
    expect(url).toContain('dataset_id=d1')
  })

  it('reads detail, stats, overview (decorated with meta)', async () => {
    mock.on('/api/v1/ops/labeling/i1', { body: { id: 'i1', module: 'labeling' } })
    await getOpsItemDetail('labeling', 'i1')
    expect(mock.lastCall().url).toBe(`${base}/api/v1/ops/labeling/i1`)

    mock.on('/api/v1/ops/labeling/stats', { body: { module: 'labeling', counts: {} } })
    await getOpsStats('labeling')
    expect(mock.lastCall().url).toBe(`${base}/api/v1/ops/labeling/stats`)

    mock.on('/api/v1/ops/overview', { body: { modules: [{ module: 'labeling', counts: { draft: 1 } }] } })
    const overview = await getOpsOverview()
    expect(overview.modules[0].label).toBe('Labeling')
    expect(overview.modules[0].accent).toBe('#1677ff')
  })

  it('creates with module defaults and rejects empty title', async () => {
    mock.on('/api/v1/ops/mining', { body: { id: 'm1' } }, 'POST')
    await createOpsItemForModule('mining', { title: '  Hard cases  ' })
    expect(mock.lastCall().body).toMatchObject({
      title: 'Hard cases',
      status: 'queued',
      kind: 'hard_case',
    })
    await expect(createOpsItemForModule('mining', { title: '   ' })).rejects.toThrowError(/title is required/)
  })

  it('patches and deletes an item', async () => {
    mock.on('/api/v1/ops/tagging/t1', { body: { id: 't1' } }, 'PATCH')
    await patchOpsItemForModule('tagging', 't1', { status: 'done' })
    expect(mock.lastCall().method).toBe('PATCH')

    mock.on('/api/v1/ops/tagging/t1', { status: 204, text: '' }, 'DELETE')
    const res = await deleteOpsItemForModule('tagging', 't1')
    expect(res).toEqual({ ok: true, module: 'tagging', id: 't1' })
  })

  it('caches vocab for repeated reads within the TTL', async () => {
    let hits = 0
    mock.on('/api/v1/ops/checking/vocab', () => {
      hits += 1
      return { body: { module: 'checking', status_options: ['draft'], kind_options: ['gating'] } }
    })
    const first = await getOpsVocab('checking')
    const second = await getOpsVocab('checking')
    expect(first).toEqual(second)
    expect(hits).toBe(1) // second served from cache
  })

  it('saves and loads labeling annotations with validation', async () => {
    mock.on('/api/v1/ops/labeling/annotations', { body: { ok: true } }, 'POST')
    await saveLabelingAnnotations({ clip_id: 'c1', annotations: [] })
    expect(mock.lastCall().method).toBe('POST')
    await expect(saveLabelingAnnotations({ clip_id: '', annotations: [] })).rejects.toThrowError(/clip_id is required/)

    mock.on('/api/v1/ops/labeling/annotations?', { body: { items: [] } }, 'GET')
    await loadLabelingAnnotations('c1', 'trace-1')
    const url = mock.lastCall().url
    expect(url).toContain('clip_id=c1')
    expect(url).toContain('x_trace_id=trace-1')
  })
})
