import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithRouter } from '@/test-utils'

const ds = vi.hoisted(() => ({
  createDataset: vi.fn(),
  flexibleCut: vi.fn(),
  listDatasets: vi.fn(),
}))
vi.mock('@/modules/datasets/datasets-api', async () => {
  const actual = await vi.importActual<typeof import('@/modules/datasets/datasets-api')>('@/modules/datasets/datasets-api')
  return { ...actual, ...ds }
})

import { VideoTimeline } from './components/video-timeline'
import { SaveCutModal } from './components/save-cut-modal'

afterEach(() => vi.clearAllMocks())

describe('VideoTimeline', () => {
  it('renders the track with markers and window handles', () => {
    const { container } = renderWithRouter(
      <VideoTimeline
        clipStartNs={0}
        clipEndNs={10_000_000_000}
        currentNs={2_000_000_000}
        markers={[{ frameIndex: 1, label: 'kf1' }, { frameIndex: 5 }]}
        window={{ startNs: 1_000_000_000, endNs: 6_000_000_000 }}
        onWindowChange={() => {}}
        onScrubNs={() => {}}
      />,
    )
    expect(container.querySelector('div')).toBeTruthy()
  })

  it('renders with an unset window', () => {
    renderWithRouter(
      <VideoTimeline
        clipStartNs={0}
        clipEndNs={5_000_000_000}
        currentNs={0}
        markers={[]}
        window={{ startNs: null, endNs: null }}
        onWindowChange={() => {}}
        onScrubNs={() => {}}
      />,
    )
    expect(document.body).toBeTruthy()
  })
})

describe('SaveCutModal', () => {
  it('does not load datasets while closed', () => {
    renderWithRouter(
      <SaveCutModal open={false} clipId="c1" windowNs={{ startNs: 0, endNs: 1 }} onClose={() => {}} />,
    )
    expect(ds.listDatasets).not.toHaveBeenCalled()
  })

  it('loads selectable datasets when opened', async () => {
    ds.listDatasets.mockResolvedValue({
      items: [
        {
          id: 'ds-1', name: 'Set', dataset_type: 'customized', dataset_version: 1, source_type: 'tags',
          requirement_id: null, allow_train: true, status: 'active', tag_expr: null, slice_strategy: 'flexible',
          ts_policy: 'p', default_range_l: 0, default_range_r: 0, created_by: 'me', resolved_meta: null,
          created_at: null, updated_at: null,
        },
      ],
      total: 1,
    })
    renderWithRouter(
      <SaveCutModal open clipId="c1" windowNs={{ startNs: 0, endNs: 1_000_000_000 }} onClose={() => {}} />,
    )
    await waitFor(() => expect(ds.listDatasets).toHaveBeenCalled())
  })
})
