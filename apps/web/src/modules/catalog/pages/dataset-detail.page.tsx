import { useCallback, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Alert, Button, Card, Descriptions, Space } from 'antd'
import { ExportOutlined, ArrowLeftOutlined } from '@ant-design/icons'
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
  const { data, state, error, refetch } = useQuery(fetcher, { cacheKey: `dataset:${datasetId}` })
  const [exporting, setExporting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleExport() {
    setExporting(true)
    setErrorMessage(null)
    try {
      await exportDataset(datasetId!, { format: 'lance' })
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
        <Card>
          <p className="text-muted">Dataset {datasetId} not found.</p>
          <Link to="/catalog"><Button icon={<ArrowLeftOutlined />}>Back to Datasets</Button></Link>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer
      title={data.dataset.name}
      description={`Dataset ${data.dataset.dataset_id} · ${data.dataset.profile} profile`}
      actions={
        <Space>
          <Link to="/catalog"><Button icon={<ArrowLeftOutlined />}>Back</Button></Link>
          <Button type="primary" icon={<ExportOutlined />} onClick={handleExport} loading={exporting}>
            Export
          </Button>
        </Space>
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
        <Alert
          message={errorMessage}
          type="error"
          closable
          onClose={() => setErrorMessage(null)}
          style={{ marginBottom: 16 }}
        />
      )}
      <Card title="Info" style={{ marginBottom: 24 }}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="ID">{data.dataset.dataset_id}</Descriptions.Item>
          <Descriptions.Item label="Name">{data.dataset.name}</Descriptions.Item>
          <Descriptions.Item label="Workspace">{data.dataset.workspace_id}</Descriptions.Item>
          <Descriptions.Item label="Profile">{data.dataset.profile}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title={`Versions (${data.versions.length})`}>
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
      </Card>
    </PageContainer>
  )
}
