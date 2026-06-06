import { Alert, Empty, Spin } from 'antd'
import type { UseCornerstoneResult } from '../use-cornerstone'

interface Props {
  cs: UseCornerstoneResult
  hasImages: boolean
  /** 覆盖在 canvas 四角的元数据遮罩层 */
  overlay?: React.ReactNode
  /** 正在抽帧/解析图像 */
  resolving?: boolean
  resolvingText?: string
}

// 纯渲染壳：cornerstone3D 把 canvas 挂进这个 div。所有状态从 useCornerstone 来，
// 这样 viewport / toolbar / sidebar 共享同一个引擎实例。
export function CornerstoneViewport({ cs, hasImages, overlay, resolving, resolvingText }: Props) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 360,
        background: '#000',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {/* cornerstone3D enableElement 的目标元素；右键菜单要禁掉，否则和 Zoom 冲突 */}
      <div
        ref={cs.elementRef}
        onContextMenu={(e) => e.preventDefault()}
        style={{ width: '100%', height: '100%' }}
      />

      {/* 元数据遮罩层覆盖在 canvas 之上（四角） */}
      {hasImages && overlay}

      {resolving && (
        <div style={{ ...overlayStyle, flexDirection: 'column', gap: 12 }}>
          <Spin />
          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>{resolvingText ?? '抽帧中…'}</span>
        </div>
      )}

      {!hasImages && !resolving && (
        <div style={overlayStyle}>
          <Empty
            description={<span style={{ color: '#bfbfbf' }}>未指定图像 —— 通过 ?images= 传入或从 clip 进入</span>}
          />
        </div>
      )}

      {hasImages && !cs.ready && !cs.error && (
        <div style={{ ...overlayStyle, flexDirection: 'column', gap: 12 }}>
          <Spin />
          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>初始化 cornerstone3D…</span>
        </div>
      )}

      {cs.error && (
        <div style={{ ...overlayStyle, padding: 16 }}>
          <Alert type="error" showIcon message="Viewport 加载失败" description={cs.error} />
        </div>
      )}
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
}
