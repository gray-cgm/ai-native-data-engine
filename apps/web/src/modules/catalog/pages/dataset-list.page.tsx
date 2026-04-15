import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { PageError } from '@/shared/components/page-error'
import { PageSuccess } from '@/shared/components/page-success'
import { DataTable } from '@/shared/components/data-table'
import { fetchDatasets, exportDataset } from '../api'
import type { DatasetItem } from '@/shared/types/common'

export default function DatasetListPage() {
  const fetcher = useCallback(() => fetchDatasets(), [])
  const { data, state, error, refetch } = useQuery(fetcher, {
    isEmpty: (d) => (d as DatasetItem[]).length === 0,
  })
  const [exporting, setExporting] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleExport(datasetId: string) {
    setExporting(datasetId)
    setErrorMessage(null)
    try {
      await exportDataset(datasetId)
      setSuccessMessage(`Export started for dataset ${datasetId}`)
      await refetch()
    } catch (err) {
      setErrorMessage(`Failed to export dataset: ${(err as Error).message}`)
    } finally {
      setExporting(null)
    }
  }

  if (state === 'loading') {
    return <PageLoading message="Loading datasets..." />
  }

  if (state === 'error') {
    return <PageError message={error?.message} onRetry={refetch} />
  }

  return (
    <PageContainer title="Datasets" description="Browse and manage data assets.">
      {successMessage && (
        <PageSuccess
          message={successMessage}
          onDismiss={() => setSuccessMessage(null)}
          autoCloseDuration={3000}
        />
      )}
      {errorMessage && (
        <div
          style={{
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            color: '#721c24',
            padding: 'var(--space-md)',
            borderRadius: '4px',
            marginBottom: 'var(--space-md)',
          }}
        >
          <p style={{ margin: 0 }}>{errorMessage}</p>
        </div>
      )}
      <div className="card">
        {state === 'empty' ? (
          <p className="text-muted">No datasets found. Run ingestion to get started.</p>
        ) : (
          <DataTable
            columns={[
              {
                key: 'dataset_id',
                header: 'ID',
                render: (row: DatasetItem) => (
                  <Link to={`/catalog/${row.dataset_id}`}>{row.dataset_id}</Link>
                ),
              },
              { key: 'name', header: 'Name' },
              { key: 'workspace_id', header: 'Workspace' },
              { key: 'profile', header: 'Profile' },
              {
                key: '_action',
                header: 'Action',
                render: (row: DatasetItem) => (
                  <button
                    onClick={() => handleExport(row.dataset_id)}
                    disabled={exporting === row.dataset_id}
                  >
                    {exporting === row.dataset_id ? 'Exporting...' : 'Export'}
                  </button>
                ),
              },
            ]}
            data={data ?? []}
            rowKey={(row) => row.dataset_id}
            emptyText="No datasets found."
          />
        )}
      </div>
    </PageContainer>
  )
}

