import { useCallback, useEffect, useRef, useState } from 'react'
import {
  init as csCoreInit,
  RenderingEngine,
  Enums as csEnums,
  eventTarget,
  type Types,
} from '@cornerstonejs/core'
import {
  init as csToolsInit,
  addTool,
  ToolGroupManager,
  annotation,
  Enums as csToolsEnums,
  PanTool,
  ZoomTool,
  StackScrollTool,
} from '@cornerstonejs/tools'
import { registerWebImageLoader } from './web-image-loader'
import { TOOL_CLASSES, DEFAULT_PRIMARY_TOOL } from './tools'

const { MouseBindings } = csToolsEnums
const { ViewportType } = csEnums

// ── 全局一次性初始化（core + tools + web loader + 全局 addTool）──────────────
let initPromise: Promise<void> | null = null
function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await csCoreInit()
      await csToolsInit()
      registerWebImageLoader()
      for (const ToolClass of TOOL_CLASSES) addTool(ToolClass)
    })()
  }
  return initPromise
}

// 每个 hook 实例独立的 id，支持一页多 viewport。
let seq = 0
const nextId = () => `anno-${++seq}`

export interface AnnotationSummary {
  uid: string
  toolName: string
  label: string
  selected: boolean
}

const ANNOTATION_EVENTS = [
  csToolsEnums.Events.ANNOTATION_ADDED,
  csToolsEnums.Events.ANNOTATION_MODIFIED,
  csToolsEnums.Events.ANNOTATION_REMOVED,
  csToolsEnums.Events.ANNOTATION_SELECTION_CHANGE,
]

function readAnnotations(): AnnotationSummary[] {
  const all = annotation.state.getAllAnnotations()
  return all.map((a) => {
    const uid = a.annotationUID ?? ''
    const selected = uid ? annotation.selection.isAnnotationSelected(uid) : false
    const text = (a.data as { text?: string } | undefined)?.text
    const labelMeta = (a.data as { label?: string } | undefined)?.label
    return {
      uid,
      toolName: a.metadata?.toolName ?? 'unknown',
      label: text || labelMeta || (a.metadata?.toolName ?? 'annotation'),
      selected,
    }
  })
}

export interface SerializedAnnotation {
  uid: string
  tool: string
  label?: string
  data: unknown
}

export interface UseCornerstoneResult {
  elementRef: React.RefCallback<HTMLDivElement>
  ready: boolean
  error: string | null
  activeTool: string
  annotations: AnnotationSummary[]
  /** 当前帧索引（stack 中的位置） */
  frameIndex: number
  /** stack 总帧数 */
  frameCount: number
  /** 每帧的标注数（下标对齐 imageIds），用于时间轴格子着色 */
  frameAnnotationCounts: number[]
  setActiveTool: (toolName: string) => void
  resetView: () => void
  removeAnnotation: (uid: string) => void
  selectAnnotation: (uid: string) => void
  clearAnnotations: () => void
  /** 跳到指定帧（复用 cornerstone stack setImageIdIndex） */
  setFrame: (idx: number) => void
  /** 导出当前所有标注（含 metadata + 几何），用于 POST 落库 */
  serializeAnnotations: () => SerializedAnnotation[]
  /** 从落库结构回写标注到 viewport（先清空再逐条 addAnnotation） */
  restoreAnnotations: (items: SerializedAnnotation[]) => void
}

export function useCornerstone(imageIds: string[]): UseCornerstoneResult {
  const idsRef = useRef({
    rendering: nextId(),
    viewport: nextId(),
    toolGroup: nextId(),
  })
  const engineRef = useRef<RenderingEngine | null>(null)
  const elementNodeRef = useRef<HTMLDivElement | null>(null)

  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTool, setActiveToolState] = useState<string>(DEFAULT_PRIMARY_TOOL)
  const [annotations, setAnnotations] = useState<AnnotationSummary[]>([])
  const [frameIndex, setFrameIndex] = useState(0)
  const [frameAnnotationCounts, setFrameAnnotationCounts] = useState<number[]>([])

  const refreshAnnotations = useCallback(() => setAnnotations(readAnnotations()), [])

  // ── 引擎 + ToolGroup 初始化（element 就绪时跑一次，与 imageIds 解耦）──────────
  const initEngine = useCallback(
    async (element: HTMLDivElement) => {
      const { rendering, viewport, toolGroup: toolGroupId } = idsRef.current
      try {
        await ensureInitialized()

        const engine = new RenderingEngine(rendering)
        engineRef.current = engine
        engine.enableElement({ viewportId: viewport, type: ViewportType.STACK, element })

        // 滚轮翻帧 / 程序跳帧都会触发 STACK_NEW_IMAGE，用它把 frameIndex 同步给时间轴。
        element.addEventListener(csEnums.Events.STACK_NEW_IMAGE, (evt: Event) => {
          const idx = (evt as CustomEvent<{ imageIdIndex?: number }>).detail?.imageIdIndex
          if (typeof idx === 'number') setFrameIndex(idx)
        })

        // ToolGroup：互斥工具走左键，导航工具常驻其它鼠标键。
        ToolGroupManager.destroyToolGroup(toolGroupId)
        const group = ToolGroupManager.createToolGroup(toolGroupId)
        if (!group) throw new Error('failed to create tool group')
        for (const ToolClass of TOOL_CLASSES) group.addTool(ToolClass.toolName)
        group.addViewport(viewport, rendering)
        group.setToolActive(PanTool.toolName, { bindings: [{ mouseButton: MouseBindings.Auxiliary }] })
        group.setToolActive(ZoomTool.toolName, { bindings: [{ mouseButton: MouseBindings.Secondary }] })
        group.setToolActive(StackScrollTool.toolName, { bindings: [{ mouseButton: MouseBindings.Wheel }] })
        group.setToolActive(DEFAULT_PRIMARY_TOOL, { bindings: [{ mouseButton: MouseBindings.Primary }] })

        setReady(true)
        setError(null)
        refreshAnnotations()
      } catch (err) {
        setError((err as Error).message)
        setReady(false)
      }
    },
    [refreshAnnotations],
  )

  const elementRef = useCallback<React.RefCallback<HTMLDivElement>>(
    (node) => {
      elementNodeRef.current = node
      if (node) void initEngine(node)
    },
    [initEngine],
  )

  // ── setStack：引擎就绪 + imageIds 变化时重设（支持异步抽帧后更新图像）────────
  useEffect(() => {
    if (!ready || !engineRef.current || imageIds.length === 0) return
    const vp = engineRef.current.getViewport(idsRef.current.viewport) as Types.IStackViewport | undefined
    if (!vp) return
    let cancelled = false
    void vp
      .setStack(imageIds, 0)
      .then(() => {
        if (cancelled) return
        vp.resetCamera()
        vp.render()
        setFrameIndex(vp.getCurrentImageIdIndex?.() ?? 0)
        setError(null)
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message)
      })
    return () => {
      cancelled = true
    }
  }, [ready, imageIds])

  // 卸载 / 重建前清理 rendering engine + tool group。
  useEffect(() => {
    return () => {
      const { rendering, toolGroup } = idsRef.current
      ToolGroupManager.destroyToolGroup(toolGroup)
      engineRef.current?.destroy()
      engineRef.current = null
    }
  }, [])

  // 订阅标注事件，驱动 sidebar 列表刷新。
  useEffect(() => {
    const handler = () => refreshAnnotations()
    for (const evt of ANNOTATION_EVENTS) eventTarget.addEventListener(evt, handler)
    return () => {
      for (const evt of ANNOTATION_EVENTS) eventTarget.removeEventListener(evt, handler)
    }
  }, [refreshAnnotations])

  // 按帧统计标注数（annotation.metadata.referencedImageId → imageIds 下标）。
  // stack 标注本就按 referencedImageId 隔离显示，所以计数即每帧真实标注量。
  useEffect(() => {
    const counts = new Array(imageIds.length).fill(0)
    for (const a of annotation.state.getAllAnnotations()) {
      const ref = a.metadata?.referencedImageId
      if (!ref) continue
      const idx = imageIds.indexOf(ref)
      if (idx >= 0) counts[idx] += 1
    }
    setFrameAnnotationCounts(counts)
  }, [annotations, imageIds])

  // ── 对外操作 ─────────────────────────────────────────────────────────────
  const setActiveTool = useCallback((toolName: string) => {
    const group = ToolGroupManager.getToolGroup(idsRef.current.toolGroup)
    if (!group) return
    // 释放当前左键工具，再把新工具绑到左键（互斥）。
    setActiveToolState((prev) => {
      if (prev && prev !== toolName) group.setToolPassive(prev)
      return toolName
    })
    group.setToolActive(toolName, { bindings: [{ mouseButton: MouseBindings.Primary }] })
  }, [])

  const resetView = useCallback(() => {
    const vp = engineRef.current?.getViewport(idsRef.current.viewport) as Types.IStackViewport | undefined
    vp?.resetCamera()
    vp?.render()
  }, [])

  const setFrame = useCallback((idx: number) => {
    const vp = engineRef.current?.getViewport(idsRef.current.viewport) as Types.IStackViewport | undefined
    if (!vp) return
    const count = vp.getImageIds?.().length ?? 0
    if (count === 0) return
    const clamped = Math.max(0, Math.min(idx, count - 1))
    setFrameIndex(clamped) // 乐观更新，STACK_NEW_IMAGE 回来再校正
    void vp.setImageIdIndex(clamped)
  }, [])

  const removeAnnotation = useCallback((uid: string) => {
    annotation.state.removeAnnotation(uid)
    engineRef.current?.getViewport(idsRef.current.viewport)?.render()
    refreshAnnotations()
  }, [refreshAnnotations])

  const selectAnnotation = useCallback((uid: string) => {
    annotation.selection.setAnnotationSelected(uid, true, false)
    refreshAnnotations()
  }, [refreshAnnotations])

  const clearAnnotations = useCallback(() => {
    annotation.state.removeAllAnnotations()
    engineRef.current?.getViewport(idsRef.current.viewport)?.render()
    refreshAnnotations()
  }, [refreshAnnotations])

  const serializeAnnotations = useCallback((): SerializedAnnotation[] => {
    return annotation.state.getAllAnnotations().map((a) => ({
      uid: a.annotationUID ?? '',
      tool: a.metadata?.toolName ?? 'unknown',
      label:
        (a.data as { text?: string; label?: string } | undefined)?.text ??
        (a.data as { label?: string } | undefined)?.label,
      data: a, // 整个 annotation 对象（metadata + 几何），回写时逐字 addAnnotation
    }))
  }, [])

  const restoreAnnotations = useCallback(
    (items: SerializedAnnotation[]) => {
      const element = elementNodeRef.current
      if (!element) return
      annotation.state.removeAllAnnotations()
      for (const item of items) {
        const ann = item.data as Parameters<typeof annotation.state.addAnnotation>[0] | undefined
        if (ann && typeof ann === 'object' && ann.metadata?.toolName) {
          annotation.state.addAnnotation(ann, element)
        }
      }
      engineRef.current?.getViewport(idsRef.current.viewport)?.render()
      refreshAnnotations()
    },
    [refreshAnnotations],
  )

  return {
    elementRef,
    ready,
    error,
    activeTool,
    annotations,
    frameIndex,
    frameCount: imageIds.length,
    frameAnnotationCounts,
    setActiveTool,
    resetView,
    removeAnnotation,
    selectAnnotation,
    clearAnnotations,
    setFrame,
    serializeAnnotations,
    restoreAnnotations,
  }
}
