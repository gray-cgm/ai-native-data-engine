import { useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { DataTable } from '@/shared/components/data-table'
import { fetchDatasetDetail, exportDataset } from '../api'

export default function DatasetDetailPage() {
  const { datasetId } = useParams<{ datasetId: string }>()
  const fetcher = useCallback(() => fetchDatasetDetail(datasetId!), [datasetId])
  const { data, loading, refetch } = useQuery(fetcher)

  async function handleExport() {
    await exportDataset(datasetId!)
    await refetch()
  }

  if (loading || !data) return <div className="page-loading">Loading...</div>

  return (
    <PageContainer
      title={data.dataset.name}
      description={`Dataset ${data.dataset.dataset_id} · ${data.dataset.profile} profile`}
      actions={
        <>
          <Link to="/catalog"><button>Back</button></Link>
          <button onClick={handleExport}>Export</button>
        </>
      }
    >
      <div className="card" style={{ marginBottom: 'var(--space-2xl)' }}>
        <h3>Info</h3>
        <table>
          <tbody>
            <tr><td>ID</td><td>{data.dataset.dataset_id}</td></tr>
            <tr><td>Workspace</td><td>{data.dataset.workspace_id}</td></tr>
            <tr><td>Profile</td><td>{data.dataset.profile}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Versions</h3>
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
      </div>
    </PageContainer>
  )
}
