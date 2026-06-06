// 覆盖在 canvas 四角的元数据遮罩层（DICOM viewer 经典样式）。
// pointer-events:none —— 不拦截标注交互；text-shadow 保证在任意底图上可读。

export interface OverlayLine {
  label?: string
  value: React.ReactNode
}

interface Props {
  tl?: OverlayLine[]
  tr?: OverlayLine[]
  bl?: OverlayLine[]
  br?: OverlayLine[]
}

const baseCorner: React.CSSProperties = {
  position: 'absolute',
  maxWidth: '46%',
  fontSize: 11,
  lineHeight: 1.5,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  color: 'rgba(255,255,255,0.88)',
  textShadow: '0 1px 2px rgba(0,0,0,0.9)',
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

function Corner({ lines, style, align }: { lines: OverlayLine[]; style: React.CSSProperties; align: 'left' | 'right' }) {
  if (!lines.length) return null
  return (
    <div style={{ ...baseCorner, ...style, textAlign: align }}>
      {lines.map((l, i) => (
        <div key={i} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {l.label && <span style={{ color: 'rgba(255,255,255,0.5)' }}>{l.label} </span>}
          {l.value}
        </div>
      ))}
    </div>
  )
}

export function ViewportOverlay({ tl = [], tr = [], bl = [], br = [] }: Props) {
  return (
    <>
      <Corner lines={tl} align="left" style={{ top: 10, left: 12 }} />
      <Corner lines={tr} align="right" style={{ top: 10, right: 12 }} />
      <Corner lines={bl} align="left" style={{ bottom: 10, left: 12 }} />
      <Corner lines={br} align="right" style={{ bottom: 10, right: 12 }} />
    </>
  )
}
