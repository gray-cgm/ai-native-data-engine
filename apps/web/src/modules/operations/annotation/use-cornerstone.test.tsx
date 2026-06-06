import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

// ── Fake cornerstone viewport + engine + tool group ──
const { viewport, engine, toolGroup, annotationState } = vi.hoisted(() => {
  const viewport = {
    setStack: vi.fn().mockResolvedValue(undefined),
    resetCamera: vi.fn(),
    render: vi.fn(),
    getCurrentImageIdIndex: vi.fn(() => 0),
    getImageIds: vi.fn(() => ['web:a', 'web:b']),
    setImageIdIndex: vi.fn().mockResolvedValue(undefined),
  }
  const engine = {
    enableElement: vi.fn(),
    getViewport: vi.fn(() => viewport),
    destroy: vi.fn(),
  }
  const toolGroup = {
    addTool: vi.fn(),
    addViewport: vi.fn(),
    setToolActive: vi.fn(),
    setToolPassive: vi.fn(),
  }
  const annotationState = {
    getAllAnnotations: vi.fn(() => [
      { annotationUID: 'a1', metadata: { toolName: 'RectangleROI', referencedImageId: 'web:a' }, data: { text: 'box' } },
    ]),
    removeAnnotation: vi.fn(),
    removeAllAnnotations: vi.fn(),
    addAnnotation: vi.fn(),
  }
  return { viewport, engine, toolGroup, annotationState }
})

vi.mock('@cornerstonejs/core', () => ({
  init: vi.fn().mockResolvedValue(undefined),
  RenderingEngine: vi.fn(() => engine),
  eventTarget: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
  Enums: { ViewportType: { STACK: 'stack' }, Events: { STACK_NEW_IMAGE: 'STACK_NEW_IMAGE' } },
}))

vi.mock('@cornerstonejs/tools', () => {
  const tool = (name: string) => ({ toolName: name })
  return {
    init: vi.fn().mockResolvedValue(undefined),
    addTool: vi.fn(),
    ToolGroupManager: {
      destroyToolGroup: vi.fn(),
      createToolGroup: vi.fn(() => toolGroup),
      getToolGroup: vi.fn(() => toolGroup),
    },
    annotation: {
      state: annotationState,
      selection: {
        isAnnotationSelected: vi.fn(() => false),
        setAnnotationSelected: vi.fn(),
      },
    },
    Enums: {
      MouseBindings: { Primary: 1, Secondary: 2, Auxiliary: 4, Wheel: 8 },
      Events: {
        ANNOTATION_ADDED: 'ANNOTATION_ADDED',
        ANNOTATION_MODIFIED: 'ANNOTATION_MODIFIED',
        ANNOTATION_REMOVED: 'ANNOTATION_REMOVED',
        ANNOTATION_SELECTION_CHANGE: 'ANNOTATION_SELECTION_CHANGE',
      },
    },
    PanTool: tool('Pan'),
    ZoomTool: tool('Zoom'),
    StackScrollTool: tool('StackScroll'),
    RectangleROITool: tool('RectangleROI'),
    EllipticalROITool: tool('EllipticalROI'),
    CircleROITool: tool('CircleROI'),
    PlanarFreehandROITool: tool('PlanarFreehandROI'),
    LengthTool: tool('Length'),
    AngleTool: tool('Angle'),
    BidirectionalTool: tool('Bidirectional'),
    ProbeTool: tool('Probe'),
    ArrowAnnotateTool: tool('ArrowAnnotate'),
    WindowLevelTool: tool('WindowLevel'),
  }
})
vi.mock('./web-image-loader', () => ({ registerWebImageLoader: vi.fn(), toWebImageId: (u: string) => u }))

import { useCornerstone } from './use-cornerstone'

afterEach(() => vi.clearAllMocks())

const IDS = ['web:a', 'web:b']

function attach(result: { current: { elementRef: (n: HTMLDivElement | null) => void } }) {
  const el = document.createElement('div')
  act(() => result.current.elementRef(el))
  return el
}

describe('useCornerstone', () => {
  it('initialises the engine + tool group once an element mounts', async () => {
    const { result } = renderHook(() => useCornerstone(IDS))
    attach(result)
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(engine.enableElement).toHaveBeenCalled()
    expect(toolGroup.addViewport).toHaveBeenCalled()
    // annotations read from state
    expect(result.current.annotations[0]?.label).toBe('box')
    expect(result.current.frameCount).toBe(2)
  })

  it('exposes working tool + annotation operations', async () => {
    const { result } = renderHook(() => useCornerstone(IDS))
    attach(result)
    await waitFor(() => expect(result.current.ready).toBe(true))

    act(() => result.current.setActiveTool('Length'))
    expect(toolGroup.setToolActive).toHaveBeenCalledWith('Length', expect.anything())
    expect(result.current.activeTool).toBe('Length')

    act(() => result.current.resetView())
    expect(viewport.resetCamera).toHaveBeenCalled()

    act(() => result.current.setFrame(1))
    expect(viewport.setImageIdIndex).toHaveBeenCalledWith(1)

    act(() => result.current.removeAnnotation('a1'))
    expect(annotationState.removeAnnotation).toHaveBeenCalledWith('a1')

    act(() => result.current.selectAnnotation('a1'))
    act(() => result.current.clearAnnotations())
    expect(annotationState.removeAllAnnotations).toHaveBeenCalled()

    const serialized = result.current.serializeAnnotations()
    expect(serialized[0]).toMatchObject({ uid: 'a1', tool: 'RectangleROI', label: 'box' })

    act(() =>
      result.current.restoreAnnotations([
        { uid: 'a1', tool: 'RectangleROI', data: { metadata: { toolName: 'RectangleROI' } } },
      ]),
    )
    expect(annotationState.addAnnotation).toHaveBeenCalled()
  })

  it('reports an error when tool group creation fails', async () => {
    const tools = await import('@cornerstonejs/tools')
    ;(tools.ToolGroupManager.createToolGroup as ReturnType<typeof vi.fn>).mockReturnValueOnce(null)
    const { result } = renderHook(() => useCornerstone(IDS))
    attach(result)
    await waitFor(() => expect(result.current.error).toBeTruthy())
    expect(result.current.ready).toBe(false)
  })
})
