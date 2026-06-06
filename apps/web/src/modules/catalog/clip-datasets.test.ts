import { afterEach, describe, expect, it, vi } from 'vitest'

const apiGet = vi.fn()
vi.mock('@/shared/api/client', () => ({ apiGet: (...a: unknown[]) => apiGet(...a) }))

import {
  buildClipDatasets,
  clipBelongsToDataset,
  deriveDatasetId,
  fetchClipDatasetDetail,
  fetchClipDatasets,
  parseDatasetId,
} from './clip-datasets'
import type { ClipSummary } from '@/modules/explorer/clips-api'

function clip(over: Partial<ClipSummary> = {}): ClipSummary {
  return {
    clip_id: 'c1',
    keyframe_count: 10,
    start_time: null,
    end_time: null,
    duration_seconds: 5,
    vehicle_name: 'veh-a',
    city: 'SF',
    district: null,
    scenario: 'night',
    tags: 'rain, fog',
    da_tags: null,
    topics: [],
    cameras: [],
    standalone_topics: [],
    has_wm: false,
    ...over,
  }
}

afterEach(() => vi.clearAllMocks())

describe('deriveDatasetId / parseDatasetId', () => {
  it('round-trips a scenario value', () => {
    expect(deriveDatasetId('night')).toBe('scenario:night')
    expect(parseDatasetId('scenario:night')).toEqual({ grouping: 'scenario', value: 'night' })
  })
  it('uses the unassigned sentinel for empty scenario', () => {
    const id = deriveDatasetId('  ')
    expect(parseDatasetId(id).value).toBeNull()
  })
  it('falls back when prefix unknown', () => {
    expect(parseDatasetId('foo')).toEqual({ grouping: 'scenario', value: 'foo' })
    expect(parseDatasetId('')).toEqual({ grouping: 'scenario', value: null })
  })
})

describe('clipBelongsToDataset', () => {
  it('matches a clip to its derived dataset', () => {
    expect(clipBelongsToDataset(clip({ scenario: 'night' }), 'scenario:night')).toBe(true)
    expect(clipBelongsToDataset(clip({ scenario: 'day' }), 'scenario:night')).toBe(false)
  })
})

describe('buildClipDatasets', () => {
  it('groups clips by scenario, aggregates counts and unique tags', () => {
    const datasets = buildClipDatasets([
      clip({ clip_id: 'a', scenario: 'night', tags: 'rain', keyframe_count: 2, duration_seconds: 3 }),
      clip({ clip_id: 'b', scenario: 'night', tags: 'rain, fog', keyframe_count: 3, duration_seconds: 4 }),
      clip({ clip_id: 'c', scenario: 'day', tags: '', keyframe_count: 1, duration_seconds: 1 }),
    ])
    const night = datasets.find((d) => d.dataset_id === 'scenario:night')!
    expect(night.clip_count).toBe(2)
    expect(night.keyframe_total).toBe(5)
    expect(night.duration_total_seconds).toBe(7)
    expect(night.tags.sort()).toEqual(['fog', 'rain'])
    // largest dataset sorts first
    expect(datasets[0].dataset_id).toBe('scenario:night')
  })

  it('labels unassigned clips', () => {
    const datasets = buildClipDatasets([clip({ scenario: null })])
    expect(datasets[0].name).toBe('Unassigned clips')
  })
})

describe('fetch helpers', () => {
  it('fetchClipDatasets derives from /clips items', async () => {
    apiGet.mockResolvedValue({ items: [clip({ scenario: 'night' })], pagination: { total: 1, skip: 0, limit: 1 } })
    const ds = await fetchClipDatasets()
    expect(ds[0].scenario).toBe('night')
  })
  it('fetchClipDatasetDetail returns null when no clips match', async () => {
    apiGet.mockResolvedValue({ items: [clip({ scenario: 'day' })], pagination: { total: 1, skip: 0, limit: 1 } })
    const detail = await fetchClipDatasetDetail('scenario:night')
    expect(detail).toBeNull()
  })
  it('fetchClipDatasetDetail returns the dataset with clips when matched', async () => {
    apiGet.mockResolvedValue({ items: [clip({ scenario: 'night' })], pagination: { total: 1, skip: 0, limit: 1 } })
    const detail = await fetchClipDatasetDetail('scenario:night')
    expect(detail?.dataset.scenario).toBe('night')
    expect(detail?.clips.length).toBe(1)
  })
})
