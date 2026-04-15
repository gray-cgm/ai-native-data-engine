import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { PageError } from '@/shared/components/page-error'
import { DataTable } from '@/shared/components/data-table'
import { fetchDistribution } from '../api'
import { DistributionChart } from '../components/distribution-chart'

export default function DistributionPage() {
  const fetcher = useCallback(() => fetchDistribution(), [])
  const { data, state, error, refetch } = useQuery(fetcher, {
    isEmpty: (d) => (d as any[]).length === 0,
  })

  if (state === 'loading') {
    return <PageLoading message="Loading distribution data..." />
  }

  if (state === 'error') {
    return <PageError message={error?.message} onRetry={refetch} />
  }

  const rows = data ?? []

  return (
    <PageContainer
      title="Data Distribution"
      description="Analyze sample distribution across scenes."
      actions={<Link to="/explorer/search"><button>Search Samples</button></Link>}
    >
      {state === 'empty' ? (
        <div className="card">
          <p className="text-muted">No distribution data available. Ingest data to see distribution analysis.</p>
        </div>
      ) : (
        <div className="grid-two">
          <div className="card">
            <h3>Distribution Chart</h3>
            <DistributionChart data={rows} />
          </div>
          <div className="card">
            <h3>Distribution Table</h3>
            <DataTable
              columns={[
                { key: 'scene', header: 'Scene' },
                { key: 'sample_count', header: 'Sample Count' },
              ]}
              data={rows}
              rowKey={(row) => row.scene}
              emptyText="No distribution data."
            />
          </div>
        </div>
      )}
    </PageContainer>
  )
}

