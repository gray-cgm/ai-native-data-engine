import { useEffect, useMemo, useRef, useState } from 'react'
import { Tooltip, Typography } from 'antd'

const { Text } = Typography

export type TimelineMarker = {
  /** Frame index relative to the start of the clip */
  frameIndex: number
  /** Optional label shown on hover */
  label?: string
}

export type TimelineWindow = {
  /** Nanoseconds (Lance meta-aligned). null when not set yet. */
  startNs: number | null
  endNs: number | null
}

type Props = {
  /** Clip start time in nanoseconds (from ClipSummary.start_time / meta.lance) */
  clipStartNs: number
  /** Clip end time in nanoseconds (from ClipSummary.end_time / meta.lance) */
  clipEndNs: number
  /** Current video playback position in nanoseconds (mapped from <video>.currentTime) */
  currentNs: number
  /** Keyframe ticks; pass video_frame_index from /clips/{id}/cameras/{cam}/aligned */
  markers: TimelineMarker[]
  /** Frames per second of the underlying video; defaults to 10 */
  fps?: number
  window: TimelineWindow
  onWindowChange: (window: TimelineWindow) => void
  onScrubNs: (ns: number) => void
}

const TRACK_HEIGHT = 56

/**
 * Custom timeline anchored on Lance metadata's [start_time, end_time] (ns).
 *
 * - 内部一切按 ns 计算，UI 拖动 / 标记 / 关键帧吸附都在 ns 域完成。
 * - <video> 元素的 currentTime（秒）由调用方负责双向映射。
 *
 * 设计取舍：避免在 video 秒数与 ns 之间反复转换；ns 作为 single source of truth
 * 与 DatasetSample.ts 直接对齐。
 */
export function VideoTimeline({
  clipStartNs,
  clipEndNs,
  currentNs,
  markers,
  fps = 10,
  window,
  onWindowChange,
  onScrubNs,
}: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [dragHandle, setDragHandle] = useState<'start' | 'end' | null>(null)

  const clipDurationNs = Math.max(1, clipEndNs - clipStartNs)
  const totalFrames = Math.max(1, Math.round((clipDurationNs / 1e9) * fps))
  const frameSpanNs = clipDurationNs / totalFrames

  const safeMarkers = useMemo(
    () =>
      markers
        .filter((m) => m.frameIndex >= 0 && m.frameIndex <= totalFrames)
        .map((m) => ({
          ...m,
          ns: clipStartNs + Math.round(m.frameIndex * frameSpanNs),
        })),
    [markers, totalFrames, clipStartNs, frameSpanNs],
  )

  const positionPct = (ns: number | null) => {
    if (ns == null) return 0
    return Math.max(0, Math.min(100, ((ns - clipStartNs) / clipDurationNs) * 100))
  }

  const snapToMarker = (ns: number) => {
    if (safeMarkers.length === 0) return ns
    let best = safeMarkers[0].ns
    let bestDist = Math.abs(ns - best)
    for (const m of safeMarkers) {
      const d = Math.abs(ns - m.ns)
      if (d < bestDist) {
        best = m.ns
        bestDist = d
      }
    }
    // Only snap when within ~2 frames distance
    if (bestDist <= 2 * frameSpanNs) return best
    return ns
  }

  const handleTrackClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (dragHandle != null) return
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    const ratio = (event.clientX - rect.left) / rect.width
    const ns = clipStartNs + ratio * clipDurationNs
    onScrubNs(snapToMarker(ns))
  }

  useEffect(() => {
    if (!dragHandle) return
    const move = (event: MouseEvent) => {
      const rect = trackRef.current?.getBoundingClientRect()
      if (!rect || rect.width === 0) return
      const ratio = (event.clientX - rect.left) / rect.width
      const ns = snapToMarker(
        Math.max(clipStartNs, Math.min(clipEndNs, clipStartNs + ratio * clipDurationNs)),
      )
      if (dragHandle === 'start') {
        onWindowChange({
          startNs: ns,
          endNs: window.endNs != null && window.endNs < ns ? ns : window.endNs,
        })
      } else {
        onWindowChange({
          startNs: window.startNs != null && window.startNs > ns ? ns : window.startNs,
          endNs: ns,
        })
      }
    }
    const up = () => setDragHandle(null)
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
    return () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
    }
  }, [dragHandle, clipStartNs, clipEndNs, clipDurationNs, frameSpanNs, onWindowChange, safeMarkers, window.startNs, window.endNs])

  const startPct = positionPct(window.startNs)
  const endPct = positionPct(window.endNs)
  const currentPct = positionPct(currentNs)
  const hasWindow = window.startNs != null && window.endNs != null
  const selectionDurationNs = hasWindow ? (window.endNs! - window.startNs!) : 0

  return (
    <div style={{ width: '100%', userSelect: 'none' }}>
      <div
        ref={trackRef}
        onMouseDown={handleTrackClick}
        style={{
          position: 'relative',
          height: TRACK_HEIGHT,
          background: '#fafafa',
          border: '1px solid #d9d9d9',
          borderRadius: 4,
          cursor: 'pointer',
        }}
      >
        {hasWindow && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${Math.min(startPct, endPct)}%`,
              width: `${Math.abs(endPct - startPct)}%`,
              background: 'rgba(22, 119, 255, 0.18)',
              borderLeft: '1px solid #1677ff',
              borderRight: '1px solid #1677ff',
            }}
          />
        )}
        {safeMarkers.map((m) => (
          <Tooltip
            key={m.frameIndex}
            title={`frame ${m.frameIndex} · ${m.ns} ns`}
          >
            <div
              style={{
                position: 'absolute',
                top: 8,
                bottom: 8,
                left: `${positionPct(m.ns)}%`,
                width: 1,
                background: '#999',
              }}
            />
          </Tooltip>
        ))}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${currentPct}%`,
            width: 2,
            background: '#fa541c',
          }}
        />
        {window.startNs != null && (
          <Handle
            position={startPct}
            color="#1677ff"
            label="In"
            onMouseDown={(e) => {
              e.stopPropagation()
              setDragHandle('start')
            }}
          />
        )}
        {window.endNs != null && (
          <Handle
            position={endPct}
            color="#52c41a"
            label="Out"
            onMouseDown={(e) => {
              e.stopPropagation()
              setDragHandle('end')
            }}
          />
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 12 }}>
        <Tooltip title={`${clipStartNs} ns`}>
          <Text type="secondary">start: {formatNsOffset(0)}</Text>
        </Tooltip>
        <Tooltip title={`${currentNs} ns`}>
          <Text type="secondary">
            now: {formatNsOffset(currentNs - clipStartNs)} / {formatNsOffset(clipDurationNs)}
          </Text>
        </Tooltip>
        <Tooltip title={`${clipEndNs} ns`}>
          <Text type="secondary">end</Text>
        </Tooltip>
      </div>
      {hasWindow && (
        <div style={{ marginTop: 4, fontSize: 12 }}>
          <Text strong>Selection (Lance ns):</Text>{' '}
          <Text code>{window.startNs}</Text> →{' '}
          <Text code>{window.endNs}</Text>{' '}
          <Text type="secondary">({formatNsOffset(selectionDurationNs)})</Text>
        </div>
      )}
    </div>
  )
}

function Handle({
  position,
  color,
  label,
  onMouseDown,
}: {
  position: number
  color: string
  label: string
  onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        top: -4,
        bottom: -4,
        left: `calc(${position}% - 6px)`,
        width: 12,
        background: color,
        borderRadius: 3,
        cursor: 'ew-resize',
        boxShadow: '0 0 0 2px white',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        fontSize: 9,
        color: 'white',
        paddingTop: 2,
      }}
    >
      {label}
    </div>
  )
}

function formatNsOffset(deltaNs: number): string {
  if (!Number.isFinite(deltaNs)) return '—'
  const seconds = deltaNs / 1e9
  const m = Math.floor(seconds / 60)
  const s = seconds - m * 60
  return `${m}:${s.toFixed(2).padStart(5, '0')}`
}
