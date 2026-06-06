import { useEffect, useRef, useState } from 'react'
import { Button, Select, Tooltip, Typography } from 'antd'
import {
  LeftOutlined,
  PauseOutlined,
  CaretRightOutlined,
  RightOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
} from '@ant-design/icons'
import type { UseCornerstoneResult } from '../use-cornerstone'

const { Text } = Typography

// 帧格子配色：已标注=绿，未标注=浅灰，当前帧叠蓝环
const COLOR_ANNOTATED = '#52c41a'
const COLOR_EMPTY = '#e8e8e8'
const COLOR_CURRENT_RING = '#2175ff'

interface Props {
  cs: UseCornerstoneResult
}

// 顶部帧时间轴（Final Cut Pro 式）：跳首/逐帧/播放/跳尾 + 逐帧方块格子条 + fps。
// 每个格子 = cornerstone stack 的一个 imageIdx，颜色区分该帧标注状态；可点可拖跳帧。
export function FrameTimeline({ cs }: Props) {
  const { frameIndex, frameCount, frameAnnotationCounts, setFrame, ready } = cs
  const [playing, setPlaying] = useState(false)
  const [fps, setFps] = useState(10)
  const [dragging, setDragging] = useState(false)
  const timer = useRef<number | null>(null)
  const idxRef = useRef(frameIndex)
  idxRef.current = frameIndex

  const multi = ready && frameCount > 1
  const last = Math.max(0, frameCount - 1)

  // 播放：按 fps 步进，到尾循环回 0。
  useEffect(() => {
    if (!playing || !multi) return
    timer.current = window.setInterval(() => {
      const next = idxRef.current >= last ? 0 : idxRef.current + 1
      setFrame(next)
    }, Math.max(1000 / fps, 16))
    return () => {
      if (timer.current) window.clearInterval(timer.current)
      timer.current = null
    }
  }, [playing, fps, multi, last, setFrame])

  // 帧数变化（切换 clip）时停止播放
  useEffect(() => {
    setPlaying(false)
  }, [frameCount])

  // 拖拽 scrub：按住在格子间移动跳帧
  useEffect(() => {
    if (!dragging) return
    const up = () => setDragging(false)
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [dragging])

  const step = (d: number) => {
    setPlaying(false)
    setFrame(frameIndex + d)
  }

  const annotatedCount = frameAnnotationCounts.filter((n) => n > 0).length

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '6px 12px',
        background: '#fafafa',
        borderBottom: '1px solid #f0f0f0',
      }}
    >
      <div style={{ display: 'flex', gap: 2 }}>
        <Tooltip title="首帧">
          <Button type="text" size="small" icon={<StepBackwardOutlined />} disabled={!multi} onClick={() => step(-frameCount)} />
        </Tooltip>
        <Tooltip title="上一帧 (←)">
          <Button type="text" size="small" icon={<LeftOutlined />} disabled={!multi} onClick={() => step(-1)} />
        </Tooltip>
        <Tooltip title={playing ? '暂停' : '播放'}>
          <Button
            type="primary"
            size="small"
            icon={playing ? <PauseOutlined /> : <CaretRightOutlined />}
            disabled={!multi}
            onClick={() => setPlaying((p) => !p)}
          />
        </Tooltip>
        <Tooltip title="下一帧 (→)">
          <Button type="text" size="small" icon={<RightOutlined />} disabled={!multi} onClick={() => step(1)} />
        </Tooltip>
        <Tooltip title="末帧">
          <Button type="text" size="small" icon={<StepForwardOutlined />} disabled={!multi} onClick={() => step(frameCount)} />
        </Tooltip>
      </div>

      {/* 帧读数（等宽，FCP 时码风格） */}
      <Text style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, minWidth: 60, textAlign: 'center' }}>
        {String(frameIndex + 1).padStart(2, '0')} / {frameCount || 0}
      </Text>

      {/* 逐帧方块格子条 */}
      <div
        style={{ flex: 1, display: 'flex', gap: 2, minWidth: 120, alignItems: 'center', userSelect: 'none' }}
        onMouseLeave={() => setDragging(false)}
      >
        {Array.from({ length: frameCount }, (_, i) => {
          const n = frameAnnotationCounts[i] ?? 0
          const isCurrent = i === frameIndex
          return (
            <Tooltip key={i} title={`帧 ${i + 1}${n > 0 ? ` · ${n} 标注` : ' · 未标注'}`} mouseEnterDelay={0.15}>
              <div
                onMouseDown={() => {
                  setPlaying(false)
                  setDragging(true)
                  setFrame(i)
                }}
                onMouseEnter={() => dragging && setFrame(i)}
                style={{
                  flex: 1,
                  minWidth: 5,
                  height: 22,
                  borderRadius: 2,
                  cursor: 'pointer',
                  background: n > 0 ? COLOR_ANNOTATED : COLOR_EMPTY,
                  boxShadow: isCurrent ? `inset 0 0 0 2px ${COLOR_CURRENT_RING}` : 'none',
                  transition: 'background 0.15s',
                }}
              />
            </Tooltip>
          )
        })}
      </div>

      {/* 已标注帧统计 */}
      {multi && (
        <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          {annotatedCount}/{frameCount} 帧已标注
        </Text>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>fps</Text>
        <Select
          size="small"
          value={fps}
          onChange={setFps}
          style={{ width: 68 }}
          options={[5, 10, 15, 24, 30].map((f) => ({ label: f, value: f }))}
        />
      </div>
    </div>
  )
}
