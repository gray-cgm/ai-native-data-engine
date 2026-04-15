import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { PageError } from '@/shared/components/page-error'
import { DataTable } from '@/shared/components/data-table'
import { fetchSearchRows } from '../api'

export default function SearchPage() {
  const [keyword, setKeyword] = useState('')
  const fetcher = useCallback(() => fetchSearchRows(), [])
  const { data, state, error, refetch } = useQuery(fetcher, {
    isEmpty: (d) => (d as any[]).length === 0,
  })

  const filtered = useMemo(() => {
    const rows = data ?? []
    if (!keyword) return rows
    const lower = keyword.toLowerCase()
    return rows.filter((row) => `${row.id} ${row.scene}`.toLowerCase().includes(lower))
  }, [data, keyword])

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
      actions={<Link to="/explorer"><button>Distribution</button></Link>}
    >
      <div className="card">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Search samples by ID or scene..."
          style={{ width: '100%', padding: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}
        />
        {state === 'empty' ? (
          <p className="text-muted">No samples available. Ingest data to see search results.</p>
        ) : filtered.length === 0 && keyword ? (
          <p className="text-muted">No samples matched your search.</p>
        ) : (
          <DataTable
            columns={[
              { key: 'id', header: 'ID' },
              { key: 'scene', header: 'Scene' },
            ]}
            data={filtered}
            rowKey={(row) => row.id}
            emptyText="No samples matched your search."
          />
        )}
      </div>
    </PageContainer>
  )
}
