import { useCallback } from 'react'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { PageError } from '@/shared/components/page-error'
import { DataTable } from '@/shared/components/data-table'
import { StatusBadge } from '@/shared/components/status-badge'
import { fetchExports } from '../api'
import type { ExportItem } from '@/shared/types/common'

export default function ExportListPage() {
  const fetcher = useCallback(() => fetchExports(), [])
  const { data, state, error, refetch } = useQuery(fetcher, {
    isEmpty: (d) => (d as ExportItem[]).length === 0,
  })

  if (state === 'loading') {
    return <PageLoading message="Loading exports..." />
  }

  if (state === 'error') {
    return <PageError message={error?.message} onRetry={refetch} />
  }

  return (
    <PageContainer title="Exports" description="Track data export jobs and download artifacts.">
      <div className="card">
        {state === 'empty' ? (
          <p className="text-muted">No exports yet. Create an export from a dataset to get started.</p>
        ) : (
          <DataTable
            columns={[
              { key: 'export_id', header: 'ID' },
              { key: 'dataset_id', header: 'Dataset' },
              { key: 'format', header: 'Format' },
              {
                key: 'status',
                header: 'Status',
                render: (row: ExportItem) => <StatusBadge status={row.status} />,
              },
              { key: 'output_path', header: 'Output' },
            ]}
            data={data ?? []}
            rowKey={(row) => row.export_id}
            emptyText="No exports yet."
          />
        )}
      </div>
    </PageContainer>
  )
}
