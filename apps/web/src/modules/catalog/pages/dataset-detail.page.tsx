import { useCallback, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Breadcrumb,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Input,
  Row,
  Segmented,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd'
import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  SearchOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { PageError } from '@/shared/components/page-error'
import { DataTable } from '@/shared/components/data-table'
import { fetchClipDatasetDetail, type ClipDatasetDetail } from '../clip-datasets'
import { buildClipVideoUrl, type ClipSummary } from '@/modules/explorer/clips-api'

const { Text, Paragraph } = Typography

type ViewMode = 'table' | 'wall'

function formatDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}m ${s}s`
}

function formatTs(ns: number | null): string {
  if (!ns) return '—'
  return new Date(ns / 1e6).toLocaleString()
}

export default function DatasetDetailPage() {
  const { datasetId } = useParams<{ datasetId: string }>()
  const decoded = datasetId ? decodeURIComponent(datasetId) : ''
  const fetcher = useCallback(() => fetchClipDatasetDetail(decoded), [decoded])
  const { data, state, error, refetch } = useQuery(fetcher, {
    cacheKey: `catalog:dataset:${decoded}`,
  })

  const [keyword, setKeyword] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('table')

  const filtered = useMemo<ClipSummary[]>(() => {
    const clips = data?.clips ?? []
    if (!keyword) return clips
    const lower = keyword.toLowerCase()
    return clips.filter((c) =>
      [c.clip_id, c.vehicle_name, c.city, c.district, c.scenario, c.tags, c.da_tags]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(lower),
    )
  }, [data, keyword])

  if (state === 'loading') return <PageLoading message="Loading dataset detail…" />
  if (state === 'error') return <PageError message={error?.message} onRetry={refetch} />
  if (!data) {
    return (
      <PageContainer title="Dataset not found">
        <Card>
          <Paragraph type="secondary">Dataset {decoded} not found.</Paragraph>
          <Link to="/catalog">
            <Button icon={<ArrowLeftOutlined />}>Back to Catalog</Button>
          </Link>
        </Card>
      </PageContainer>
    )
  }

  const { dataset, clips } = data as ClipDatasetDetail

  const searchHref = dataset.scenario
    ? `/explorer/search?scenario=${encodeURIComponent(dataset.scenario)}&dataset=${encodeURIComponent(dataset.dataset_id)}`
    : `/explorer/search?dataset=${encodeURIComponent(dataset.dataset_id)}`

  return (
    <PageContainer
      title={dataset.name}
      description={`Dataset ${dataset.dataset_id} · aggregates ${dataset.clip_count} clip(s) with ${dataset.keyframe_total.toLocaleString()} keyframes.`}
      actions={
        <Space>
          <Link to="/catalog">
            <Button icon={<ArrowLeftOutlined />}>Back</Button>
          </Link>
          <Link to={searchHref}>
            <Button type="primary" icon={<SearchOutlined />}>Search in Explorer</Button>
          </Link>
        </Space>
      }
    >
      <Breadcrumb
        style={{ marginBottom: 12 }}
        items={[
          { title: <Link to="/catalog">Catalog</Link> },
          { title: dataset.name },
        ]}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Clips" value={dataset.clip_count} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Keyframes" value={dataset.keyframe_total} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Recorded" value={formatDuration(dataset.duration_total_seconds)} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Vehicles" value={dataset.vehicle_names.length} />
          </Card>
        </Col>
      </Row>

      <Card title="Dataset profile" style={{ marginBottom: 16 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="Grouping">scenario</Descriptions.Item>
          <Descriptions.Item label="Scenario">
            {dataset.scenario ?? <Text type="secondary">unassigned</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="Vehicles" span={2}>
            {dataset.vehicle_names.length > 0 ? dataset.vehicle_names.join(', ') : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Cities" span={2}>
            {dataset.cities.length > 0 ? dataset.cities.join(', ') : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Tags" span={2}>
            {dataset.tags.length > 0 ? (
              dataset.tags.map((t) => <Tag key={t}>{t}</Tag>)
            ) : (
              <Text type="secondary">—</Text>
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        title={`Member clips (${clips.length})`}
        extra={
          <Segmented
            value={viewMode}
            onChange={(v) => setViewMode(v as ViewMode)}
            options={[
              { label: 'Table', value: 'table', icon: <UnorderedListOutlined /> },
              { label: 'Wall', value: 'wall', icon: <AppstoreOutlined /> },
            ]}
          />
        }
      >
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Search clip id / vehicle / city / tag…"
          prefix={<SearchOutlined />}
          allowClear
          style={{ marginBottom: 16, maxWidth: 420 }}
        />

        {clips.length === 0 ? (
          <Empty description="No clips in this dataset." />
        ) : viewMode === 'table' ? (
          <DataTable
            columns={[
              {
                key: 'clip_id',
                header: 'Clip',
                render: (row: ClipSummary) => (
                  <Link
                    to={`/explorer/clips/${encodeURIComponent(row.clip_id)}?dataset=${encodeURIComponent(dataset.dataset_id)}`}
                    style={{ fontFamily: 'monospace' }}
                  >
                    {row.clip_id}
                  </Link>
                ),
              },
              {
                key: 'vehicle_name',
                header: 'Vehicle / Location',
                render: (row: ClipSummary) => (
                  <div>
                    <div>{row.vehicle_name ?? '—'}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {[row.city, row.district].filter(Boolean).join(' / ') || '—'}
                    </Text>
                  </div>
                ),
              },
              {
                key: 'start_time',
                header: 'Recorded at',
                render: (row: ClipSummary) => formatTs(row.start_time),
              },
              {
                key: 'duration_seconds',
                header: 'Duration',
                render: (row: ClipSummary) => formatDuration(row.duration_seconds),
              },
              {
                key: 'keyframe_count',
                header: 'Keyframes',
                render: (row: ClipSummary) => row.keyframe_count,
              },
              {
                key: 'topics',
                header: 'Topics / Cameras',
                render: (row: ClipSummary) => (
                  <span>
                    <Tag color="blue">{row.topics.length} topics</Tag>
                    <Tag color="green">{row.cameras.length} cams</Tag>
                    {row.has_wm && <Tag color="orange">wm</Tag>}
                  </span>
                ),
              },
            ]}
            data={filtered}
            rowKey={(row) => row.clip_id}
            emptyText={keyword ? 'No clips matched your search.' : 'No clips available.'}
          />
        ) : (
          <ClipWall clips={filtered} datasetId={dataset.dataset_id} />
        )}
      </Card>
    </PageContainer>
  )
}

function ClipWall({ clips, datasetId }: { clips: ClipSummary[]; datasetId: string }) {
  if (clips.length === 0) return <Empty description="No clips." />
  return (
    <Row gutter={[16, 16]}>
      {clips.map((clip) => (
        <Col key={clip.clip_id} xs={24} sm={12} md={8} lg={6} xxl={4}>
          <ClipWallCard clip={clip} datasetId={datasetId} />
        </Col>
      ))}
    </Row>
  )
}

function ClipWallCard({ clip, datasetId }: { clip: ClipSummary; datasetId: string }) {
  const primaryCamera = clip.cameras[0]?.name ?? null
  const videoUrl = primaryCamera ? buildClipVideoUrl(clip.clip_id, primaryCamera) : null
  const [failed, setFailed] = useState(false)
  return (
    <Link
      to={`/explorer/clips/${encodeURIComponent(clip.clip_id)}?dataset=${encodeURIComponent(datasetId)}`}
      style={{ color: 'inherit' }}
    >
      <Card
        hoverable
        size="small"
        styles={{ body: { padding: 12 } }}
        cover={
          <div
            style={{
              aspectRatio: '16 / 9',
              background: '#000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#bfbfbf',
              fontSize: 12,
              overflow: 'hidden',
            }}
          >
            {videoUrl && !failed ? (
              <video
                src={videoUrl}
                muted
                playsInline
                preload="metadata"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={() => setFailed(true)}
                onMouseEnter={(e) => {
                  void (e.currentTarget as HTMLVideoElement).play().catch(() => {})
                }}
                onMouseLeave={(e) => {
                  const v = e.currentTarget as HTMLVideoElement
                  v.pause()
                  v.currentTime = 0
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: 12 }}>
                <AppstoreOutlined style={{ fontSize: 28, display: 'block', marginBottom: 4 }} />
                No thumbnail cached
              </div>
            )}
          </div>
        }
      >
        <div style={{ fontFamily: 'monospace', fontSize: 12 }}>{clip.clip_id}</div>
        <div>
          <Text strong>{clip.vehicle_name ?? '—'}</Text>
          <Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>
            {[clip.city, clip.district].filter(Boolean).join(' / ') || '—'}
          </Text>
        </div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {formatTs(clip.start_time)} · {formatDuration(clip.duration_seconds)}
        </Text>
      </Card>
    </Link>
  )
}
