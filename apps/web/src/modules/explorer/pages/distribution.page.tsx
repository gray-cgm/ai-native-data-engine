import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Row, Col, Typography } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { PageError } from '@/shared/components/page-error'
import { DataTable } from '@/shared/components/data-table'
import { fetchExplorerDashboard } from '../api'
import { DistributionChart } from '../components/distribution-chart'

const { Text } = Typography

export default function DistributionPage() {
  const fetcher = useCallback(() => fetchExplorerDashboard(), [])
  const { data, state, error, refetch } = useQuery(fetcher, {
    isEmpty: (d) => {
      const payload = d as { distribution?: unknown[]; streaming?: { distribution?: unknown[] } | null }
      return (payload.distribution?.length ?? 0) === 0 && (payload.streaming?.distribution?.length ?? 0) === 0
    },
    cacheKey: 'distribution',
  })

  if (state === 'loading') {
    return <PageLoading message="Loading distribution data..." />
  }

  if (state === 'error') {
    return <PageError message={error?.message} onRetry={refetch} />
  }

  const rows = data?.distribution ?? []
  const streamingRows = data?.streaming?.distribution ?? []

  return (
    <PageContainer
      title="Data Distribution"
      description="Analyze batch scenario distribution and local streaming materialization snapshots."
      actions={<Link to="/explorer/search"><Button icon={<SearchOutlined />}>Search Samples</Button></Link>}
    >
      {state === 'empty' ? (
        <Card>
          <p className="text-muted">No distribution data available. Ingest data to see distribution analysis.</p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Card title="Scenario Distribution">
                <DistributionChart data={rows} />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Scenario Table">
                <DataTable
                  columns={[
                    { key: 'scene', header: 'Scene' },
                    { key: 'sample_count', header: 'Sample Count' },
                  ]}
                  data={rows}
                  rowKey={(row) => row.scene}
                  emptyText="No scenario distribution data."
                />
              </Card>
            </Col>
          </Row>
          <Card title="Streaming Snapshot Distribution">
            <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              This section reflects the latest local micro-batch materialization, not the batch triage scenario package.
            </Text>
            <DataTable
              columns={[
                { key: 'scene', header: 'Scene' },
                { key: 'sample_count', header: 'Sample Count' },
              ]}
              data={streamingRows}
              rowKey={(row) => row.scene}
              emptyText="No streaming distribution data. Run the local streaming demo from Overview."
            />
          </Card>
        </div>
      )}
    </PageContainer>
  )
}
