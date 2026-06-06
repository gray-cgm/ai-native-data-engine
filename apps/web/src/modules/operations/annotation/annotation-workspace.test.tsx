import { afterEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderWithRouter } from '@/test-utils'

const csStub = {
  elementRef: () => {},
  ready: true,
  error: null,
  activeTool: 'RectangleROI',
  annotations: [],
  frameIndex: 0,
  frameCount: 1,
  frameAnnotationCounts: [0],
  setActiveTool: vi.fn(),
  resetView: vi.fn(),
  removeAnnotation: vi.fn(),
  selectAnnotation: vi.fn(),
  clearAnnotations: vi.fn(),
  setFrame: vi.fn(),
  serializeAnnotations: vi.fn(() => []),
  restoreAnnotations: vi.fn(),
}

const ann = vi.hoisted(() => ({ saveAnnotations: vi.fn(), loadAnnotations: vi.fn() }))
const clips = vi.hoisted(() => ({
  fetchClipDetail: vi.fn(),
  buildClipVideoUrl: vi.fn(() => '/api/video'),
}))
const frame = vi.hoisted(() => ({ captureVideoFrames: vi.fn() }))

vi.mock('./use-cornerstone', () => ({ useCornerstone: () => csStub }))
vi.mock('./annotation-api', () => ann)
vi.mock('@/modules/explorer/clips-api', async () => {
  const actual = await vi.importActual<typeof import('@/modules/explorer/clips-api')>('@/modules/explorer/clips-api')
  return { ...actual, ...clips }
})
vi.mock('./video-frame', () => frame)
vi.mock('./components/cornerstone-viewport', () => ({ CornerstoneViewport: () => <div data-testid="viewport" /> }))
vi.mock('./components/tool-rail', () => ({ ToolRail: () => <div /> }))
vi.mock('./components/frame-timeline', () => ({ FrameTimeline: () => <div /> }))
vi.mock('./components/annotation-sidebar', () => ({ AnnotationSidebar: () => <div /> }))

import AnnotationWorkspacePage from './annotation-workspace.page'

afterEach(() => vi.clearAllMocks())

describe('AnnotationWorkspacePage', () => {
  it('falls back to the demo image when no clip is provided', async () => {
    ann.loadAnnotations.mockResolvedValue({ clip_id: '', event: null })
    renderWithRouter(<AnnotationWorkspacePage />, ['/ops/labeling/annotate'])
    await waitFor(() => expect(document.querySelector('[data-testid="viewport"]')).toBeTruthy())
  })

  it('captures frames for a clip from the query string', async () => {
    clips.fetchClipDetail.mockResolvedValue({
      item: { clip_id: 'c1', cameras: [{ name: 'front' }] },
      meta: {},
      camera_catalog: [{ name: 'front', has_local_video: true, mp4_path: '/x.mp4', mp4_resize_paths: [] }],
    })
    frame.captureVideoFrames.mockResolvedValue(['data:image/jpeg;base64,a'])
    ann.loadAnnotations.mockResolvedValue({ clip_id: 'c1', event: null })

    renderWithRouter(<AnnotationWorkspacePage />, ['/ops/labeling/annotate?clip=c1&trace=t1&ops_item=o1'])
    await waitFor(() => expect(clips.fetchClipDetail).toHaveBeenCalledWith('c1'))
  })

  it('renders explicit ?images= sources directly', async () => {
    ann.loadAnnotations.mockResolvedValue({ clip_id: '', event: null })
    renderWithRouter(
      <AnnotationWorkspacePage />,
      ['/ops/labeling/annotate?images=http://a/1.png,http://a/2.png'],
    )
    await waitFor(() => expect(document.querySelector('[data-testid="viewport"]')).toBeTruthy())
  })
})
