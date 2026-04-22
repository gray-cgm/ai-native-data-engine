import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Pagination, Space, Tag, Tooltip } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
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
    cacheKey: 'requirements',
  })

  const { data: statsData } = useQuery(statsFetcher, { cacheKey: 'requirement-stats' })

  const items = listData?.items ?? []
  const total = listData?.total ?? 0

  if (listState === 'loading') {
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
            <DataTable
              columns={[
                {
                  key: 'title',
                  header: 'Title',
                  render: (row: RequirementListItem) => (
                    <Link to={`/requirements/${row.id}`} style={{ color: 'var(--color-accent)' }}>
                      {row.title}
                    </Link>
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
                    return (
                      <Space>
                        <Tooltip title="Search matching clips">
                          <Link to={`/explorer/search?${params.toString()}`}>
                            <Button size="small" icon={<SearchOutlined />}>
                              Find clips
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
