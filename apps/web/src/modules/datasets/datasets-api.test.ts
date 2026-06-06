import { afterEach, describe, expect, it, vi } from 'vitest'

const apiGet = vi.fn()
const apiPost = vi.fn()
vi.mock('@/shared/api/client', () => ({
  apiGet: (...a: unknown[]) => apiGet(...a),
  apiPost: (...a: unknown[]) => apiPost(...a),
}))

import {
  createDataset,
  flexibleCut,
  getDataset,
  listDatasets,
  listSamples,
  promoteDataset,
} from './datasets-api'

afterEach(() => vi.clearAllMocks())

describe('datasets-api', () => {
  it('listDatasets builds query, dropping nullish/empty', async () => {
    apiGet.mockResolvedValue({ items: [], total: 0 })
    await listDatasets({ status: 'active', dataset_type: 'official', limit: 200, missing: undefined, blank: '' })
    const url = apiGet.mock.calls[0][0] as string
    expect(url).toContain('/datasets?')
    expect(url).toContain('status=active')
    expect(url).toContain('dataset_type=official')
    expect(url).toContain('limit=200')
    expect(url).not.toContain('missing')
    expect(url).not.toContain('blank')
  })

  it('listDatasets omits query when empty', async () => {
    apiGet.mockResolvedValue({ items: [], total: 0 })
    await listDatasets()
    expect(apiGet).toHaveBeenCalledWith('/datasets')
  })

  it('createDataset posts the body', async () => {
    apiPost.mockResolvedValue({})
    const body = { name: 'd', dataset_type: 'official' as const, source_type: 'tags' as const }
    await createDataset(body)
    expect(apiPost).toHaveBeenCalledWith('/datasets', body)
  })

  it('getDataset encodes the id', async () => {
    apiGet.mockResolvedValue({})
    await getDataset('ds/1')
    expect(apiGet).toHaveBeenCalledWith('/datasets/ds%2F1')
  })

  it('flexibleCut posts to the cut endpoint', async () => {
    apiPost.mockResolvedValue({})
    await flexibleCut('ds1', { clip_id: 'c1', ts_start: 1, ts_end: 2 })
    expect(apiPost).toHaveBeenCalledWith('/datasets/ds1/cut', { clip_id: 'c1', ts_start: 1, ts_end: 2 })
  })

  it('listSamples builds query', async () => {
    apiGet.mockResolvedValue({ items: [], total: 0, limit: 10, offset: 0 })
    await listSamples('ds1', { clip_id: 'c1', training_type: 'train', limit: 10, offset: 0 })
    const url = apiGet.mock.calls[0][0] as string
    expect(url).toContain('/datasets/ds1/samples?')
    expect(url).toContain('clip_id=c1')
    expect(url).toContain('training_type=train')
  })

  it('listSamples omits empty query', async () => {
    apiGet.mockResolvedValue({ items: [], total: 0, limit: 0, offset: 0 })
    await listSamples('ds1')
    expect(apiGet).toHaveBeenCalledWith('/datasets/ds1/samples')
  })

  it('promoteDataset posts to promote endpoint', async () => {
    apiPost.mockResolvedValue({})
    await promoteDataset('ds1', { name: 'official' })
    expect(apiPost).toHaveBeenCalledWith('/datasets/ds1/promote', { name: 'official' })
  })
})
