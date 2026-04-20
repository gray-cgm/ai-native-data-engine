import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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

const PRIORITY_COLORS: Record<string, string> = {
  high: 'var(--color-danger)',
  medium: 'var(--color-warning)',
  low: 'var(--color-info)',
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
  })

  const { data: statsData } = useQuery(statsFetcher)

  const items = listData?.items ?? []
  const total = listData?.total ?? 0
  const totalPages = Math.ceil(total / 20)

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

      <div className="card">
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
                    <span style={{ color: PRIORITY_COLORS[row.priority] ?? 'inherit', fontWeight: 600 }}>
                      {row.priority}
                    </span>
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
                        <span
                          key={tag}
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            marginRight: 4,
                            marginBottom: 2,
                            borderRadius: 12,
                            background: 'var(--color-bg-secondary)',
                            fontSize: 'var(--font-size-xs)',
                          }}
                        >
                          {tag}
                        </span>
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
              ]}
              data={items}
              rowKey={(row) => row.id}
              emptyText="No requirements found."
            />

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-sm)', marginTop: 'var(--space-lg)' }}>
                <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Previous
                </button>
                <span style={{ display: 'flex', alignItems: 'center', fontSize: 'var(--font-size-sm)' }}>
                  Page {page} of {totalPages}
                </span>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </PageContainer>
  )
}
