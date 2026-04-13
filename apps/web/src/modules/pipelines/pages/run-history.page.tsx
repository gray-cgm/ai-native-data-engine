import { useCallback } from 'react'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { DataTable } from '@/shared/components/data-table'
import { StatusBadge } from '@/shared/components/status-badge'
import { fetchRuns } from '../api'
import type { RunItem } from '../api'

export default function RunHistoryPage() {
  const fetcher = useCallback(() => fetchRuns(), [])
  const { data, loading } = useQuery(fetcher)

  if (loading) return <div className="page-loading">Loading...</div>

  return (
    <PageContainer title="Pipeline Runs" description="View ingestion, materialization, and export job history.">
      <div className="card">
        <DataTable
          columns={[
            { key: 'task_id', header: 'Run ID' },
            { key: 'title', header: 'Title' },
            { key: 'task_type', header: 'Type' },
            { key: 'status', header: 'Status', render: (row: RunItem) => <StatusBadge status={row.status} /> },
          ]}
          data={data ?? []}
          rowKey={(row) => row.task_id}
          emptyText="No pipeline runs found."
        />
      </div>
    </PageContainer>
  )
}
