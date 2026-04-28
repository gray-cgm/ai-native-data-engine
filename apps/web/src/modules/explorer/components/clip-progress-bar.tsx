import { Tooltip, Typography } from 'antd'

const { Text } = Typography

type Props = {
  /** Lance metadata.start_time (ns) */
  startNs: number | null | undefined
  /** Lance metadata.end_time (ns) */
  endNs: number | null | undefined
  /** Optional current playhead position (ns) */
  nowNs?: number | null
  /** 'compact' for wall cards, 'detailed' for the clip detail metadata block */
  size?: 'compact' | 'detailed'
}

/**
 * 极简的 clip 时间进度条（只读，无交互）。
 *
 * 防溢出策略：
 * - 容器统一 ``min-width: 0; overflow: hidden`` 防止父级 flex 估宽溢出。
 * - 标签三段用 grid（``auto 1fr auto``），中段自动收缩，左右两端紧贴。
 * - compact 模式只显示 start / end 两端时间戳；detailed 才显示中间的 now/duration。
 */
export function ClipProgressBar({ startNs, endNs, nowNs, size = 'compact' }: Props) {
  const valid =
    startNs != null &&
    endNs != null &&
    Number.isFinite(startNs) &&
    Number.isFinite(endNs) &&
    endNs > startNs

  if (!valid) {
    return (
      <div style={{ fontSize: size === 'compact' ? 11 : 12, color: '#bfbfbf' }}>
        — no time window —
      </div>
    )
  }

  const span = endNs - startNs
  const nowPct =
    nowNs != null && nowNs >= startNs && nowNs <= endNs
      ? ((nowNs - startNs) / span) * 100
      : null

  const compact = size === 'compact'
  const trackHeight = compact ? 4 : 8
  const labelSize = compact ? 10 : 11

  const labelStyle: React.CSSProperties = {
    fontSize: labelSize,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: 0,
    lineHeight: 1.2,
  }

  return (
    <div style={{ width: '100%', minWidth: 0, overflow: 'hidden' }}>
      <div
        style={{
          position: 'relative',
          height: trackHeight,
          borderRadius: trackHeight / 2,
          background: 'linear-gradient(to right, #91caff, #1677ff)',
          opacity: 0.6,
        }}
      >
        {nowPct != null && (
          <Tooltip title={`now: ${nowNs} ns`}>
            <div
              style={{
                position: 'absolute',
                top: -2,
                bottom: -2,
                left: `${nowPct}%`,
                width: 2,
                background: '#fa541c',
                transform: 'translateX(-1px)',
              }}
            />
          </Tooltip>
        )}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: compact ? 'auto 1fr auto' : 'auto 1fr auto',
          gap: 6,
          alignItems: 'baseline',
          marginTop: 4,
        }}
      >
        <Tooltip title={`start · ${startNs} ns`}>
          <Text type="secondary" style={{ ...labelStyle, justifySelf: 'start' }}>
            {fmtTime(startNs)}
          </Text>
        </Tooltip>
        <span style={{ textAlign: 'center', overflow: 'hidden' }}>
          {compact ? null : nowPct != null && nowNs != null ? (
            <Tooltip title={`now · ${nowNs} ns`}>
              <Text style={{ ...labelStyle, color: '#fa541c' }}>
                +{fmtOffset(nowNs - startNs)}
              </Text>
            </Tooltip>
          ) : (
            <Text type="secondary" style={labelStyle}>
              {fmtOffset(span)}
            </Text>
          )}
        </span>
        <Tooltip title={`end · ${endNs} ns`}>
          <Text type="secondary" style={{ ...labelStyle, justifySelf: 'end' }}>
            {fmtTime(endNs)}
          </Text>
        </Tooltip>
      </div>
    </div>
  )
}

function fmtTime(ns: number): string {
  const d = new Date(ns / 1e6)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtOffset(deltaNs: number): string {
  const seconds = deltaNs / 1e9
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const m = Math.floor(seconds / 60)
  const s = seconds - m * 60
  return `${m}m${Math.round(s)}s`
}
