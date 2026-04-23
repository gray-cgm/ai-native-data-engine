import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppstoreOutlined } from '@ant-design/icons'
import { Card, Col, Row, Tag, Typography } from 'antd'
import { DataTable } from '@/shared/components/data-table'
import { buildClipVideoUrl, type ClipSummary } from '../clips-api'

const { Text } = Typography

export type ClipResultViewMode = 'table' | 'wall'

type ClipTableProps = {
  items: ClipSummary[]
  emptyText: string
  detailHref?: (clip: ClipSummary) => string
}

type ClipWallProps = {
  items: ClipSummary[]
  emptyText: string
  detailHref?: (clip: ClipSummary) => string
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}m ${s}s`
}

export function formatTimestamp(ns: number | null): string {
  if (!ns) return '—'
  return new Date(ns / 1e6).toLocaleString()
}

export function splitTags(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

export function ClipResultTable({ items, emptyText, detailHref }: ClipTableProps) {
  return (
    <DataTable
      columns={[
        {
          key: 'clip_id',
          header: 'Clip',
          render: (row: ClipSummary) => {
            const href = detailHref ? detailHref(row) : `/explorer/clips/${encodeURIComponent(row.clip_id)}`
            return (
              <div>
                <Link to={href} style={{ fontFamily: 'monospace' }}>
                  {row.clip_id}
                </Link>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {formatTimestamp(row.start_time)}
                  </Text>
                </div>
              </div>
            )
          },
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
        { key: 'scenario', header: 'Scenario', render: (row: ClipSummary) => row.scenario ?? '—' },
        {
          key: 'keyframe_count',
          header: 'Keyframes / Duration',
          render: (row: ClipSummary) => (
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
          render: (row: ClipSummary) => (
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
          render: (row: ClipSummary) => (
            <span>
              {splitTags(row.tags)
                .slice(0, 4)
                .map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              {splitTags(row.tags).length > 4 && <Tag>+{splitTags(row.tags).length - 4}</Tag>}
              {row.da_tags && <Tag color="gold">{row.da_tags}</Tag>}
            </span>
          ),
        },
      ]}
      data={items}
      rowKey={(row) => row.clip_id}
      emptyText={emptyText}
    />
  )
}

export function ClipResultWall({ items, emptyText, detailHref }: ClipWallProps) {
  if (items.length === 0) {
    return <Text type="secondary">{emptyText}</Text>
  }
  return (
    <Row gutter={[16, 16]}>
      {items.map((row) => (
        <Col key={row.clip_id} xs={24} sm={12} md={8} lg={6} xxl={4}>
          <ClipWallCard row={row} detailHref={detailHref} />
        </Col>
      ))}
    </Row>
  )
}

function ClipWallCard({ row, detailHref }: { row: ClipSummary; detailHref?: (clip: ClipSummary) => string }) {
  const primaryCamera = row.cameras[0]?.name ?? null
  const previewUrl = primaryCamera ? buildClipVideoUrl(row.clip_id, primaryCamera) : null
  const [videoFailed, setVideoFailed] = useState(false)
  const tags = splitTags(row.tags)
  const href = detailHref ? detailHref(row) : `/explorer/clips/${encodeURIComponent(row.clip_id)}`

  return (
    <Link to={href} style={{ color: 'inherit' }}>
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
                {primaryCamera ? <div style={{ fontSize: 11, marginTop: 2 }}>({primaryCamera})</div> : null}
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
