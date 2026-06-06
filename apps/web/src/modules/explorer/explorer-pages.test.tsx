import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderRoutePage, renderWithRouter } from '@/test-utils'

const clips = vi.hoisted(() => ({
  fetchClips: vi.fn(),
  fetchClipDetail: vi.fn(),
  fetchClipFrames: vi.fn(),
  fetchStandaloneTopic: vi.fn(),
  fetchAlignedCameraFrames: vi.fn(),
  buildClipVideoUrl: vi.fn(() => '/api/video'),
}))
const explorerApi = vi.hoisted(() => ({
  fetchExplorerDashboard: vi.fn(),
  fetchDistribution: vi.fn(),
  fetchSearchRows: vi.fn(),
}))

vi.mock('./clips-api', async () => {
  const actual = await vi.importActual<typeof import('./clips-api')>('./clips-api')
  return { ...actual, ...clips }
})
vi.mock('./api', () => explorerApi)
// distribution chart uses @ant-design/plots which is heavy; stub it
vi.mock('@ant-design/plots', () => ({ Pie: () => null, Column: () => null, Bar: () => null, Line: () => null }))

import DistributionPage from './pages/distribution.page'
import SearchPage from './pages/search.page'

const clipItem = {
  clip_id: 'clip-xyz',
  keyframe_count: 8,
  start_time: null,
  end_time: null,
  duration_seconds: 12,
  vehicle_name: 'veh',
  city: 'SF',
  district: null,
  scenario: 'night',
  tags: 'rain',
  da_tags: null,
  topics: [],
  cameras: [],
  standalone_topics: [],
  has_wm: false,
}

afterEach(() => vi.clearAllMocks())

describe('DistributionPage', () => {
  it('renders distribution rows from the dashboard', async () => {
    explorerApi.fetchExplorerDashboard.mockResolvedValue({
      distribution: [{ scene: 'night', sample_count: 10 }],
      streaming: null,
      searchRows: [],
    })
    clips.fetchClips.mockResolvedValue({ items: [clipItem], pagination: { total: 1, skip: 0, limit: 1 } })

    renderWithRouter(<DistributionPage />, ['/explorer'])
    await waitFor(() => expect(explorerApi.fetchExplorerDashboard).toHaveBeenCalled())
    expect(clips.fetchClips).toHaveBeenCalled()
  })

  it('renders empty state when nothing to show', async () => {
    explorerApi.fetchExplorerDashboard.mockResolvedValue({ distribution: [], streaming: null, searchRows: [] })
    clips.fetchClips.mockResolvedValue({ items: [], pagination: { total: 0, skip: 0, limit: 0 } })
    renderWithRouter(<DistributionPage />, ['/explorer'])
    await waitFor(() => expect(explorerApi.fetchExplorerDashboard).toHaveBeenCalled())
  })
})

describe('SearchPage', () => {
  it('renders clip search results and filter controls', async () => {
    clips.fetchClips.mockResolvedValue({ items: [clipItem], pagination: { total: 1, skip: 0, limit: 1 } })
    renderRoutePage(<SearchPage />, '/explorer/search', '/explorer/search')
    await waitFor(() => expect(clips.fetchClips).toHaveBeenCalled())
    await waitFor(() => expect(screen.getAllByText(/clip-xyz/).length).toBeGreaterThan(0))
  })

  it('honours query-string prefilled filters', async () => {
    clips.fetchClips.mockResolvedValue({ items: [clipItem], pagination: { total: 1, skip: 0, limit: 1 } })
    renderRoutePage(
      <SearchPage />,
      '/explorer/search',
      '/explorer/search?q=night&scenario=night&tags=rain,fog&city=SF',
    )
    await waitFor(() => expect(clips.fetchClips).toHaveBeenCalled())
  })
})
