import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Pagination, Space, Tag, Tooltip } from 'antd'
import { BarChartOutlined, ExperimentOutlined, SearchOutlined } from '@ant-design/icons'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { PageError } from '@/shared/components/page-error'
import { DataTable } from '@/shared/components/data-table'
import { StatusBadge } from '@/shared/components/status-badge'
import { RequirementStatsBar } from '../components/requirement-stats'
import { RequirementFilters } from '../components/requirement-filters'
import { fetchRequirements, fetchRequirementStats } from '../api'
import type { RequirementListItem, RequirementStats } from '../api'

const PRIORITY_TAG_COLORS: Record<string, string> = {
  high: 'red',
  medium: 'orange',
  low: 'blue',
}

export default function RequirementListPage() {
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)

  const listFetcher = useCallback(
    () => fetchRequirements({ status: status || undefined, priority: priority || undefined, keyword: keyword || undefined, page, pageSize: 20 }),
    [status, priority, keyword, page],
  )

  const statsFetcher = useCallback(() => fetchRequirementStats(), [])

  const { data: listData, state: listState, error: listError, refetch: refetchList } = useQuery(listFetcher, {
    isEmpty: (d) => {
      const payload = d as { items?: unknown[] }
      return (payload?.items?.length ?? 0) === 0
    },
    // cacheKey 必须纳入所有筛选条件，否则改 status/priority/keyword/page 不会触发 refetch
    // （useQuery 仅在 cacheKey 变化时重取）。对齐 ops-module-list-page 的动态 key 模式。
    cacheKey: `requirements:${status}:${priority}:${keyword}:${page}`,
  })

  const { data: statsData } = useQuery(statsFetcher, { cacheKey: 'requirement-stats' })

  const items = listData?.items ?? []
  const total = listData?.total ?? 0

  // 整页 loader 只在首次加载（尚无数据）时显示；筛选变化触发的后台 refetch
  // 保留已有表格与筛选框，避免每次输入都把整页闪成 loading。
  if (listState === 'loading' && !listData) {
    return <PageLoading message="Loading requirements..." />
  }

  if (listState === 'error') {
    return <PageError message={listError?.message} onRetry={refetchList} />
  }

  return (
    <PageContainer
      title="Requirements"
      description="Data-loop requirement management — track demand, tasks, and sign-off."
    >
      {statsData && <RequirementStatsBar stats={statsData} />}

      <Card>
        <RequirementFilters
          status={status}
          priority={priority}
          keyword={keyword}
          onStatusChange={(v) => { setStatus(v); setPage(1) }}
          onPriorityChange={(v) => { setPriority(v); setPage(1) }}
          onKeywordChange={(v) => { setKeyword(v); setPage(1) }}
        />

        {listState === 'empty' ? (
          <p className="text-muted">No requirements found. Create one to get started.</p>
        ) : (
          <>
            <DataTable<RequirementListItem>
              rowHref={(row) => `/requirements/${row.id}`}
              columns={[
                {
                  key: 'title',
                  header: 'Title',
                  render: (row: RequirementListItem) => (
                    <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
                      {row.title}
                    </span>
                  ),
                },
                { key: 'source', header: 'Source' },
                {
                  key: 'priority',
                  header: 'Priority',
                  render: (row: RequirementListItem) => (
                    <Tag color={PRIORITY_TAG_COLORS[row.priority] ?? 'default'}>
                      {row.priority}
                    </Tag>
                  ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (row: RequirementListItem) => <StatusBadge status={row.status} />,
                },
                {
                  key: 'scene_tags',
                  header: 'Scene Tags',
                  render: (row: RequirementListItem) => (
                    <span>
                      {(row.scene_tags ?? []).map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </span>
                  ),
                },
                { key: 'task_count', header: 'Tasks' },
                {
                  key: 'created_at',
                  header: 'Created',
                  render: (row: RequirementListItem) =>
                    new Date(row.created_at).toLocaleDateString(),
                },
                {
                  key: '_drilldown',
                  header: 'Actions',
                  render: (row: RequirementListItem) => {
                    const params = new URLSearchParams()
                    params.set('requirement', row.id)
                    const sceneTags = (row.scene_tags ?? []).filter(Boolean)
                    if (sceneTags.length > 0) params.set('tags', sceneTags.join(','))
                    if (row.title) params.set('q', row.title)
                    const miningParams = new URLSearchParams()
                    miningParams.set('requirement', row.id)
                    if (row.title) miningParams.set('q', row.title)
                    if (sceneTags.length > 0) miningParams.set('q', `${row.title} ${sceneTags.join(' ')}`.trim())
                    return (
                      <Space>
                        <Tooltip title="Search matching clips">
                          <Link to={`/explorer/search?${params.toString()}`}>
                            <Button size="small" icon={<SearchOutlined />}>
                              Find clips
                            </Button>
                          </Link>
                        </Tooltip>
                        <Tooltip title="Create/track mining candidate sets for this requirement">
                          <Link to={`/ops/mining?${miningParams.toString()}`}>
                            <Button size="small" icon={<ExperimentOutlined />}>
                              Open mining
                            </Button>
                          </Link>
                        </Tooltip>
                        <Tooltip title="Open aggregated requirement report (result + cost)">
                          <Link to={`/requirements/${row.id}/report`}>
                            <Button size="small" icon={<BarChartOutlined />}>
                              Open report
                            </Button>
                          </Link>
                        </Tooltip>
                      </Space>
                    )
                  },
                },
              ]}
              data={items}
              rowKey={(row) => row.id}
              emptyText="No requirements found."
            />

            {total > 20 && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                <Pagination
                  current={page}
                  total={total}
                  pageSize={20}
                  onChange={(p) => setPage(p)}
                  showSizeChanger={false}
                />
              </div>
            )}
          </>
        )}
      </Card>
    </PageContainer>
  )
}
