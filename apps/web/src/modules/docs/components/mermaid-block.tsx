import { useEffect, useId, useRef, useState } from 'react'
import { Modal, Tooltip } from 'antd'
import { ExpandOutlined } from '@ant-design/icons'
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

/**
 * Mermaid block：
 *
 * 1. 用 mermaid.render 拿到 SVG，宽度大时让外层横向滚动 + SVG 缩放到容器；
 *    `useMaxWidth: false` 让 mermaid 输出原始尺寸 SVG，便于全屏放大查看清晰。
 * 2. 右上角放大按钮 → 弹出 Modal 全屏查看，支持滚轮 + 平移。
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
          body: { padding: 0, height: '85vh', overflow: 'auto', background: '#ffffff' },
        }}
        centered
        destroyOnClose
      >
        <div
          className="mermaid-block__fullscreen"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </Modal>
    </>
  )
}
