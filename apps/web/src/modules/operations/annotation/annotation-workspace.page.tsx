import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, Space, Tooltip, message } from 'antd'
import { ArrowLeftOutlined, CloudUploadOutlined, ReloadOutlined } from '@ant-design/icons'
import { PageContainer } from '@/shared/components/page-container'
import { useCornerstone } from './use-cornerstone'
import { toWebImageId } from './web-image-loader'
import { CornerstoneViewport } from './components/cornerstone-viewport'
import { ToolRail } from './components/tool-rail'
import { FrameTimeline } from './components/frame-timeline'
import { AnnotationSidebar } from './components/annotation-sidebar'
import { ViewportOverlay, type OverlayLine } from './components/viewport-overlay'
import { loadAnnotations, saveAnnotations } from './annotation-api'
import { captureVideoFrames } from './video-frame'
import { buildClipVideoUrl, fetchClipDetail } from '@/modules/explorer/clips-api'

const FRAME_COUNT = 16 // 每个 clip 抽多少帧组成 cornerstone stack

// 没有 clip 时本地合成一张演示图，保证 viewport 开箱可渲染 + 试标注。
function buildDemoImageUrl(): string {
  const canvas = document.createElement('canvas')
  canvas.width = 1280
  canvas.height = 720
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const grad = ctx.createLinearGradient(0, 0, 1280, 720)
  grad.addColorStop(0, '#1f3a5f')
  grad.addColorStop(1, '#0b1320')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 1280, 720)
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  for (let x = 0; x <= 1280; x += 80) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 720); ctx.stroke()
  }
  for (let y = 0; y <= 720; y += 80) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1280, y); ctx.stroke()
  }
  ctx.fillStyle = 'rgba(255,255,255,0.65)'
  ctx.font = '28px sans-serif'
  ctx.fillText('Annotation demo · 选工具后在此拖动标注', 60, 80)
  return canvas.toDataURL('image/png')
}

type ImgSource = 'query' | 'clip-frames' | 'demo' | 'resolving'

export default function AnnotationWorkspacePage() {
  const [searchParams] = useSearchParams()
  const fromClip = searchParams.get('clip')
  const fromTrace = searchParams.get('trace')
  const fromOpsItem = searchParams.get('ops_item')
  const rawImages = searchParams.get('images')

  // 图像来源优先级：?images= 显式 > clip 视频多帧抽取(stack) > 本地演示图。
  const [imageIds, setImageIds] = useState<string[]>([])
  const [imgSource, setImgSource] = useState<ImgSource>('resolving')
  const [imgError, setImgError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    setImgError(null)
    setProgress(null)

    const explicit = (rawImages ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    const fallbackToDemo = () => {
      const demo = buildDemoImageUrl()
      setImageIds(demo ? [toWebImageId(demo)] : [])
      setImgSource('demo')
    }

    if (explicit.length > 0) {
      setImageIds(explicit.map(toWebImageId))
      setImgSource('query')
    } else if (fromClip) {
      setImgSource('resolving')
      ;(async () => {
        try {
          const detail = await fetchClipDetail(fromClip)
          const cam = detail.camera_catalog.find((c) => c.has_local_video) ?? detail.camera_catalog[0]
          if (!cam?.has_local_video) throw new Error('该 clip 无本地视频可抽帧')
          const frames = await captureVideoFrames(
            buildClipVideoUrl(fromClip, cam.name),
            FRAME_COUNT,
            (done, total) => !cancelled && setProgress({ done, total }),
          )
          if (cancelled) return
          setImageIds(frames.map(toWebImageId))
          setImgSource('clip-frames')
        } catch (err) {
          if (cancelled) return
          setImgError((err as Error).message)
          fallbackToDemo()
        } finally {
          if (!cancelled) setProgress(null)
        }
      })()
    } else {
      fallbackToDemo()
    }

    return () => {
      cancelled = true
    }
  }, [rawImages, fromClip])

  const cs = useCornerstone(imageIds)

  useEffect(() => {
    if (imgError) message.warning(`真实帧抽取失败，已回退演示图：${imgError}`)
  }, [imgError])

  // 键盘逐帧（← / →），输入框聚焦时不拦截。
  const fiRef = useRef(cs.frameIndex)
  fiRef.current = cs.frameIndex
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowLeft') { e.preventDefault(); cs.setFrame(fiRef.current - 1) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); cs.setFrame(fiRef.current + 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cs])

  // 保存需要一个 clip_id 作为结果对象；演示态没传 clip 时退化到 demo-clip。
  const clipId = fromClip || 'demo-clip'
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const { event, ops_item } = await saveAnnotations({
        clip_id: clipId,
        annotations: cs.serializeAnnotations(),
        ops_item_id: fromOpsItem ?? undefined,
        x_trace_id: fromTrace ?? undefined,
        image_id: imageIds[cs.frameIndex],
      })
      setSavedAt(new Date().toLocaleTimeString())
      const tail = ops_item ? `，任务 ${ops_item.id.slice(0, 8)} → ${ops_item.status}` : ''
      message.success(`已保存 ${event.results.length} 个标注 → event ${event.event_id ?? event.id}${tail}`)
    } catch (err) {
      message.error(`保存失败：${(err as Error).message}`)
    } finally {
      setSaving(false)
    }
  }, [clipId, cs, fromOpsItem, fromTrace, imageIds])

  const handleLoad = useCallback(async () => {
    setLoading(true)
    try {
      const { event } = await loadAnnotations(clipId, fromTrace ?? undefined)
      const items = (event?.results ?? [])
        .map((r) => ({
          uid: r.extra?.uid ?? r.id,
          tool: r.extra?.tool ?? 'unknown',
          label: r.da_tags ?? undefined,
          data: r.extra?.data,
        }))
        .filter((x) => x.data)
      cs.restoreAnnotations(items)
      message.success(event ? `已加载 ${items.length} 个标注` : '该 clip 暂无已存标注')
    } catch (err) {
      message.error(`加载失败：${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [clipId, cs, fromTrace])

  // 进入页面、viewport 就绪后，若带了真实 clip 则自动回写一次已存标注。
  const autoLoadedRef = useRef(false)
  useEffect(() => {
    if (cs.ready && fromClip && !autoLoadedRef.current) {
      autoLoadedRef.current = true
      void handleLoad()
    }
  }, [cs.ready, fromClip, handleLoad])

  // 四角遮罩层：左上=对象身份，右上=图像源/帧，左下=链路，右下=标注/保存
  const short = (s: string, n = 12) => (s.length > n ? `${s.slice(0, n)}…` : s)
  const SOURCE_LABEL: Record<ImgSource, string> = {
    query: 'query ?images=',
    'clip-frames': '真实帧 · clip video',
    demo: '本地演示图',
    resolving: progress ? `抽帧 ${progress.done}/${progress.total}…` : '抽帧中…',
  }
  const overlayTL: OverlayLine[] = [
    { label: 'clip', value: fromClip ? short(fromClip, 18) : 'demo-clip' },
    ...(fromOpsItem ? [{ label: 'item', value: short(fromOpsItem, 18) }] : []),
  ]
  const overlayTR: OverlayLine[] = [
    { value: SOURCE_LABEL[imgSource] },
    { label: 'frame', value: `${cs.frameIndex + 1}/${cs.frameCount || 0}` },
  ]
  const overlayBL: OverlayLine[] = fromTrace ? [{ label: 'trace', value: short(fromTrace, 22) }] : []
  const overlayBR: OverlayLine[] = [
    { label: '标注', value: `${cs.annotations.length}` },
    ...(savedAt ? [{ label: '保存', value: savedAt }] : []),
  ]

  const actions = (
    <Space>
      <Tooltip title="从后端加载该 clip 最近一次标注">
        <Button icon={<ReloadOutlined />} loading={loading} disabled={!cs.ready} onClick={handleLoad}>
          加载
        </Button>
      </Tooltip>
      <Tooltip title="序列化标注 → 写 labeling event / EventResult（x_trace_id 透传）">
        <Button type="primary" icon={<CloudUploadOutlined />} loading={saving} disabled={!cs.ready} onClick={handleSave}>
          保存标注
        </Button>
      </Tooltip>
      {fromClip ? (
        <Link to={`/explorer/clips/${encodeURIComponent(fromClip)}`}>
          <Button icon={<ArrowLeftOutlined />}>返回 Clip</Button>
        </Link>
      ) : (
        <Link to="/ops/labeling">
          <Button icon={<ArrowLeftOutlined />}>返回 Labeling</Button>
        </Link>
      )}
    </Space>
  )

  return (
    <PageContainer
      title="标注工作台 · Annotation"
      description="cornerstone3D stack 渲染 + @cornerstonejs/tools 标注。左键当前工具 · 中键平移 · 右键缩放 · ← / → 逐帧。"
      actions={actions}
    >
      {/* 亮色工作区，与全站 antd 风格一致；仅 viewport 画布保留深色（图像查看器惯例） */}
      <div
        style={{
          display: 'flex',
          height: '78vh',
          background: '#fff',
          border: '1px solid #f0f0f0',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <ToolRail cs={cs} />

        {/* 中区：顶部时间轴 + viewport */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <FrameTimeline cs={cs} />
          <div style={{ flex: 1, position: 'relative', minHeight: 0, padding: 12, background: '#f5f5f5' }}>
            <CornerstoneViewport
              cs={cs}
              hasImages={imageIds.length > 0}
              resolving={imgSource === 'resolving'}
              resolvingText={progress ? `抽帧 ${progress.done}/${progress.total}…` : '抽帧中…'}
              overlay={<ViewportOverlay tl={overlayTL} tr={overlayTR} bl={overlayBL} br={overlayBR} />}
            />
          </div>
        </div>

        {/* 右栏：标注对象 */}
        <div style={{ width: 300, flexShrink: 0, borderLeft: '1px solid #f0f0f0', display: 'flex' }}>
          <AnnotationSidebar cs={cs} />
        </div>
      </div>
    </PageContainer>
  )
}
