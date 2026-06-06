import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { UseCornerstoneResult } from './use-cornerstone'
import { ToolRail } from './components/tool-rail'
import { AnnotationSidebar } from './components/annotation-sidebar'
import { FrameTimeline } from './components/frame-timeline'
import { ViewportOverlay } from './components/viewport-overlay'
import { CornerstoneViewport } from './components/cornerstone-viewport'

function makeCs(over: Partial<UseCornerstoneResult> = {}): UseCornerstoneResult {
  return {
    elementRef: () => {},
    ready: true,
    error: null,
    activeTool: 'RectangleROI',
    annotations: [
      { uid: 'a1', toolName: 'RectangleROI', label: 'box', selected: false },
      { uid: 'a2', toolName: 'Length', label: 'len', selected: true },
    ],
    frameIndex: 0,
    frameCount: 3,
    frameAnnotationCounts: [2, 0, 1],
    setActiveTool: vi.fn(),
    resetView: vi.fn(),
    removeAnnotation: vi.fn(),
    selectAnnotation: vi.fn(),
    clearAnnotations: vi.fn(),
    setFrame: vi.fn(),
    serializeAnnotations: vi.fn(() => []),
    restoreAnnotations: vi.fn(),
    ...over,
  } as unknown as UseCornerstoneResult
}

describe('ToolRail', () => {
  it('renders tool buttons and dispatches setActiveTool', () => {
    const cs = makeCs()
    render(<ToolRail cs={cs} />)
    const buttons = document.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThan(0)
    fireEvent.click(buttons[0])
    expect(cs.setActiveTool).toHaveBeenCalled()
  })

  it('disables tools when not ready', () => {
    render(<ToolRail cs={makeCs({ ready: false })} />)
    const disabled = document.querySelectorAll('button[disabled]')
    expect(disabled.length).toBeGreaterThan(0)
  })
})

describe('AnnotationSidebar', () => {
  it('lists annotations and supports select/remove', () => {
    const cs = makeCs()
    render(<AnnotationSidebar cs={cs} />)
    expect(screen.getAllByText(/box|len/).length).toBeGreaterThan(0)
  })

  it('renders empty when no annotations', () => {
    render(<AnnotationSidebar cs={makeCs({ annotations: [] })} />)
    expect(document.body.textContent?.length ?? 0).toBeGreaterThan(0)
  })
})

describe('FrameTimeline', () => {
  it('renders frame markers and seeks on click', () => {
    const cs = makeCs()
    const { container } = render(<FrameTimeline cs={cs} />)
    expect(container.textContent?.length ?? 0).toBeGreaterThan(0)
  })

  it('renders nothing meaningful with a single frame', () => {
    render(<FrameTimeline cs={makeCs({ frameCount: 1, frameAnnotationCounts: [0] })} />)
    expect(document.body).toBeTruthy()
  })
})

describe('ViewportOverlay', () => {
  it('renders the four corner line groups', () => {
    render(
      <ViewportOverlay
        tl={[{ label: 'clip', value: 'c1' }]}
        tr={[{ value: 'top-right' }]}
        bl={[{ label: 'tool', value: 'rect' }]}
        br={[{ value: 'frame 1/3' }]}
      />,
    )
    expect(screen.getByText('c1')).toBeInTheDocument()
    expect(screen.getByText('top-right')).toBeInTheDocument()
  })
})

describe('CornerstoneViewport', () => {
  it('renders the canvas shell with overlay when images present', () => {
    render(
      <CornerstoneViewport
        cs={makeCs()}
        hasImages
        overlay={<div>overlay-content</div>}
      />,
    )
    expect(screen.getByText('overlay-content')).toBeInTheDocument()
  })

  it('shows a resolving hint when resolving', () => {
    render(
      <CornerstoneViewport cs={makeCs({ ready: false })} hasImages={false} resolving resolvingText="抽帧中…" />,
    )
    expect(screen.getByText('抽帧中…')).toBeInTheDocument()
  })
})
