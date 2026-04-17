import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { PageError } from '@/shared/components/page-error'
import { DataTable } from '@/shared/components/data-table'
import { fetchExplorerDashboard } from '../api'
import { DistributionChart } from '../components/distribution-chart'

export default function DistributionPage() {
  const fetcher = useCallback(() => fetchExplorerDashboard(), [])
  const { data, state, error, refetch } = useQuery(fetcher, {
    isEmpty: (d) => {
      const payload = d as { distribution?: unknown[]; streaming?: { distribution?: unknown[] } | null }
      return (payload.distribution?.length ?? 0) === 0 && (payload.streaming?.distribution?.length ?? 0) === 0
    },
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
      actions={<Link to="/explorer/search"><button>Search Samples</button></Link>}
    >
      {state === 'empty' ? (
        <div className="card">
          <p className="text-muted">No distribution data available. Ingest data to see distribution analysis.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>
          <div className="grid-two">
            <div className="card">
              <h3>Scenario Distribution</h3>
              <DistributionChart data={rows} />
            </div>
            <div className="card">
              <h3>Scenario Table</h3>
              <DataTable
                columns={[
                  { key: 'scene', header: 'Scene' },
                  { key: 'sample_count', header: 'Sample Count' },
                ]}
                data={rows}
                rowKey={(row) => row.scene}
                emptyText="No scenario distribution data."
              />
            </div>
          </div>
          <div className="card">
            <h3>Streaming Snapshot Distribution</h3>
            <p className="text-muted">This section reflects the latest local micro-batch materialization, not the batch triage scenario package.</p>
            <DataTable
              columns={[
                { key: 'scene', header: 'Scene' },
                { key: 'sample_count', header: 'Sample Count' },
              ]}
              data={streamingRows}
              rowKey={(row) => row.scene}
              emptyText="No streaming distribution data. Run the local streaming demo from Overview."
            />
          </div>
        </div>
      )}
    </PageContainer>
  )
}

