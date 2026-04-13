import { useCallback } from 'react'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { DataTable } from '@/shared/components/data-table'
import { StatusBadge } from '@/shared/components/status-badge'
import { fetchExports } from '../api'
import type { ExportItem } from '@/shared/types/common'

export default function ExportListPage() {
  const fetcher = useCallback(() => fetchExports(), [])
  const { data, loading } = useQuery(fetcher)

  if (loading) return <div className="page-loading">Loading...</div>

  return (
    <PageContainer title="Exports" description="Track data export jobs and download artifacts.">
      <div className="card">
        <DataTable
          columns={[
            { key: 'export_id', header: 'ID' },
            { key: 'dataset_id', header: 'Dataset' },
            { key: 'format', header: 'Format' },
            { key: 'status', header: 'Status', render: (row: ExportItem) => <StatusBadge status={row.status} /> },
            { key: 'output_path', header: 'Output' },
          ]}
          data={data ?? []}
          rowKey={(row) => row.export_id}
          emptyText="No exports yet."
        />
      </div>
    </PageContainer>
  )
}
