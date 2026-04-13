import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { DataTable } from '@/shared/components/data-table'
import { fetchDistribution } from '../api'
import { DistributionChart } from '../components/distribution-chart'

export default function DistributionPage() {
  const fetcher = useCallback(() => fetchDistribution(), [])
  const { data, loading } = useQuery(fetcher)

  if (loading) return <div className="page-loading">Loading...</div>

  const rows = data ?? []

  return (
    <PageContainer
      title="Data Distribution"
      description="Analyze sample distribution across scenes."
      actions={<Link to="/explorer/search"><button>Search Samples</button></Link>}
    >
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
    </PageContainer>
  )
}
