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

import * as requirements from './requirements/api'
import * as clips from './explorer/clips-api'
import * as pipelines from './pipelines/api'
import * as exportsApi from './exports/api'

afterEach(() => vi.clearAllMocks())

describe('requirements api', () => {
  it('fetchRequirements builds the full query string', async () => {
    apiGet.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20 })
    await requirements.fetchRequirements({
      status: 'draft', priority: 'high', source: 'feishu', keyword: 'lane', page: 2, pageSize: 50,
    })
    const url = apiGet.mock.calls[0][0] as string
    expect(url).toContain('status=draft')
    expect(url).toContain('priority=high')
    expect(url).toContain('source=feishu')
    expect(url).toContain('keyword=lane')
    expect(url).toContain('page=2')
    expect(url).toContain('pageSize=50')
  })
  it('fetchRequirements omits query when empty', async () => {
    apiGet.mockResolvedValue({ items: [] })
    await requirements.fetchRequirements()
    expect(apiGet).toHaveBeenCalledWith('/requirements')
  })
  it('detail / stats / report hit endpoints', async () => {
    apiGet.mockResolvedValue({})
    await requirements.fetchRequirementDetail('r1')
    expect(apiGet).toHaveBeenCalledWith('/requirements/r1')
    await requirements.fetchRequirementStats()
    expect(apiGet).toHaveBeenCalledWith('/requirements/stats')
    await requirements.fetchRequirementReport('r1')
    expect(apiGet).toHaveBeenCalledWith('/requirements/r1/report')
  })
  it('signOffTask posts approval payload', async () => {
    apiPost.mockResolvedValue({})
    await requirements.signOffTask('t1', true, 'alice', 'lgtm')
    expect(apiPost).toHaveBeenCalledWith('/data-tasks/t1/sign-off', {
      approved: true, sign_off_by: 'alice', comment: 'lgtm',
    })
    await requirements.signOffTask('t2', false, 'bob')
    expect(apiPost).toHaveBeenLastCalledWith('/data-tasks/t2/sign-off', {
      approved: false, sign_off_by: 'bob', comment: null,
    })
  })
})

describe('clips-api', () => {
  it('fetchClips builds optional q query', async () => {
    apiGet.mockResolvedValue({ items: [], pagination: { total: 0, skip: 0, limit: 0 } })
    await clips.fetchClips({ q: 'night rain' })
    expect(apiGet).toHaveBeenCalledWith('/clips?q=night+rain')
    await clips.fetchClips()
    expect(apiGet).toHaveBeenLastCalledWith('/clips')
  })
  it('fetchClipDetail encodes the id', async () => {
    apiGet.mockResolvedValue({})
    await clips.fetchClipDetail('c/1')
    expect(apiGet).toHaveBeenCalledWith('/clips/c%2F1')
  })
  it('fetchClipFrames adds topic/camera/limit/offset', async () => {
    apiGet.mockResolvedValue({ items: [], limit: 10, offset: 0 })
    await clips.fetchClipFrames('c1', { topic: 't', camera: 'cam', limit: 10, offset: 5 })
    const url = apiGet.mock.calls[0][0] as string
    expect(url).toContain('/clips/c1/frames?')
    expect(url).toContain('topic=t')
    expect(url).toContain('camera=cam')
    expect(url).toContain('limit=10')
    expect(url).toContain('offset=5')
  })
  it('fetchStandaloneTopic / fetchAlignedCameraFrames encode segments', async () => {
    apiGet.mockResolvedValue({ items: [] })
    await clips.fetchStandaloneTopic('c1', 'topic a', { limit: 2 })
    expect(apiGet).toHaveBeenCalledWith('/clips/c1/standalone/topic%20a?limit=2')
    await clips.fetchAlignedCameraFrames('c1', 'cam x', { limit: 3 })
    expect(apiGet).toHaveBeenLastCalledWith('/clips/c1/cameras/cam%20x/aligned?limit=3')
  })
  it('buildClipVideoUrl assembles a same-origin proxy url', () => {
    expect(clips.buildClipVideoUrl('c1', 'front')).toBe('/api/clips/c1/cameras/front/video')
  })
})

describe('pipelines api remaining', () => {
  it('fetchPipelineRuns builds query with filters', async () => {
    apiGet.mockResolvedValue({ items: [] })
    await pipelines.fetchPipelineRuns({ status: 'failed', requirement_id: 'r1' } as never)
    const url = apiGet.mock.calls[0][0] as string
    expect(url).toContain('/pipelines/runs?')
    expect(url).toContain('status=failed')
  })
  it('stage / quality / cost stats hit endpoints', async () => {
    apiGet.mockResolvedValue({})
    await pipelines.fetchPipelineStageStats()
    expect(apiGet).toHaveBeenCalledWith('/pipelines/stage-stats')
    await pipelines.fetchQualityStats()
    expect(apiGet).toHaveBeenCalledWith('/pipelines/quality-stats')
    await pipelines.fetchCostStats()
    expect(apiGet).toHaveBeenCalledWith('/pipelines/cost-stats')
  })
  it('fetchStreamingHealth hits endpoint', async () => {
    apiGet.mockResolvedValue({})
    await pipelines.fetchStreamingHealth()
    expect(apiGet).toHaveBeenCalledWith('/pipelines/streaming-health')
  })
})

describe('exports api remaining', () => {
  it('fetchTrainRuns builds query', async () => {
    apiGet.mockResolvedValue({ items: [], total: 0 })
    await exportsApi.fetchTrainRuns({ consumer: 'mle', status: 'running', limit: 10 })
    const url = apiGet.mock.calls[0][0] as string
    expect(url).toContain('/exports/train-runs?')
    expect(url).toContain('consumer=mle')
  })
  it('fetchUsage builds query', async () => {
    apiGet.mockResolvedValue({ items: [], total: 0 })
    await exportsApi.fetchUsage({ train_run_id: 'tr1', limit: 5 } as never)
    const url = apiGet.mock.calls[0][0] as string
    expect(url).toContain('/exports/usage?')
    expect(url).toContain('train_run_id=tr1')
  })
  it('fetchContributions builds query', async () => {
    apiGet.mockResolvedValue({ items: [], total: 0 })
    await exportsApi.fetchContributions({ dataset_id: 'd1', limit: 100 })
    const url = apiGet.mock.calls[0][0] as string
    expect(url).toContain('/exports/contributions?')
    expect(url).toContain('dataset_id=d1')
  })
})
