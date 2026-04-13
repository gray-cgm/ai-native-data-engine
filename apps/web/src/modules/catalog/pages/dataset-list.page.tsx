import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { DataTable } from '@/shared/components/data-table'
import { fetchDatasets, exportDataset } from '../api'
import type { DatasetItem } from '@/shared/types/common'

export default function DatasetListPage() {
  const fetcher = useCallback(() => fetchDatasets(), [])
  const { data, loading, refetch } = useQuery(fetcher)

  async function handleExport(datasetId: string) {
    await exportDataset(datasetId)
    await refetch()
  }

  if (loading) return <div className="page-loading">Loading...</div>

  return (
    <PageContainer title="Datasets" description="Browse and manage data assets.">
      <div className="card">
        <DataTable
          columns={[
            { key: 'dataset_id', header: 'ID', render: (row: DatasetItem) => (
              <Link to={`/catalog/${row.dataset_id}`}>{row.dataset_id}</Link>
            )},
            { key: 'name', header: 'Name' },
            { key: 'workspace_id', header: 'Workspace' },
            { key: 'profile', header: 'Profile' },
            { key: '_action', header: 'Action', render: (row: DatasetItem) => (
              <button onClick={() => handleExport(row.dataset_id)}>Export</button>
            )},
          ]}
          data={data ?? []}
          rowKey={(row) => row.dataset_id}
          emptyText="No datasets found. Run ingestion to get started."
        />
      </div>
    </PageContainer>
  )
}
