import { useCallback } from 'react'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { PageError } from '@/shared/components/page-error'
import { DataTable } from '@/shared/components/data-table'
import { StatusBadge } from '@/shared/components/status-badge'
import { fetchRuns } from '../api'
import type { RunItem } from '../api'

export default function RunHistoryPage() {
  const fetcher = useCallback(() => fetchRuns(), [])
  const { data, state, error, refetch } = useQuery(fetcher, {
    isEmpty: (d) => (d as RunItem[]).length === 0,
  })

  if (state === 'loading') {
    return <PageLoading message="Loading pipeline runs..." />
  }

  if (state === 'error') {
    return <PageError message={error?.message} onRetry={refetch} />
  }

  return (
    <PageContainer title="Pipeline Runs" description="View ingestion, materialization, and export job history.">
      <div className="card">
        {state === 'empty' ? (
          <p className="text-muted">No pipeline runs found.</p>
        ) : (
          <DataTable
            columns={[
              { key: 'task_id', header: 'Run ID' },
              { key: 'title', header: 'Title' },
              { key: 'task_type', header: 'Type' },
              {
                key: 'status',
                header: 'Status',
                render: (row: RunItem) => <StatusBadge status={row.status} />,
              },
            ]}
            data={data ?? []}
            rowKey={(row) => row.task_id}
            emptyText="No pipeline runs found."
          />
        )}
      </div>
    </PageContainer>
  )
}
