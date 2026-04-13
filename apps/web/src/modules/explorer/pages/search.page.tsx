import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { DataTable } from '@/shared/components/data-table'
import { fetchSearchRows } from '../api'

export default function SearchPage() {
  const [keyword, setKeyword] = useState('')
  const fetcher = useCallback(() => fetchSearchRows(), [])
  const { data, loading } = useQuery(fetcher)

  const filtered = useMemo(() => {
    const rows = data ?? []
    if (!keyword) return rows
    const lower = keyword.toLowerCase()
    return rows.filter((row) => `${row.id} ${row.scene}`.toLowerCase().includes(lower))
  }, [data, keyword])

  if (loading) return <div className="page-loading">Loading...</div>

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
        />
        <DataTable
          columns={[
            { key: 'id', header: 'ID' },
            { key: 'scene', header: 'Scene' },
          ]}
          data={filtered}
          rowKey={(row) => row.id}
          emptyText="No samples matched your search."
        />
      </div>
    </PageContainer>
  )
}
