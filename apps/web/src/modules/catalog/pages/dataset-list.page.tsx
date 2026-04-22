import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Col, Input, Row, Statistic, Tag, Typography } from 'antd'
import { AppstoreOutlined, SearchOutlined } from '@ant-design/icons'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { PageError } from '@/shared/components/page-error'
import { DataTable } from '@/shared/components/data-table'
import { fetchClipDatasets, type ClipDataset } from '../clip-datasets'

const { Text, Paragraph } = Typography

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  if (m >= 60) {
    const h = Math.floor(m / 60)
    return `${h}h ${m % 60}m`
  }
  return `${m}m ${s}s`
}

export default function DatasetListPage() {
  const [keyword, setKeyword] = useState('')
  const fetcher = useCallback(() => fetchClipDatasets(), [])
  const { data, state, error, refetch } = useQuery(fetcher, {
    isEmpty: (d) => (d as ClipDataset[]).length === 0,
    cacheKey: 'catalog:clip-datasets',
  })

  const filtered = useMemo<ClipDataset[]>(() => {
    const rows = data ?? []
    if (!keyword) return rows
    const lower = keyword.toLowerCase()
    return rows.filter((d) =>
      [
        d.name,
        d.scenario ?? '',
        d.dataset_id,
        d.vehicle_names.join(' '),
        d.cities.join(' '),
        d.tags.join(' '),
      ]
        .join(' ')
        .toLowerCase()
        .includes(lower),
    )
  }, [data, keyword])

  if (state === 'loading') return <PageLoading message="Aggregating datasets from clips…" />
  if (state === 'error') return <PageError message={error?.message} onRetry={refetch} />

  const totalClips = (data ?? []).reduce((s, d) => s + d.clip_count, 0)
  const totalKeyframes = (data ?? []).reduce((s, d) => s + d.keyframe_total, 0)
  const totalDuration = (data ?? []).reduce((s, d) => s + d.duration_total_seconds, 0)

  return (
    <PageContainer
      title="Catalog · Datasets"
      description="Clip-centric datasets aggregated by scenario. Drill down to see member clips, jump into Explorer to search, or roll up from a single clip back to its dataset."
    >
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Datasets" value={data?.length ?? 0} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Clips" value={totalClips} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Keyframes" value={totalKeyframes} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Recorded" value={formatDuration(totalDuration)} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Paragraph type="secondary" style={{ marginBottom: 12 }}>
          Grouping key: <Text code>scenario</Text>. Each row aggregates the clips that share the
          same <Text code>meta.scenario</Text>; clips without a scenario fall into a single
          <Text code> unassigned</Text> bucket.
        </Paragraph>

        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Search datasets by scenario / vehicle / city / tag"
          prefix={<SearchOutlined />}
          allowClear
          size="large"
          style={{ marginBottom: 16 }}
        />

        {state === 'empty' ? (
          <Text type="secondary">
            No clips found under data/lance/. Run <Text code>make ingest</Text> after copying clip
            data into that directory.
          </Text>
        ) : (
          <DataTable
            columns={[
              {
                key: 'name',
                header: 'Dataset',
                render: (row: ClipDataset) => (
                  <div>
                    <Link
                      to={`/catalog/${encodeURIComponent(row.dataset_id)}`}
                      style={{ fontWeight: 500 }}
                    >
                      <AppstoreOutlined style={{ marginRight: 6 }} />
                      {row.name}
                    </Link>
                    <div>
                      <Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 12 }}>
                        {row.dataset_id}
                      </Text>
                    </div>
                  </div>
                ),
              },
              {
                key: 'clip_count',
                header: 'Clips',
                render: (row: ClipDataset) => (
                  <span>
                    {row.clip_count}
                    <Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>
                      · {row.keyframe_total.toLocaleString()} kf
                    </Text>
                  </span>
                ),
              },
              {
                key: 'duration_total_seconds',
                header: 'Duration',
                render: (row: ClipDataset) => formatDuration(row.duration_total_seconds),
              },
              {
                key: 'vehicle_names',
                header: 'Vehicles',
                render: (row: ClipDataset) =>
                  row.vehicle_names.length > 0
                    ? row.vehicle_names.slice(0, 3).join(', ') +
                      (row.vehicle_names.length > 3 ? ` +${row.vehicle_names.length - 3}` : '')
                    : '—',
              },
              {
                key: 'cities',
                header: 'Cities',
                render: (row: ClipDataset) =>
                  row.cities.length > 0
                    ? row.cities.slice(0, 3).join(', ') +
                      (row.cities.length > 3 ? ` +${row.cities.length - 3}` : '')
                    : '—',
              },
              {
                key: 'tags',
                header: 'Tags',
                render: (row: ClipDataset) => (
                  <span>
                    {row.tags.slice(0, 5).map((t) => (
                      <Tag key={t}>{t}</Tag>
                    ))}
                    {row.tags.length > 5 && <Tag>+{row.tags.length - 5}</Tag>}
                  </span>
                ),
              },
            ]}
            data={filtered}
            rowKey={(row) => row.dataset_id}
            emptyText={keyword ? 'No datasets matched your search.' : 'No datasets available.'}
          />
        )}
      </Card>
    </PageContainer>
  )
}
