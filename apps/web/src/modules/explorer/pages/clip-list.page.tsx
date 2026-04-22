import { useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Breadcrumb, Card, Input, Segmented, Space, Tag, Typography, Row, Col, Statistic } from 'antd'
import { AppstoreOutlined, SearchOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { PageError } from '@/shared/components/page-error'
import { DataTable } from '@/shared/components/data-table'
import { buildClipVideoUrl, fetchClips, type ClipSummary } from '../clips-api'

const { Text } = Typography

type ViewMode = 'table' | 'wall'
const VIEW_MODE_KEY = 'explorer:clips:view-mode'

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

export default function ClipListPage() {
  const [searchParams] = useSearchParams()
  const scopeScenario = searchParams.get('scenario')
  const scopeDataset = searchParams.get('dataset')
  const [keyword, setKeyword] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'table'
    const saved = window.localStorage.getItem(VIEW_MODE_KEY)
    return saved === 'wall' ? 'wall' : 'table'
  })
  const handleViewModeChange = (value: string | number) => {
    const next = (value as ViewMode) === 'wall' ? 'wall' : 'table'
    setViewMode(next)
    if (typeof window !== 'undefined') window.localStorage.setItem(VIEW_MODE_KEY, next)
  }

  const fetcher = useCallback(() => fetchClips(), [])
  const { data, state, error, refetch } = useQuery(fetcher, {
    isEmpty: (d) => (d.items?.length ?? 0) === 0,
    cacheKey: 'explorer:clips',
  })

  const filtered = useMemo<ClipSummary[]>(() => {
    let rows = data?.items ?? []
    if (scopeScenario) rows = rows.filter((r) => r.scenario === scopeScenario)
    if (!keyword) return rows
    const lower = keyword.toLowerCase()
    return rows.filter((row) =>
      [row.clip_id, row.vehicle_name, row.city, row.district, row.scenario, row.tags, row.da_tags]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(lower),
    )
  }, [data, keyword, scopeScenario])

  if (state === 'loading') return <PageLoading message="Discovering clips under data/lance…" />
  if (state === 'error') return <PageError message={error?.message} onRetry={refetch} />

  const totalKeyframes = (data?.items ?? []).reduce((s, c) => s + (c.keyframe_count || 0), 0)
  const totalDuration = (data?.items ?? []).reduce((s, c) => s + (c.duration_seconds || 0), 0)

  return (
    <PageContainer
      title={scopeScenario ? `Clips · scenario: ${scopeScenario}` : 'Clip Explorer'}
      description="Clip-centric Lance datasets discovered under data/lance/. Each clip is a recorded drive segment with meta, aligned topic frames and per-camera video indices."
    >
      {(scopeDataset || scopeScenario) && (
        <Breadcrumb
          style={{ marginBottom: 12 }}
          items={[
            ...(scopeDataset
              ? [
                  { title: <Link to="/catalog">Catalog</Link> },
                  {
                    title: (
                      <Link to={`/catalog/${encodeURIComponent(scopeDataset)}`}>{scopeDataset}</Link>
                    ),
                  },
                ]
              : []),
            { title: scopeScenario ? `Clips (${scopeScenario})` : 'Clips' },
          ]}
        />
      )}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Clips" value={data?.items?.length ?? 0} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Total keyframes" value={totalKeyframes} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Total recorded" value={formatDuration(totalDuration)} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space
          style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}
          size="middle"
          wrap
        >
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Search by clip id / vehicle / city / scenario / tags"
            prefix={<SearchOutlined />}
            allowClear
            size="large"
            style={{ width: 420, maxWidth: '100%' }}
          />
          <Segmented
            value={viewMode}
            onChange={handleViewModeChange}
            options={[
              { label: 'Table', value: 'table', icon: <UnorderedListOutlined /> },
              { label: 'Wall', value: 'wall', icon: <AppstoreOutlined /> },
            ]}
          />
        </Space>

        {state === 'empty' ? (
          <Text type="secondary">
            No clips found under data/lance/. Run `make ingest` after copying clip data into that directory.
          </Text>
        ) : viewMode === 'table' ? (
          <DataTable
            columns={[
              {
                key: 'clip_id',
                header: 'Clip',
                render: (row) => (
                  <div>
                    <Link to={`/explorer/clips/${row.clip_id}`} style={{ fontFamily: 'monospace' }}>
                      {row.clip_id}
                    </Link>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {formatTimestamp(row.start_time)}
                      </Text>
                    </div>
                  </div>
                ),
              },
              {
                key: 'vehicle_name',
                header: 'Vehicle / Location',
                render: (row) => (
                  <div>
                    <div>{row.vehicle_name ?? '—'}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {[row.city, row.district].filter(Boolean).join(' / ') || '—'}
                    </Text>
                  </div>
                ),
              },
              { key: 'scenario', header: 'Scenario', render: (row) => row.scenario ?? '—' },
              {
                key: 'keyframe_count',
                header: 'Keyframes',
                render: (row) => (
                  <span>
                    {row.keyframe_count}{' '}
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      · {formatDuration(row.duration_seconds)}
                    </Text>
                  </span>
                ),
              },
              {
                key: 'topics',
                header: 'Topics / Cameras',
                render: (row) => (
                  <span>
                    <Tag color="blue">{row.topics.length} topics</Tag>
                    <Tag color="green">{row.cameras.length} cams</Tag>
                    {row.standalone_topics.length > 0 && (
                      <Tag color="purple">{row.standalone_topics.length} standalone</Tag>
                    )}
                    {row.has_wm && <Tag color="orange">wm</Tag>}
                  </span>
                ),
              },
              {
                key: 'tags',
                header: 'Tags',
                render: (row) => (
                  <span>
                    {(row.tags ?? '').split(',').filter(Boolean).map((t) => (
                      <Tag key={t}>{t}</Tag>
                    ))}
                    {row.da_tags && <Tag color="gold">{row.da_tags}</Tag>}
                  </span>
                ),
              },
            ]}
            data={filtered}
            rowKey={(row) => row.clip_id}
            emptyText={keyword ? 'No clips matched your search.' : 'No clips available.'}
          />
        ) : (
          <ClipWall items={filtered} keyword={keyword} />
        )}
      </Card>
    </PageContainer>
  )
}

function ClipWall({ items, keyword }: { items: ClipSummary[]; keyword: string }) {
  if (items.length === 0) {
    return (
      <Text type="secondary">
        {keyword ? 'No clips matched your search.' : 'No clips available.'}
      </Text>
    )
  }
  return (
    <Row gutter={[16, 16]}>
      {items.map((row) => (
        <Col key={row.clip_id} xs={24} sm={12} md={8} lg={6} xxl={4}>
          <ClipWallCard row={row} />
        </Col>
      ))}
    </Row>
  )
}

function ClipWallCard({ row }: { row: ClipSummary }) {
  const primaryCamera = row.cameras[0]?.name ?? null
  const previewUrl = primaryCamera ? buildClipVideoUrl(row.clip_id, primaryCamera) : null
  const [videoFailed, setVideoFailed] = useState(false)
  const tags = (row.tags ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return (
    <Link to={`/explorer/clips/${row.clip_id}`} style={{ color: 'inherit' }}>
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
            {previewUrl && !videoFailed ? (
              <video
                src={previewUrl}
                muted
                playsInline
                preload="metadata"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={() => setVideoFailed(true)}
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
                {primaryCamera ? (
                  <div style={{ fontSize: 11, marginTop: 2 }}>({primaryCamera})</div>
                ) : null}
              </div>
            )}
          </div>
        }
      >
        <div style={{ fontFamily: 'monospace', fontSize: 12, marginBottom: 4 }}>{row.clip_id}</div>
        <div>
          <Text strong>{row.vehicle_name ?? '—'}</Text>
          <Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>
            {[row.city, row.district].filter(Boolean).join(' / ') || '—'}
          </Text>
        </div>
        <div style={{ marginTop: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {formatTimestamp(row.start_time)} · {formatDuration(row.duration_seconds)}
          </Text>
        </div>
        <div style={{ marginTop: 6 }}>
          <Tag color="blue">{row.topics.length} topics</Tag>
          <Tag color="green">{row.cameras.length} cams</Tag>
          {row.has_wm && <Tag color="orange">wm</Tag>}
        </div>
        {tags.length > 0 && (
          <div style={{ marginTop: 6 }}>
            {tags.slice(0, 4).map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
            {tags.length > 4 && <Tag>+{tags.length - 4}</Tag>}
          </div>
        )}
      </Card>
    </Link>
  )
}
