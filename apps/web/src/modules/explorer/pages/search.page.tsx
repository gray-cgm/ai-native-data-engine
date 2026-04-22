import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  BarChartOutlined,
  BulbOutlined,
  ExperimentOutlined,
  FilterOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { PageError } from '@/shared/components/page-error'
import { DataTable } from '@/shared/components/data-table'
import { fetchClips, type ClipSummary } from '../clips-api'

const { Text, Paragraph } = Typography

type FilterState = {
  naturalLanguage: string
  keyword: string
  scenario: string | null
  vehicle: string | null
  city: string | null
  tags: string[]
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}m ${s}s`
}

function formatTs(ns: number | null): string {
  if (!ns) return '—'
  return new Date(ns / 1e6).toLocaleString()
}

function splitTags(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw.split(',').map((t) => t.trim()).filter(Boolean)
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const initial: FilterState = useMemo(
    () => ({
      naturalLanguage: searchParams.get('q') ?? '',
      keyword: searchParams.get('keyword') ?? '',
      scenario: searchParams.get('scenario'),
      vehicle: searchParams.get('vehicle'),
      city: searchParams.get('city'),
      tags: (searchParams.get('tags') ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    }),
    [searchParams],
  )

  const [filters, setFilters] = useState<FilterState>(initial)

  useEffect(() => {
    setFilters(initial)
  }, [initial])

  const fetcher = useCallback(() => fetchClips(), [])
  const { data, state, error, refetch } = useQuery(fetcher, {
    cacheKey: 'explorer:search:clips',
    isEmpty: (d) => (d.items?.length ?? 0) === 0,
  })

  const clips: ClipSummary[] = data?.items ?? []

  const scenarioOptions = useMemo(
    () =>
      Array.from(new Set(clips.map((c) => c.scenario).filter((s): s is string => !!s))).sort(),
    [clips],
  )
  const vehicleOptions = useMemo(
    () =>
      Array.from(new Set(clips.map((c) => c.vehicle_name).filter((v): v is string => !!v))).sort(),
    [clips],
  )
  const cityOptions = useMemo(
    () => Array.from(new Set(clips.map((c) => c.city).filter((v): v is string => !!v))).sort(),
    [clips],
  )
  const tagOptions = useMemo(
    () =>
      Array.from(new Set(clips.flatMap((c) => splitTags(c.tags)))).sort(),
    [clips],
  )

  const filtered = useMemo<ClipSummary[]>(() => {
    return clips.filter((c) => {
      if (filters.scenario && c.scenario !== filters.scenario) return false
      if (filters.vehicle && c.vehicle_name !== filters.vehicle) return false
      if (filters.city && c.city !== filters.city) return false
      if (filters.tags.length > 0) {
        const clipTags = new Set(splitTags(c.tags))
        if (!filters.tags.every((t) => clipTags.has(t))) return false
      }
      if (filters.keyword) {
        const lower = filters.keyword.toLowerCase()
        const hay = [
          c.clip_id,
          c.vehicle_name,
          c.city,
          c.district,
          c.scenario,
          c.tags,
          c.da_tags,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(lower)) return false
      }
      return true
    })
  }, [clips, filters])

  const activeFilterCount =
    (filters.scenario ? 1 : 0) +
    (filters.vehicle ? 1 : 0) +
    (filters.city ? 1 : 0) +
    (filters.tags.length > 0 ? 1 : 0) +
    (filters.keyword ? 1 : 0)

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  function syncUrl(next: FilterState) {
    const params = new URLSearchParams()
    if (next.naturalLanguage) params.set('q', next.naturalLanguage)
    if (next.keyword) params.set('keyword', next.keyword)
    if (next.scenario) params.set('scenario', next.scenario)
    if (next.vehicle) params.set('vehicle', next.vehicle)
    if (next.city) params.set('city', next.city)
    if (next.tags.length > 0) params.set('tags', next.tags.join(','))
    setSearchParams(params, { replace: true })
  }

  function handleRunSearch() {
    syncUrl(filters)
  }

  function handleReset() {
    const empty: FilterState = {
      naturalLanguage: '',
      keyword: '',
      scenario: null,
      vehicle: null,
      city: null,
      tags: [],
    }
    setFilters(empty)
    syncUrl(empty)
  }

  const fromDataset = searchParams.get('dataset')
  const fromRequirement = searchParams.get('requirement')
  const miningHref = useMemo(() => {
    const params = new URLSearchParams()
    if (fromRequirement) params.set('requirement', fromRequirement)
    if (fromDataset) params.set('dataset', fromDataset)
    if (filters.scenario) params.set('scenario', filters.scenario)
    const q = [filters.naturalLanguage, filters.keyword, ...filters.tags].filter(Boolean).join(' ')
    if (q) params.set('q', q)
    return `/ops/mining?${params.toString()}`
  }, [fromRequirement, fromDataset, filters.scenario, filters.naturalLanguage, filters.keyword, filters.tags])

  if (state === 'loading') return <PageLoading message="Loading clips…" />
  if (state === 'error') return <PageError message={error?.message} onRetry={refetch} />

  return (
    <PageContainer
      title="Explorer · Search"
      description="Scalar + vector (natural language) search over clips. Find recordings by scenario, vehicle, tags, or describe what you need in plain English."
      actions={
        <Space>
          <Link to="/explorer">
            <Button icon={<BarChartOutlined />}>Distribution</Button>
          </Link>
          <Link to="/explorer/clips">
            <Button icon={<VideoCameraOutlined />}>All clips</Button>
          </Link>
          <Link to={miningHref}>
            <Button icon={<ExperimentOutlined />}>Open mining</Button>
          </Link>
        </Space>
      }
    >
      <Breadcrumb
        style={{ marginBottom: 12 }}
        items={[
          ...(fromRequirement
            ? [
                { title: <Link to="/requirements">Requirements</Link> },
                { title: <Link to={`/requirements/${fromRequirement}`}>{fromRequirement.slice(0, 8)}…</Link> },
              ]
            : []),
          ...(fromDataset
            ? [
                { title: <Link to="/catalog">Catalog</Link> },
                { title: <Link to={`/catalog/${encodeURIComponent(fromDataset)}`}>{fromDataset}</Link> },
              ]
            : []),
          { title: 'Search' },
        ]}
      />

      <Card style={{ marginBottom: 16 }}>
        <Alert
          style={{ marginBottom: 16 }}
          type="info"
          showIcon
          icon={<BulbOutlined />}
          message="Search using natural language (preview)"
          description={
            <Text type="secondary">
              Describe what you want, e.g. “highway night scenes where the ego vehicle changes lane
              to the right”. Vector/semantic search is not wired to a backend yet — your query is
              stored and combined with the scalar filters below, so results stay scalar for now.
            </Text>
          }
        />
        <Input.Search
          value={filters.naturalLanguage}
          onChange={(e) => updateFilter('naturalLanguage', e.target.value)}
          onSearch={handleRunSearch}
          placeholder="Search using natural language — e.g. 'night intersection with VRU close-cut'"
          enterButton={
            <Button type="primary" icon={<ThunderboltOutlined />}>
              Search
            </Button>
          }
          size="large"
          allowClear
          prefix={<SearchOutlined />}
        />
        <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>
          <Badge status="processing" text="Vector backend: not connected" /> &nbsp;— queries are
          resolved via scalar filters only until an embedding index is wired up.
        </Paragraph>
      </Card>

      <Card
        title={
          <Space>
            <FilterOutlined />
            Scalar filters
            {activeFilterCount > 0 && <Tag color="blue">{activeFilterCount} active</Tag>}
          </Space>
        }
        extra={
          <Space>
            <Button onClick={handleReset}>Reset</Button>
            <Button type="primary" onClick={handleRunSearch} icon={<SearchOutlined />}>
              Apply
            </Button>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Keyword (clip_id / free text)
            </Text>
            <Input
              value={filters.keyword}
              onChange={(e) => updateFilter('keyword', e.target.value)}
              placeholder="free-text match across clip fields"
              allowClear
            />
          </Col>
          <Col xs={24} md={8}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Scenario
            </Text>
            <Select
              value={filters.scenario ?? undefined}
              onChange={(v) => updateFilter('scenario', v ?? null)}
              placeholder="any"
              allowClear
              style={{ width: '100%' }}
              options={scenarioOptions.map((s) => ({ value: s, label: s }))}
            />
          </Col>
          <Col xs={24} md={8}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Vehicle
            </Text>
            <Select
              value={filters.vehicle ?? undefined}
              onChange={(v) => updateFilter('vehicle', v ?? null)}
              placeholder="any"
              allowClear
              style={{ width: '100%' }}
              options={vehicleOptions.map((s) => ({ value: s, label: s }))}
            />
          </Col>
          <Col xs={24} md={8}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              City
            </Text>
            <Select
              value={filters.city ?? undefined}
              onChange={(v) => updateFilter('city', v ?? null)}
              placeholder="any"
              allowClear
              style={{ width: '100%' }}
              options={cityOptions.map((s) => ({ value: s, label: s }))}
            />
          </Col>
          <Col xs={24} md={16}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Tags (AND)
            </Text>
            <Select
              mode="multiple"
              value={filters.tags}
              onChange={(v) => updateFilter('tags', v)}
              placeholder="pick one or more scene tags"
              style={{ width: '100%' }}
              options={tagOptions.map((s) => ({ value: s, label: s }))}
              maxTagCount="responsive"
            />
          </Col>
        </Row>
      </Card>

      <Card title={`Results (${filtered.length} / ${clips.length})`}>
        {state === 'empty' ? (
          <Empty description="No clips ingested yet. Run make ingest first." />
        ) : filtered.length === 0 ? (
          <Empty description="No clips matched your filters." />
        ) : (
          <DataTable
            columns={[
              {
                key: 'clip_id',
                header: 'Clip',
                render: (row: ClipSummary) => (
                  <div>
                    <Tooltip title="Open clip detail">
                      <span
                        role="link"
                        style={{
                          cursor: 'pointer',
                          color: 'var(--color-accent, #1677ff)',
                          fontFamily: 'monospace',
                        }}
                        onClick={() =>
                          navigate(
                            `/explorer/clips/${encodeURIComponent(row.clip_id)}${
                              fromDataset
                                ? `?dataset=${encodeURIComponent(fromDataset)}`
                                : ''
                            }`,
                          )
                        }
                      >
                        {row.clip_id}
                      </span>
                    </Tooltip>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {formatTs(row.start_time)}
                      </Text>
                    </div>
                  </div>
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
                key: 'scenario',
                header: 'Scenario',
                render: (row: ClipSummary) => row.scenario ?? '—',
              },
              {
                key: 'duration_seconds',
                header: 'Duration',
                render: (row: ClipSummary) => formatDuration(row.duration_seconds),
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
                    {row.da_tags && <Tag color="gold">{row.da_tags}</Tag>}
                  </span>
                ),
              },
            ]}
            data={filtered}
            rowKey={(row) => row.clip_id}
            emptyText="No clips matched."
          />
        )}
      </Card>
    </PageContainer>
  )
}
