import { useCallback, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { PageError } from '@/shared/components/page-error'
import { PageSuccess } from '@/shared/components/page-success'
import { DataTable } from '@/shared/components/data-table'
import { fetchDatasetDetail, exportDataset } from '../api'

export default function DatasetDetailPage() {
  const { datasetId } = useParams<{ datasetId: string }>()
  const fetcher = useCallback(() => fetchDatasetDetail(datasetId!), [datasetId])
  const { data, state, error, refetch } = useQuery(fetcher)
  const [exporting, setExporting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleExport() {
    setExporting(true)
    setErrorMessage(null)
    try {
      await exportDataset(datasetId!)
      setSuccessMessage(`Export started for dataset ${datasetId}`)
      await refetch()
    } catch (err) {
      setErrorMessage(`Failed to export dataset: ${(err as Error).message}`)
    } finally {
      setExporting(false)
    }
  }

  if (state === 'loading') {
    return <PageLoading message="Loading dataset details..." />
  }

  if (state === 'error') {
    return <PageError message={error?.message} onRetry={refetch} />
  }

  if (!data) {
    return (
      <PageContainer title="Dataset Not Found">
        <div className="card">
          <p className="text-muted">Dataset {datasetId} not found.</p>
          <Link to="/catalog"><button>Back to Datasets</button></Link>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer
      title={data.dataset.name}
      description={`Dataset ${data.dataset.dataset_id} · ${data.dataset.profile} profile`}
      actions={
        <>
          <Link to="/catalog"><button>Back</button></Link>
          <button onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export'}
          </button>
        </>
      }
    >
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
      <div className="card" style={{ marginBottom: 'var(--space-2xl)' }}>
        <h3>Info</h3>
        <table>
          <tbody>
            <tr>
              <td>ID</td>
              <td>{data.dataset.dataset_id}</td>
            </tr>
            <tr>
              <td>Name</td>
              <td>{data.dataset.name}</td>
            </tr>
            <tr>
              <td>Workspace</td>
              <td>{data.dataset.workspace_id}</td>
            </tr>
            <tr>
              <td>Profile</td>
              <td>{data.dataset.profile}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Versions ({data.versions.length})</h3>
        {data.versions.length === 0 ? (
          <p className="text-muted">No versions found.</p>
        ) : (
          <DataTable
            columns={[
              { key: 'version_id', header: 'Version' },
              { key: 'sample_count', header: 'Samples' },
              { key: 'table_name', header: 'Table' },
            ]}
            data={data.versions}
            rowKey={(v) => v.version_id}
            emptyText="No versions found."
          />
        )}
      </div>
    </PageContainer>
  )
}

