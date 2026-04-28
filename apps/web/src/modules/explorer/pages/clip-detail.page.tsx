import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Row,
  Segmented,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import { ArrowLeftOutlined, PlayCircleOutlined, ScissorOutlined, VideoCameraOutlined } from '@ant-design/icons'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { PageError } from '@/shared/components/page-error'
import {
  buildClipVideoUrl,
  fetchAlignedCameraFrames,
  fetchClipDetail,
  fetchClipFrames,
  fetchStandaloneTopic,
  type ClipAlignedFrame,
  type ClipCameraCatalogItem,
  type ClipFrameRow,
  type ClipSummary,
} from '../clips-api'
import { VideoTimeline, type TimelineWindow } from '../components/video-timeline'
import { SaveCutModal } from '../components/save-cut-modal'
import { ClipProgressBar } from '../components/clip-progress-bar'

const { Text, Paragraph } = Typography

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}m ${s}s`
}

function formatTimestamp(ns: number | null): string {
  if (!ns) return '—'
  return new Date(ns / 1e6).toLocaleString()
}

export default function ClipDetailPage() {
  const { clipId = '' } = useParams<{ clipId: string }>()
  const [searchParams] = useSearchParams()
  const fromDataset = searchParams.get('dataset')
  const fromRequirement = searchParams.get('requirement')
  const detailFetcher = useCallback(() => fetchClipDetail(clipId), [clipId])
  const { data, state, error, refetch } = useQuery(detailFetcher, {
    cacheKey: `explorer:clip:${clipId}`,
  })

  if (state === 'loading') return <PageLoading message="Loading clip detail…" />
  if (state === 'error') return <PageError message={error?.message} onRetry={refetch} />
  if (!data) return <PageError message="Clip not found" onRetry={refetch} />

  const summary = data.item
  const backLink = fromDataset ? (
    <Link to={`/catalog/${encodeURIComponent(fromDataset)}`}>
      <Button icon={<ArrowLeftOutlined />}>Back to dataset</Button>
    </Link>
  ) : fromRequirement ? (
    <Link to={`/requirements/${fromRequirement}`}>
      <Button icon={<ArrowLeftOutlined />}>Back to requirement</Button>
    </Link>
  ) : (
    <Link to="/explorer/search">
      <Button icon={<ArrowLeftOutlined />}>Back to search</Button>
    </Link>
  )

  const breadcrumbItems = [
    ...(fromRequirement
      ? [
          { title: <Link to="/requirements">Requirements</Link> },
          {
            title: (
              <Link to={`/requirements/${fromRequirement}`}>{fromRequirement.slice(0, 8)}…</Link>
            ),
          },
        ]
      : []),
    ...(fromDataset
      ? [
          { title: <Link to="/catalog">Catalog</Link> },
          {
            title: (
              <Link to={`/catalog/${encodeURIComponent(fromDataset)}`}>{fromDataset}</Link>
            ),
          },
        ]
      : [{ title: <Link to="/explorer/search">Search</Link> }]),
    { title: summary.clip_id },
  ]

  return (
    <PageContainer
      title={`Clip ${summary.clip_id}`}
      description={`${summary.vehicle_name ?? 'unknown vehicle'} · ${[summary.city, summary.district].filter(Boolean).join(' / ') || 'unknown location'}`}
      actions={backLink}
    >
      <Breadcrumb style={{ marginBottom: 12 }} items={breadcrumbItems} />
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="Metadata">
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="Clip ID">
                <Text copyable style={{ fontFamily: 'monospace' }}>{summary.clip_id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Vehicle">
                {summary.vehicle_name ?? '—'}{' '}
                {data.meta.vehicle_model != null && (
                  <Text type="secondary">(model {data.meta.vehicle_model})</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Location">
                {[summary.city, summary.district].filter(Boolean).join(' / ') || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Scenario">
                {summary.scenario ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Duration">
                {formatDuration(summary.duration_seconds)}
                {' · '}
                {summary.keyframe_count} keyframes
              </Descriptions.Item>
              <Descriptions.Item label="Tags">
                <Space size={[4, 4]} wrap>
                  {(summary.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                    <Tag key={t} style={{ marginInlineEnd: 0 }}>{t}</Tag>
                  ))}
                  {summary.da_tags && (
                    <Tag color="gold" style={{ marginInlineEnd: 0 }}>{summary.da_tags}</Tag>
                  )}
                  {!summary.tags && !summary.da_tags && <Text type="secondary">—</Text>}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Jira">
                {data.meta.jira_id ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Calibration">
                v{data.meta.calibration_version ?? '—'}
              </Descriptions.Item>
            </Descriptions>

            {/* Timeline 拆出 Descriptions —— 单元格太窄会撑破布局；这里整张卡全宽展示。 */}
            <div style={{ marginTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                Timeline (Lance metadata · ns)
              </Text>
              <ClipProgressBar
                startNs={summary.start_time}
                endNs={summary.end_time}
                size="detailed"
              />
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Vehicle dimensions (mm)">
            {data.meta.vehicle_info ? (
              <Descriptions size="small" column={1} bordered>
                {Object.entries(data.meta.vehicle_info).map(([k, v]) => (
                  <Descriptions.Item key={k} label={k}>{v}</Descriptions.Item>
                ))}
              </Descriptions>
            ) : (
              <Empty description="No vehicle_info" />
            )}
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Tabs
          defaultActiveKey="video"
          items={[
            {
              key: 'video',
              label: (
                <span>
                  <VideoCameraOutlined /> Video & cameras
                </span>
              ),
              children: <CamerasPanel clipId={summary.clip_id} cameras={data.camera_catalog} summary={summary} />,
            },
            {
              key: 'topics',
              label: 'Topic frames',
              children: (
                <TopicFramesPanel
                  clipId={summary.clip_id}
                  topics={summary.topics.map((t) => t.name)}
                  standalone={summary.standalone_topics.map((t) => t.name)}
                />
              ),
            },
            {
              key: 'schema',
              label: 'Schema summary',
              children: <SchemaPanel summary={summary} />,
            },
          ]}
        />
      </Card>
    </PageContainer>
  )
}

// ── Cameras + video playback ────────────────────────────────────────────────

function CamerasPanel({
  clipId,
  cameras,
  summary,
}: {
  clipId: string
  cameras: ClipCameraCatalogItem[]
  summary: ClipSummary
}) {
  const recordableCams = cameras.filter((c) => !c.is_avm || c.mp4_path)
  const [selected, setSelected] = useState<string>(() => recordableCams[0]?.name ?? cameras[0]?.name ?? '')

  useEffect(() => {
    if (!selected && cameras[0]) setSelected(cameras[0].name)
  }, [cameras, selected])

  const current = cameras.find((c) => c.name === selected)

  return (
    <Row gutter={16}>
      <Col xs={24} lg={10}>
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <Segmented
            size="small"
            block
            options={[
              { label: 'All', value: 'all' },
              { label: 'Recordable', value: 'rec' },
              { label: 'AVM', value: 'avm' },
            ]}
            defaultValue="all"
            onChange={() => {}}
          />
          <div style={{ display: 'grid', gap: 8 }}>
            {cameras.map((cam) => (
              <Card
                key={cam.name}
                size="small"
                hoverable
                onClick={() => setSelected(cam.name)}
                style={{
                  borderColor: cam.name === selected ? '#1677ff' : undefined,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{cam.name}</strong>
                  <Space size={4}>
                    {cam.is_avm && <Tag color="purple">AVM</Tag>}
                    {cam.has_local_video ? (
                      <Tag color="green">local</Tag>
                    ) : (
                      <Tag color="default">remote-only</Tag>
                    )}
                  </Space>
                </div>
                <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                  {cam.position ?? '—'} · {cam.width ?? '?'}×{cam.height ?? '?'} · hfov {cam.hfov ?? '?'}°
                </div>
              </Card>
            ))}
          </div>
        </Space>
      </Col>
      <Col xs={24} lg={14}>
        {current ? (
          <VideoPlayer clipId={clipId} camera={current} summary={summary} />
        ) : (
          <Empty description="No camera selected" />
        )}
      </Col>
    </Row>
  )
}

function VideoPlayer({
  clipId,
  camera,
  summary,
}: {
  clipId: string
  camera: ClipCameraCatalogItem
  summary: ClipSummary
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const framesFetcher = useCallback(
    () => fetchAlignedCameraFrames(clipId, camera.name, { limit: 500 }),
    [clipId, camera.name],
  )
  const framesKey = `explorer:clip:${clipId}:cam:${camera.name}:aligned`
  const frames = useQuery(framesFetcher, { cacheKey: framesKey, isEmpty: (d) => d.items.length === 0 })

  // ── Flexible cut state ─────────────────────────────────────────────
  // Lance metadata 是时间轴 single source of truth：start_time / end_time 为 ns。
  // 缺失时回退到 video.duration（秒）合成一个伪时间轴，仅用于 UI 渲染。
  const clipStartNs = summary.start_time ?? 0
  const fallbackDurationNs = Math.max(1, Math.round((summary.duration_seconds ?? 0) * 1e9))
  const clipEndNs = summary.end_time ?? clipStartNs + fallbackDurationNs
  const clipDurationNs = Math.max(1, clipEndNs - clipStartNs)

  const [currentNs, setCurrentNs] = useState<number>(clipStartNs)
  const [videoDurationSec, setVideoDurationSec] = useState(summary.duration_seconds ?? 0)
  // 默认 in/out 直接用 lance metadata 的整段范围；用户拖动手柄即可收紧。
  const [cutWindow, setCutWindow] = useState<TimelineWindow>({
    startNs: clipStartNs,
    endNs: clipEndNs,
  })
  const [cutModalOpen, setCutModalOpen] = useState(false)

  const videoUrl = buildClipVideoUrl(clipId, camera.name)

  useEffect(() => {
    setLoadError(null)
    setCurrentNs(clipStartNs)
    setCutWindow({ startNs: clipStartNs, endNs: clipEndNs })
  }, [clipId, camera.name, clipStartNs, clipEndNs])

  const fps = camera.has_local_video ? 10 : 10 // metadata not yet exposed; default 10Hz
  const timelineMarkers = useMemo(() => {
    const items = frames.data?.items ?? []
    return items
      .filter((f) => f.video_frame_index != null)
      .map((f) => ({ frameIndex: f.video_frame_index as number }))
  }, [frames.data])

  // ── seconds (video.currentTime) ↔ ns (Lance) 双向映射 ──
  const secondsToNs = useCallback(
    (seconds: number): number => {
      const total = videoDurationSec || (clipDurationNs / 1e9)
      if (!total || total <= 0) return clipStartNs
      const ratio = Math.max(0, Math.min(1, seconds / total))
      return Math.round(clipStartNs + ratio * clipDurationNs)
    },
    [videoDurationSec, clipDurationNs, clipStartNs],
  )

  const nsToSeconds = useCallback(
    (ns: number): number => {
      const total = videoDurationSec || (clipDurationNs / 1e9)
      if (!total || total <= 0) return 0
      const ratio = Math.max(0, Math.min(1, (ns - clipStartNs) / clipDurationNs))
      return ratio * total
    },
    [videoDurationSec, clipDurationNs, clipStartNs],
  )

  const onLoadedMetadata = () => {
    const v = videoRef.current
    if (!v) return
    const total = Number.isFinite(v.duration) ? v.duration : summary.duration_seconds ?? 0
    if (total > 0) setVideoDurationSec(total)
  }

  const onTimeUpdate = () => {
    const v = videoRef.current
    if (!v) return
    setCurrentNs(secondsToNs(v.currentTime))
  }

  const handleScrubNs = (ns: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = nsToSeconds(ns)
    setCurrentNs(ns)
  }

  const handleMarkIn = () => {
    setCutWindow((prev) => ({ startNs: currentNs, endNs: prev.endNs ?? null }))
  }

  const handleMarkOut = () => {
    setCutWindow((prev) => ({ startNs: prev.startNs ?? null, endNs: currentNs }))
  }

  // Reset 回到 lance metadata 的整段范围（不是 null），保持"in/out 默认覆盖整 clip"语义。
  const handleClearWindow = () => setCutWindow({ startNs: clipStartNs, endNs: clipEndNs })

  const cutValid =
    cutWindow.startNs != null && cutWindow.endNs != null && cutWindow.endNs > cutWindow.startNs

  const handleError = () => {
    setLoadError(
      camera.has_local_video
        ? 'Failed to load local MP4. Check the API logs.'
        : `No local copy at data/raw/thumbnail_video/${clipId}/${camera.name}.mp4. Remote MP4 lives at ${camera.mp4_path ?? 'N/A'}.`,
    )
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Card size="small" title={`${camera.name} · ${camera.position ?? ''}`}>
        {camera.has_local_video ? (
          <video
            ref={videoRef}
            key={videoUrl}
            src={videoUrl}
            controls
            preload="metadata"
            style={{ width: '100%', background: '#000', maxHeight: 480 }}
            onError={handleError}
            onLoadedMetadata={onLoadedMetadata}
            onTimeUpdate={onTimeUpdate}
          />
        ) : (
          <Alert
            type="info"
            showIcon
            message="Video not cached locally"
            description={
              <div>
                <div>Remote URI: <Text code>{camera.mp4_path ?? '—'}</Text></div>
                <div>
                  Expected local path:{' '}
                  <Text code>data/raw/thumbnail_video/{clipId}/{camera.name}.mp4</Text>
                </div>
              </div>
            }
          />
        )}
        {loadError && (
          <Alert type="warning" showIcon message={loadError} style={{ marginTop: 8 }} />
        )}
        {camera.has_local_video && clipDurationNs > 0 && (
          <div style={{ marginTop: 12 }}>
            <VideoTimeline
              clipStartNs={clipStartNs}
              clipEndNs={clipEndNs}
              currentNs={currentNs}
              markers={timelineMarkers}
              fps={fps}
              window={cutWindow}
              onWindowChange={setCutWindow}
              onScrubNs={handleScrubNs}
            />
            <Space size="small" style={{ marginTop: 8 }} wrap>
              <Button size="small" onClick={handleMarkIn}>
                Mark In ({currentNs} ns)
              </Button>
              <Button size="small" onClick={handleMarkOut}>
                Mark Out ({currentNs} ns)
              </Button>
              <Button
                size="small"
                type="primary"
                icon={<ScissorOutlined />}
                disabled={!cutValid}
                onClick={() => setCutModalOpen(true)}
              >
                Save Cut
              </Button>
              <Button
                size="small"
                onClick={handleClearWindow}
                disabled={cutWindow.startNs === clipStartNs && cutWindow.endNs === clipEndNs}
              >
                Reset to clip range
              </Button>
            </Space>
          </div>
        )}
        <Descriptions size="small" column={2} style={{ marginTop: 12 }}>
          <Descriptions.Item label="Resolution">
            {camera.width ?? '?'} × {camera.height ?? '?'}
          </Descriptions.Item>
          <Descriptions.Item label="FOV (h/v)">
            {camera.hfov ?? '?'}° / {camera.vfov ?? '?'}°
          </Descriptions.Item>
          <Descriptions.Item label="Model">{camera.model ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Vendor">{camera.vendor ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="ROS topic" span={2}>
            <Text code>{camera.ros_topic ?? '—'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Extrinsic (x,y,z)" span={2}>
            {camera.extrinsic_xyz ? camera.extrinsic_xyz.map((v) => v?.toFixed(3) ?? '—').join(', ') : '—'}
          </Descriptions.Item>
        </Descriptions>
        <MediaPathsPanel mp4Path={camera.mp4_path} resizePaths={camera.mp4_resize_paths} />
      </Card>
      <SaveCutModal
        open={cutModalOpen}
        clipId={clipId}
        windowNs={{
          startNs: cutWindow.startNs ?? clipStartNs,
          endNs: cutWindow.endNs ?? clipEndNs,
        }}
        onClose={() => setCutModalOpen(false)}
        onSaved={() => handleClearWindow()}
      />
      <Card size="small" title={`Aligned frames (${frames.data?.items.length ?? 0})`}>
        {frames.state === 'loading' && <Paragraph type="secondary">Loading aligned frames…</Paragraph>}
        {frames.state === 'error' && (
          <Alert type="error" message={frames.error?.message ?? 'Failed to load frames'} />
        )}
        {frames.state === 'empty' && <Empty description="No frame index for this camera" />}
        {frames.state === 'ready' && (
          <div style={{ maxHeight: 240, overflow: 'auto' }}>
            <AlignedFramesTable
              items={frames.data?.items ?? []}
              onSeek={(idx) => seekToIndex(videoRef.current, idx)}
            />
          </div>
        )}
      </Card>
    </Space>
  )
}

function MediaPathsPanel({
  mp4Path,
  resizePaths,
}: {
  mp4Path: string | null | undefined
  resizePaths: string[] | null | undefined
}) {
  const variants = Array.isArray(resizePaths) ? resizePaths.filter(Boolean) : []
  const hasOriginal = Boolean(mp4Path)
  if (!hasOriginal && variants.length === 0) return null
  return (
    <div style={{ marginTop: 12, borderTop: '1px dashed #f0f0f0', paddingTop: 8 }}>
      {hasOriginal && (
        <div style={{ marginBottom: 4 }}>
          <Text strong style={{ fontSize: 12 }}>
            Original MP4:
          </Text>{' '}
          <Text code copyable style={{ fontSize: 11 }}>
            {mp4Path}
          </Text>
        </div>
      )}
      <div>
        <Text strong style={{ fontSize: 12 }}>
          Resize variants ({variants.length}):
        </Text>
        {variants.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
            — (meta.mp4_resize_path is empty)
          </Text>
        ) : (
          <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: 11 }}>
            {variants.map((uri, idx) => (
              <li key={`${uri}-${idx}`} style={{ listStyle: 'decimal' }}>
                <Text code copyable style={{ fontSize: 11 }}>
                  {uri}
                </Text>
                {idx === 0 && (
                  <Tag color="geekblue" style={{ marginLeft: 6 }}>
                    thumbnail
                  </Tag>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function seekToIndex(video: HTMLVideoElement | null, frameIndex: number | null) {
  if (!video || frameIndex == null) return
  // Without authoritative fps info here, fall back to 10 Hz (a common keyframe
  // rate in this dataset). The UI can be upgraded once fps is surfaced.
  const fps = 10
  video.currentTime = frameIndex / fps
  void video.play().catch(() => {})
}

function AlignedFramesTable({
  items,
  onSeek,
}: {
  items: ClipAlignedFrame[]
  onSeek: (frameIndex: number | null) => void
}) {
  return (
    <table style={{ width: '100%', fontSize: 12 }}>
      <thead>
        <tr style={{ textAlign: 'left', color: '#8c8c8c' }}>
          <th style={{ padding: '4px 8px' }}>Frame #</th>
          <th style={{ padding: '4px 8px' }}>Keyframe ts</th>
          <th style={{ padding: '4px 8px' }}>Video ts</th>
        </tr>
      </thead>
      <tbody>
        {items.map((row) => (
          <tr key={`${row.video_frame_index ?? ''}-${row.timestamp}`}>
            <td style={{ padding: '2px 8px' }}>
              <Button
                size="small"
                type="link"
                icon={<PlayCircleOutlined />}
                onClick={() => onSeek(row.video_frame_index)}
              >
                {row.video_frame_index ?? '—'}
              </Button>
            </td>
            <td style={{ padding: '2px 8px' }}>{formatTimestamp(row.timestamp)}</td>
            <td style={{ padding: '2px 8px' }}>{formatTimestamp(row.video_frame_timestamp)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Topic frames panel ──────────────────────────────────────────────────────

function TopicFramesPanel({
  clipId,
  topics,
  standalone,
}: {
  clipId: string
  topics: string[]
  standalone: string[]
}) {
  const options = useMemo(
    () => [
      ...topics.map((t) => ({ label: `topic.lance · ${t}`, value: `topic:${t}` })),
      ...standalone.map((t) => ({ label: `${t}.lance`, value: `standalone:${t}` })),
    ],
    [topics, standalone],
  )
  const [selected, setSelected] = useState<string>(options[0]?.value ?? '')

  useEffect(() => {
    if (!selected && options[0]) setSelected(options[0].value)
  }, [options, selected])

  const fetcher = useCallback(async () => {
    if (!selected) return { items: [], limit: 0, offset: 0 }
    const [kind, name] = selected.split(':')
    if (kind === 'topic') {
      return fetchClipFrames(clipId, { topic: name, limit: 20 })
    }
    return fetchStandaloneTopic(clipId, name, { limit: 20 })
  }, [clipId, selected])

  const cacheKey = `explorer:clip:${clipId}:rows:${selected}`
  const { data, state, error, refetch } = useQuery(fetcher, { cacheKey, isEmpty: (d) => d.items.length === 0 })

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Select
        size="small"
        style={{ minWidth: 360 }}
        value={selected}
        options={options}
        onChange={(v) => setSelected(v)}
      />
      {state === 'loading' && <Paragraph type="secondary">Loading rows…</Paragraph>}
      {state === 'error' && (
        <Alert
          type="error"
          message={error?.message ?? 'Failed'}
          action={<Button size="small" onClick={refetch}>Retry</Button>}
        />
      )}
      {state === 'empty' && <Empty description="No rows" />}
      {state === 'ready' && (
        <div style={{ display: 'grid', gap: 8 }}>
          {(data?.items ?? []).slice(0, 10).map((row, idx) => (
            <FramePreviewRow key={idx} row={row} />
          ))}
          {(data?.items?.length ?? 0) > 10 && (
            <Text type="secondary">Showing first 10 of {data?.items.length}</Text>
          )}
        </div>
      )}
    </Space>
  )
}

function FramePreviewRow({ row }: { row: ClipFrameRow }) {
  const timestamp = row['timestamp'] as number | undefined
  // Pick the first struct-shaped value to display.
  let topicName: string | null = null
  let payload: string | null = null
  for (const [k, v] of Object.entries(row)) {
    if (k === 'timestamp') continue
    if (v && typeof v === 'object' && 'data' in (v as Record<string, unknown>)) {
      topicName = k
      const inner = (v as Record<string, unknown>).data
      if (typeof inner === 'string') payload = inner
      break
    }
    if (k === 'data' && typeof v === 'string') {
      topicName = 'data'
      payload = v
      break
    }
  }
  return (
    <Card size="small">
      <div style={{ fontSize: 12, color: '#595959' }}>
        <strong>ts</strong> {timestamp ?? '—'} · <strong>{topicName ?? '(no topic payload)'}</strong>
      </div>
      {payload && (
        <pre
          style={{
            background: '#f5f5f5',
            padding: 8,
            borderRadius: 4,
            maxHeight: 160,
            overflow: 'auto',
            fontSize: 12,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {payload.slice(0, 800)}
          {payload.length > 800 ? '…' : ''}
        </pre>
      )}
    </Card>
  )
}

// ── Schema panel ────────────────────────────────────────────────────────────

function SchemaPanel({ summary }: { summary: ClipSummary }) {
  return (
    <Row gutter={16}>
      <Col xs={24} md={8}>
        <Card size="small" title={`topic.lance columns (${summary.topics.length})`}>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {summary.topics.map((t) => (
              <li key={t.name}>
                <Text code>{t.name}</Text>{' '}
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t.non_null_count} non-null
                </Text>
              </li>
            ))}
          </ul>
        </Card>
      </Col>
      <Col xs={24} md={8}>
        <Card size="small" title={`Camera index columns (${summary.cameras.length})`}>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {summary.cameras.map((c) => (
              <li key={c.name}>
                <Text code>{c.name}</Text>{' '}
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {c.frame_count} frames
                </Text>
              </li>
            ))}
          </ul>
        </Card>
      </Col>
      <Col xs={24} md={8}>
        <Card size="small" title={`Standalone tables (${summary.standalone_topics.length})`}>
          {summary.standalone_topics.length === 0 ? (
            <Empty description="None" />
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {summary.standalone_topics.map((s) => (
                <li key={s.name}>
                  <Text code>{s.name}.lance</Text>{' '}
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {s.row_count} rows
                  </Text>
                </li>
              ))}
            </ul>
          )}
          {summary.has_wm && (
            <div style={{ marginTop: 8 }}>
              <Tag color="orange">wm.lance present</Tag>
            </div>
          )}
        </Card>
      </Col>
    </Row>
  )
}
