import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderRoutePage } from '@/test-utils'

const clips = vi.hoisted(() => ({
  fetchClipDetail: vi.fn(),
  fetchClipFrames: vi.fn(),
  fetchStandaloneTopic: vi.fn(),
  fetchAlignedCameraFrames: vi.fn(),
  buildClipVideoUrl: vi.fn(() => '/api/video'),
}))
vi.mock('./clips-api', async () => {
  const actual = await vi.importActual<typeof import('./clips-api')>('./clips-api')
  return { ...actual, ...clips }
})
vi.mock('./components/video-timeline', () => ({ VideoTimeline: () => <div data-testid="video-timeline" /> }))
vi.mock('./components/save-cut-modal', () => ({ SaveCutModal: () => null }))

import ClipDetailPage from './pages/clip-detail.page'

const detail = {
  item: {
    clip_id: 'clip-detail-1',
    keyframe_count: 20,
    start_time: 1_000_000_000,
    end_time: 6_000_000_000,
    duration_seconds: 5,
    vehicle_name: 'veh-a',
    city: 'SF',
    district: 'Mission',
    scenario: 'night',
    tags: 'rain, fog',
    da_tags: 'pedestrian',
    topics: [{ name: 'lidar' }],
    cameras: [{ name: 'front', position: 'front', ros_topic: '/cam/front' }],
    standalone_topics: [{ name: 'imu' }],
    has_wm: true,
  },
  meta: {
    vehicle_name: 'veh-a',
    vehicle_model: 3,
    vehicle_info: null,
    city: 'SF',
    district: 'Mission',
    scenario: 'night',
    tags: 'rain, fog',
    da_tags: 'pedestrian',
    jira_id: 'JIRA-1',
    start_time: 1_000_000_000,
    end_time: 6_000_000_000,
    calibration_version: 2,
  },
  camera_catalog: [
    {
      name: 'front',
      position: 'front',
      ros_topic: '/cam/front',
      model: 'm1',
      vendor: 'v1',
      width: 1920,
      height: 1080,
      hfov: 120,
      vfov: 70,
      is_avm: false,
      extrinsic_xyz: [0, 0, 0],
      mp4_path: '/path.mp4',
      mp4_resize_paths: [],
      has_local_video: true,
    },
  ],
}

afterEach(() => vi.clearAllMocks())

describe('ClipDetailPage', () => {
  it('renders clip metadata, camera viewer and frame panels when loaded', async () => {
    clips.fetchClipDetail.mockResolvedValue(detail)
    clips.fetchAlignedCameraFrames.mockResolvedValue({
      camera: 'front',
      items: [{ timestamp: 1, video_frame_timestamp: 1, video_frame_index: 0 }],
    })
    clips.fetchClipFrames.mockResolvedValue({
      items: [{ ts: 1, foo: 'bar' }], limit: 50, offset: 0,
    })
    clips.fetchStandaloneTopic.mockResolvedValue({ items: [{ ts: 2 }], limit: 50, offset: 0 })

    renderRoutePage(<ClipDetailPage />, '/explorer/clips/:clipId', '/explorer/clips/clip-detail-1?dataset=scenario:night')
    await waitFor(() => expect(screen.getByText('Metadata')).toBeInTheDocument())
    expect(screen.getAllByText(/clip-detail-1/).length).toBeGreaterThan(0)
    // camera viewer + aligned frames fetched
    await waitFor(() => expect(clips.fetchAlignedCameraFrames).toHaveBeenCalled())
  })

  it('renders error state on fetch failure', async () => {
    clips.fetchClipDetail.mockRejectedValue(new Error('clip boom'))
    renderRoutePage(<ClipDetailPage />, '/explorer/clips/:clipId', '/explorer/clips/missing')
    await waitFor(() => expect(screen.getByText('clip boom')).toBeInTheDocument())
  })
})
