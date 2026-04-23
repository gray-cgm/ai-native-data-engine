import { useEffect, useId, useRef, useState } from 'react'
import mermaid from 'mermaid'

let initialized = false
function ensureInit() {
  if (initialized) return
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    flowchart: { htmlLabels: true, curve: 'basis' },
    fontFamily: 'inherit',
  })
  initialized = true
}

type Props = {
  code: string
}

export function MermaidBlock({ code }: Props) {
  const reactId = useId()
  const id = 'mmd-' + reactId.replace(/[^a-zA-Z0-9]/g, '')
  const ref = useRef<HTMLDivElement | null>(null)
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    ensureInit()
    setError('')
    mermaid
      .render(id, code)
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
  }, [code, id])

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
    <div
      className="mermaid-block"
      ref={ref}
      // svg from mermaid.render is trusted output produced locally
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
