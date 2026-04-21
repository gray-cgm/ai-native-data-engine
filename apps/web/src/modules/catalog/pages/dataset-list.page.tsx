import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Card } from 'antd'
import { ExportOutlined } from '@ant-design/icons'
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
    cacheKey: 'datasets',
  })
  const [exporting, setExporting] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleExport(datasetId: string) {
    setExporting(datasetId)
    setErrorMessage(null)
    try {
      await exportDataset(datasetId, { format: 'lance' })
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
        <Alert
          message={errorMessage}
          type="error"
          closable
          onClose={() => setErrorMessage(null)}
          style={{ marginBottom: 16 }}
        />
      )}
      <Card>
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
                  <Button
                    type="primary"
                    size="small"
                    icon={<ExportOutlined />}
                    onClick={() => handleExport(row.dataset_id)}
                    loading={exporting === row.dataset_id}
                  >
                    Export
                  </Button>
                ),
              },
            ]}
            data={data ?? []}
            rowKey={(row) => row.dataset_id}
            emptyText="No datasets found."
          />
        )}
      </Card>
    </PageContainer>
  )
}
