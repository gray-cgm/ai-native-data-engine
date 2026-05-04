import { useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import {
  Button,
  Card,
  Col,
  Empty,
  Input,
  Row,
  Segmented,
  Space,
  Statistic,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import { AppstoreOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { PageError } from '@/shared/components/page-error'
import { DataTable } from '@/shared/components/data-table'
import { IdCell } from '@/shared/components/id-cell'
import { fetchClipDatasets, type ClipDataset } from '../clip-datasets'
import { listDatasets, type DatasetV2 } from '@/modules/datasets/datasets-api'
import { NewDatasetModal } from '@/modules/datasets/new-dataset-modal'

const { Text } = Typography

type View = 'datasets' | 'scenario'
type DatasetTab = 'customized' | 'official'

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
  const [searchParams, setSearchParams] = useSearchParams()
  const view = (searchParams.get('view') as View) || 'datasets'

  const setView = useCallback(
    (next: View) => {
      const params = new URLSearchParams(searchParams)
      if (next === 'datasets') params.delete('view')
      else params.set('view', next)
      setSearchParams(params, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  return (
    <PageContainer
      title="Catalog"
      actions={
        <Segmented
          value={view}
          onChange={(v) => setView(v as View)}
          options={[
            { label: 'Datasets', value: 'datasets' },
            { label: 'By scenario', value: 'scenario' },
          ]}
        />
      }
    >
      {view === 'datasets' ? <DatasetsView /> : <ScenarioView />}
    </PageContainer>
  )
}

// ─────────────────────────── Datasets v2 view ───────────────────────────

function DatasetsView() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<DatasetTab>('customized')
  const [keyword, setKeyword] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const fetcher = useCallback(
    () => listDatasets({ status: 'active', dataset_type: tab, limit: 200 }),
    [tab],
  )
  const { data, state, error, refetch } = useQuery(fetcher, {
    cacheKey: `catalog:datasets:v2:${tab}`,
    isEmpty: (d) => (d?.items ?? []).length === 0,
  })

  const filtered = useMemo<DatasetV2[]>(() => {
    const rows = data?.items ?? []
    if (!keyword) return rows
    const lower = keyword.toLowerCase()
    return rows.filter((d) =>
      [d.name, d.id, d.tag_expr ?? '', d.requirement_id ?? '', d.created_by]
        .join(' ')
        .toLowerCase()
        .includes(lower),
    )
  }, [data, keyword])

  if (state === 'loading') return <PageLoading message="Loading datasets…" />
  if (state === 'error') return <PageError message={error?.message} onRetry={refetch} />

  const customizedCount = tab === 'customized' ? data?.items.length ?? 0 : null
  const officialCount = tab === 'official' ? data?.items.length ?? 0 : null

  return (
    <>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title={`${tab === 'customized' ? 'Customized' : 'Official'} datasets`}
              value={data?.items.length ?? 0}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Trainable"
              value={(data?.items ?? []).filter((d) => d.allow_train).length}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Total samples (visible page)"
              value="—"
              valueStyle={{ color: '#bfbfbf' }}
            />
          </Card>
        </Col>
      </Row>

      <Tabs
        activeKey={tab}
        onChange={(k) => setTab(k as DatasetTab)}
        items={[
          {
            key: 'customized',
            label: `Customized${customizedCount != null ? ` (${customizedCount})` : ''}`,
          },
          {
            key: 'official',
            label: `Official${officialCount != null ? ` (${officialCount})` : ''}`,
          },
        ]}
      />

      <Card>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Search by name / id / tag_expr / requirement"
            prefix={<SearchOutlined />}
            allowClear
            size="large"
            style={{ width: 420 }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            New dataset
          </Button>
        </Space>

        {state === 'empty' ? (
          <Empty description={`No ${tab} datasets yet.`}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              Create first dataset
            </Button>
          </Empty>
        ) : (
          <DataTable<DatasetV2>
            rowHref={(row) => `/catalog/v2/${encodeURIComponent(row.id)}`}
            columns={[
              {
                key: 'name',
                header: 'Dataset',
                render: (row) => (
                  <div>
                    <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
                      <AppstoreOutlined style={{ marginRight: 6, color: 'var(--color-accent)' }} />
                      {row.name}
                    </span>
                    <div>
                      <IdCell value={row.id} />
                    </div>
                  </div>
                ),
              },
              {
                key: 'dataset_type',
                header: 'Type',
                render: (row) => (
                  <Tag color={row.dataset_type === 'official' ? 'blue' : 'default'}>
                    {row.dataset_type}
                  </Tag>
                ),
              },
              {
                key: 'dataset_version',
                header: 'Version',
                render: (row) => `v${row.dataset_version}`,
              },
              {
                key: 'allow_train',
                header: 'Trainable',
                render: (row) =>
                  row.allow_train ? <Tag color="green">yes</Tag> : <Tag>no</Tag>,
              },
              {
                key: 'slice_strategy',
                header: 'Slice',
                render: (row) => (
                  <Space size={4}>
                    <Tag>{row.slice_strategy}</Tag>
                    <Tag>{row.ts_policy}</Tag>
                  </Space>
                ),
              },
              {
                key: 'requirement_id',
                header: 'Requirement',
                render: (row) =>
                  row.requirement_id ? (
                    <span data-stop-row-click style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Link to={`/requirements/${row.requirement_id}`} style={{ fontFamily: 'monospace', fontSize: 12 }}>
                        {row.requirement_id.slice(0, 8)}…
                      </Link>
                      <Typography.Text copyable={{ text: row.requirement_id, tooltips: ['复制', '已复制'] }} />
                    </span>
                  ) : (
                    <Text type="secondary">—</Text>
                  ),
              },
              {
                key: 'tag_expr',
                header: 'Tag expr',
                render: (row) => (
                  <Text style={{ fontSize: 12 }} ellipsis>
                    {row.tag_expr ?? '—'}
                  </Text>
                ),
              },
              {
                key: 'created_at',
                header: 'Created',
                render: (row) =>
                  row.created_at ? new Date(row.created_at).toLocaleString() : '—',
              },
            ]}
            data={filtered}
            rowKey={(row) => row.id}
            emptyText={keyword ? 'No datasets matched your search.' : 'No datasets.'}
          />
        )}
      </Card>

      <NewDatasetModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultDatasetType={tab}
        onCreated={(ds) => {
          if (ds.dataset_type === tab) refetch()
          else setTab(ds.dataset_type)
          navigate(`/catalog/v2/${encodeURIComponent(ds.id)}`)
        }}
      />
    </>
  )
}

// ─────────────────────────── Scenario aggregate view ───────────────────────────

function ScenarioView() {
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
    <>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Scenarios" value={data?.length ?? 0} />
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
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Search by scenario / vehicle / city / tag"
          prefix={<SearchOutlined />}
          allowClear
          size="large"
          style={{ marginBottom: 16 }}
        />

        {state === 'empty' ? (
          <Empty description="No clips found." />
        ) : (
          <DataTable<ClipDataset>
            rowHref={(row) => `/catalog/${encodeURIComponent(row.dataset_id)}`}
            columns={[
              {
                key: 'name',
                header: 'Scenario bucket',
                render: (row: ClipDataset) => (
                  <div>
                    <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
                      <AppstoreOutlined style={{ marginRight: 6, color: 'var(--color-accent)' }} />
                      {row.name}
                    </span>
                    <div>
                      <IdCell value={row.dataset_id} />
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
            emptyText={keyword ? 'No scenarios matched.' : 'No scenarios.'}
          />
        )}
      </Card>
    </>
  )
}
