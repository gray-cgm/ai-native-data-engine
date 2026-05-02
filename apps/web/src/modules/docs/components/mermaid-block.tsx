import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Modal, Tooltip } from 'antd'
import { ExpandOutlined, MinusOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import mermaid from 'mermaid'

let initialized = false
function ensureInit() {
  if (initialized) return
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    flowchart: { htmlLabels: true, curve: 'basis', useMaxWidth: false },
    fontFamily: 'inherit',
  })
  initialized = true
}

type Props = {
  code: string
}

const MIN_SCALE = 0.25
const MAX_SCALE = 6
// 工具栏按钮一次跳变 20%
const ZOOM_STEP = 1.2
// macOS 双指 pinch 会发 ctrlKey=true 的 wheel，deltaY 颗粒度很小但发射频率极高，
// 灵敏度必须比鼠标滚轮低一个量级，否则一捏就到顶。
const PINCH_SENSITIVITY = 0.01
// 鼠标滚轮 / 触控板两指滚动，每次 deltaY 通常 ~50-120，灵敏度低一些更舒服。
const WHEEL_SENSITIVITY = 0.0015

/**
 * Mermaid block：
 *
 * 1. 用 mermaid.render 拿到带 viewBox + 真实宽高属性的 SVG（`useMaxWidth: false`），
 *    CSS 用 `max-width: 100% / max-height: 70vh + width:auto/height:auto` 让浏览器
 *    按 viewBox 等比缩小到适配容器，非全屏视图永远完整可见、无滚动条。
 * 2. 全屏 modal 支持滚轮缩放（以鼠标位置为锚点）/ 拖拽平移 / 双击复位 / 工具栏按钮。
 */
export function MermaidBlock({ code }: Props) {
  const reactId = useId()
  const safeId = 'mmd-' + reactId.replace(/[^a-zA-Z0-9]/g, '')
  const ref = useRef<HTMLDivElement | null>(null)
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    ensureInit()
    setError('')
    // 不同实例渲染要独立 id，避免 mermaid 复用导致空白
    const renderId = `${safeId}-${Math.random().toString(36).slice(2, 8)}`
    mermaid
      .render(renderId, code)
      .then((result) => {
        if (cancelled) return
        setSvg(result.svg)
        if (result.bindFunctions && ref.current) {
          result.bindFunctions(ref.current)
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
      })
    return () => {
      cancelled = true
    }
  }, [code, safeId])

  if (error) {
    return (
      <div className="mermaid-block mermaid-block--error">
        <div className="mermaid-block__error-title">Mermaid 渲染失败</div>
        <pre className="mermaid-block__error-msg">{error}</pre>
        <pre className="mermaid-block__source">{code}</pre>
      </div>
    )
  }

  return (
    <>
      <div className="mermaid-block">
        <Tooltip title="全屏查看">
          <button
            type="button"
            className="mermaid-block__expand"
            onClick={() => setOpen(true)}
            aria-label="Expand diagram"
          >
            <ExpandOutlined />
          </button>
        </Tooltip>
        <div
          className="mermaid-block__viewport"
          ref={ref}
          // svg from mermaid.render is trusted output produced locally
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width="92vw"
        styles={{
          body: { padding: 0, height: '85vh', overflow: 'hidden', background: '#ffffff' },
        }}
        centered
        destroyOnClose
      >
        <MermaidPanZoom svg={svg} />
      </Modal>
    </>
  )
}

type PanZoomProps = {
  svg: string
}

/**
 * 给 SVG 套一层 transform: translate(tx, ty) scale(s) 的 wrapper，
 * 处理滚轮缩放（围绕光标）/ 鼠标拖拽 / 双击复位 + 工具栏按钮（+/−/Reset 与缩放百分比）。
 *
 * 状态都用 useRef 持有，DOM transform 直接 imperative 写入，避免每帧 setState
 * 触发重渲（鼠标拖拽 60fps 下 setState 会卡）。仅缩放百分比 UI 用 setState 同步。
 */
function MermaidPanZoom({ svg }: PanZoomProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const stateRef = useRef({ scale: 1, tx: 0, ty: 0 })
  const dragRef = useRef<{ startX: number; startY: number; startTx: number; startTy: number } | null>(null)
  const [scalePct, setScalePct] = useState(100)

  const apply = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const { scale, tx, ty } = stateRef.current
    stage.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`
    setScalePct(Math.round(scale * 100))
  }, [])

  const reset = useCallback(() => {
    stateRef.current = { scale: 1, tx: 0, ty: 0 }
    apply()
  }, [apply])

  // svg 重渲时复位 transform，避免上次 zoom 状态残留
  useEffect(() => {
    reset()
  }, [svg, reset])

  const zoomAt = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      const stage = stageRef.current
      if (!stage) return
      // 取 stage 当前渲染后的 bounding rect：已经把 flex 居中带来的隐式 offset
      // 与 translate(tx,ty)scale(s) 都体现进去了，下面的几何就和容器布局解耦。
      const rect = stage.getBoundingClientRect()
      const { scale, tx, ty } = stateRef.current
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor))
      if (newScale === scale) return
      const ratio = newScale / scale
      // 光标相对于 stage 渲染后左上角的偏移
      const qx = clientX - rect.left
      const qy = clientY - rect.top
      // 让光标下那一点保持在屏幕同一位置：tx 偏移 q*(1-ratio)
      // 推导：stage 渲染左上角 = layout_origin + tx；stage 中某点 P 在屏幕上的位置
      //   V = layout_origin + tx + P*s。锚定 V 不变 → newTx = tx + (V - rect.left)*(1 - ratio)。
      stateRef.current = {
        scale: newScale,
        tx: tx + qx * (1 - ratio),
        ty: ty + qy * (1 - ratio),
      }
      apply()
    },
    [apply],
  )

  // wheel 用 native listener + passive: false 才能 preventDefault 阻止页面滚动
  useEffect(() => {
    const node = containerRef.current
    if (!node) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      // deltaMode=1（LINE，少数浏览器/输入设备）按 16px 一行折算，统一到像素维度
      const deltaPx = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
      // macOS 触控板双指 pinch 会带 ctrlKey=true（且事件触发率高、deltaY 小）；
      // 普通滚轮 / 两指滚动 deltaY 大但频率低，需要更低的灵敏度。
      const sensitivity = event.ctrlKey ? PINCH_SENSITIVITY : WHEEL_SENSITIVITY
      // exp(-d*s)：连续比例缩放——deltaY 越大缩放越多，自然贴合输入设备节奏。
      const factor = Math.exp(-deltaPx * sensitivity)
      zoomAt(event.clientX, event.clientY, factor)
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const onMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startTx: stateRef.current.tx,
      startTy: stateRef.current.ty,
    }
    event.preventDefault()
  }

  // 拖拽相关 handler 走 window 级监听，光标拖出 modal 也不丢
  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return
      stateRef.current = {
        ...stateRef.current,
        tx: drag.startTx + (event.clientX - drag.startX),
        ty: drag.startTy + (event.clientY - drag.startY),
      }
      apply()
    }
    const onUp = () => {
      dragRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [apply])

  const onDoubleClick = () => reset()

  const buttonZoom = (factor: number) => {
    const node = containerRef.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor)
  }

  return (
    <div className="mermaid-panzoom">
      <div
        className="mermaid-panzoom__container"
        ref={containerRef}
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
      >
        <div
          className="mermaid-panzoom__stage"
          ref={stageRef}
          // svg from mermaid.render is trusted local output
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
      <div className="mermaid-panzoom__toolbar" onMouseDown={(e) => e.stopPropagation()}>
        <Tooltip title="缩小">
          <button type="button" onClick={() => buttonZoom(1 / ZOOM_STEP)} aria-label="Zoom out">
            <MinusOutlined />
          </button>
        </Tooltip>
        <span className="mermaid-panzoom__scale">{scalePct}%</span>
        <Tooltip title="放大">
          <button type="button" onClick={() => buttonZoom(ZOOM_STEP)} aria-label="Zoom in">
            <PlusOutlined />
          </button>
        </Tooltip>
        <Tooltip title="复位（双击同效）">
          <button type="button" onClick={reset} aria-label="Reset">
            <ReloadOutlined />
          </button>
        </Tooltip>
      </div>
      <div className="mermaid-panzoom__hint">滚轮缩放 · 拖拽平移 · 双击复位</div>
    </div>
  )
}
