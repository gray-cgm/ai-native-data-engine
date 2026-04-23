import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Col, Row, Space, Statistic, Tag, Typography } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { PageError } from '@/shared/components/page-error'
import { DataTable } from '@/shared/components/data-table'
import { fetchClips } from '../clips-api'
import { fetchExplorerDashboard } from '../api'
import { DistributionChart } from '../components/distribution-chart'
import { formatDuration } from '../components/clip-result-views'

const { Text } = Typography

export default function DistributionPage() {
  const fetcher = useCallback(
    async () => {
      const [dashboard, clips] = await Promise.all([fetchExplorerDashboard(), fetchClips()])
      return { dashboard, clips }
    },
    [],
  )
  const { data, state, error, refetch } = useQuery(fetcher, {
    isEmpty: (d) => {
      const payload = d as {
        dashboard?: { distribution?: unknown[]; streaming?: { distribution?: unknown[] } | null }
        clips?: { items?: unknown[] }
      }
      return (
        (payload.dashboard?.distribution?.length ?? 0) === 0 &&
        (payload.dashboard?.streaming?.distribution?.length ?? 0) === 0 &&
        (payload.clips?.items?.length ?? 0) === 0
      )
    },
    cacheKey: 'explorer:distribution:v2',
  })

  if (state === 'loading') {
    return <PageLoading message="Loading distribution data..." />
  }

  if (state === 'error') {
    return <PageError message={error?.message} onRetry={refetch} />
  }

  const rows = data?.dashboard.distribution ?? []
  const streamingRows = data?.dashboard.streaming?.distribution ?? []
  const streamingTags = data?.dashboard.streaming?.tag_distribution ?? []
  const searchPreview = data?.dashboard.searchRows ?? []
  const clipCount = data?.clips.items?.length ?? 0
  const totalKeyframes = (data?.clips.items ?? []).reduce((sum, row) => sum + (row.keyframe_count ?? 0), 0)

  const totalSamples = rows.reduce((sum, row) => sum + row.sample_count, 0)
  const topScenario = rows.reduce<{ scene: string; sample_count: number } | null>((acc, row) => {
    if (!acc || row.sample_count > acc.sample_count) return row
    return acc
  }, null)
  const topScenarioShare =
    totalSamples > 0 && topScenario ? `${Math.round((topScenario.sample_count / totalSamples) * 100)}%` : '—'
  const streamingLatest = data?.dashboard.streaming?.latest_sample_count ?? 0
  const streamingBatches = data?.dashboard.streaming?.batch_count ?? 0
  const totalDurationSeconds = (data?.clips.items ?? []).reduce((sum, row) => sum + (row.duration_seconds ?? 0), 0)

  return (
    <PageContainer
      title="Data Distribution"
      description="Analyze batch scenario distribution, clip coverage, and local streaming materialization snapshots."
      actions={
        <Space>
          <Link to="/explorer/search">
            <Button icon={<SearchOutlined />}>Search Samples</Button>
          </Link>
        </Space>
      }
    >
      {state === 'empty' ? (
        <Card>
          <p className="text-muted">No distribution data available. Ingest data to see distribution analysis.</p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={12} lg={6}>
              <Card>
                <Statistic title="Scenario buckets" value={rows.length} />
              </Card>
            </Col>
            <Col xs={24} md={12} lg={6}>
              <Card>
                <Statistic title="Catalog clips" value={clipCount} />
              </Card>
            </Col>
            <Col xs={24} md={12} lg={6}>
              <Card>
                <Statistic title="Total keyframes" value={totalKeyframes} />
              </Card>
            </Col>
            <Col xs={24} md={12} lg={6}>
              <Card>
                <Statistic
                  title="Total recorded"
                  value={formatDuration(totalDurationSeconds)}
                  suffix={topScenario ? <Tag color="blue">{topScenario.scene}</Tag> : undefined}
                />
              </Card>
            </Col>
          </Row>

          <Card>
            <Space size={12} wrap>
              <Tag color="blue">Top scenario share: {topScenarioShare}</Tag>
              {topScenario && <Tag color="cyan">Top scenario: {topScenario.scene}</Tag>}
              <Tag color="purple">Total samples: {totalSamples}</Tag>
            </Space>
          </Card>

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
            <Row gutter={16} style={{ marginBottom: 12 }}>
              <Col xs={24} md={12}>
                <Card size="small">
                  <Statistic title="Latest streaming samples" value={streamingLatest} />
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card size="small">
                  <Statistic title="Streaming batches" value={streamingBatches} />
                </Card>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} lg={12}>
                <DataTable
                  columns={[
                    { key: 'scene', header: 'Scene' },
                    { key: 'sample_count', header: 'Sample Count' },
                  ]}
                  data={streamingRows}
                  rowKey={(row) => row.scene}
                  emptyText="No streaming distribution data. Run the local streaming demo from Overview."
                />
              </Col>
              <Col xs={24} lg={12}>
                <DataTable
                  columns={[
                    { key: 'tag', header: 'Tag' },
                    { key: 'sample_count', header: 'Sample Count' },
                  ]}
                  data={streamingTags}
                  rowKey={(row) => row.tag}
                  emptyText="No streaming tag distribution yet."
                />
              </Col>
            </Row>
          </Card>

          <Card title="Search Preview (from dashboard)">
            <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              A lightweight preview of search candidates from the latest dashboard snapshot.
            </Text>
            <DataTable
              columns={[
                { key: 'id', header: 'ID' },
                { key: 'scene', header: 'Scene' },
                { key: 'dataset_version_id', header: 'Dataset Version' },
              ]}
              data={searchPreview}
              rowKey={(row) => row.id}
              emptyText="No search preview rows available."
            />
          </Card>
        </div>
      )}
    </PageContainer>
  )
}
