import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Input, Typography } from 'antd'
import { SearchOutlined, BarChartOutlined } from '@ant-design/icons'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { PageError } from '@/shared/components/page-error'
import { DataTable } from '@/shared/components/data-table'
import { fetchExplorerDashboard } from '../api'

const { Title } = Typography

export default function SearchPage() {
  const [keyword, setKeyword] = useState('')
  const fetcher = useCallback(() => fetchExplorerDashboard(), [])
  const { data, state, error, refetch } = useQuery(fetcher, {
    isEmpty: (d) => {
      const payload = d as { searchRows?: unknown[]; streaming?: { search_preview?: unknown[] } | null }
      return (payload.searchRows?.length ?? 0) === 0 && (payload.streaming?.search_preview?.length ?? 0) === 0
    },
    cacheKey: 'search',
  })

  const searchRows = data?.searchRows ?? []
  const streamingRows = data?.streaming?.search_preview ?? []

  const filtered = useMemo(() => {
    const rows = searchRows
    if (!keyword) return rows
    const lower = keyword.toLowerCase()
    return rows.filter((row) => `${row.id} ${row.scene}`.toLowerCase().includes(lower))
  }, [searchRows, keyword])

  const filteredStreaming = useMemo(() => {
    const rows = streamingRows
    if (!keyword) return rows
    const lower = keyword.toLowerCase()
    return rows.filter((row) => `${row.id} ${row.scene}`.toLowerCase().includes(lower))
  }, [streamingRows, keyword])

  if (state === 'loading') {
    return <PageLoading message="Loading samples..." />
  }

  if (state === 'error') {
    return <PageError message={error?.message} onRetry={refetch} />
  }

  return (
    <PageContainer
      title="Sample Search"
      description="Search and filter samples by scene or ID."
      actions={<Link to="/explorer"><Button icon={<BarChartOutlined />}>Distribution</Button></Link>}
    >
      <Card>
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Search samples by ID or scene..."
          prefix={<SearchOutlined />}
          allowClear
          size="large"
          style={{ marginBottom: 16 }}
        />
        {state === 'empty' ? (
          <p className="text-muted">No samples available. Ingest data to see search results.</p>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <Title level={5}>Scenario Search Preview</Title>
              {filtered.length === 0 && keyword ? (
                <p className="text-muted">No scenario samples matched your search.</p>
              ) : (
                <DataTable
                  columns={[
                    { key: 'id', header: 'ID' },
                    { key: 'scene', header: 'Scene' },
                  ]}
                  data={filtered}
                  rowKey={(row) => row.id}
                  emptyText="No scenario samples available."
                />
              )}
            </div>
            <div>
              <Title level={5}>Streaming Search Preview</Title>
              {filteredStreaming.length === 0 && keyword ? (
                <p className="text-muted">No streaming samples matched your search.</p>
              ) : (
                <DataTable
                  columns={[
                    { key: 'id', header: 'ID' },
                    { key: 'scene', header: 'Scene' },
                  ]}
                  data={filteredStreaming}
                  rowKey={(row) => row.id}
                  emptyText="No streaming search preview yet. Run the local streaming demo from Overview."
                />
              )}
            </div>
          </div>
        )}
      </Card>
    </PageContainer>
  )
}
