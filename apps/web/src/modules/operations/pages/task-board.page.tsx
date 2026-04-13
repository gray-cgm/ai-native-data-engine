import { useCallback } from 'react'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { DataTable } from '@/shared/components/data-table'
import { StatusBadge } from '@/shared/components/status-badge'
import { fetchTasks } from '../api'
import type { TaskItem } from '@/shared/types/common'

export default function TaskBoardPage() {
  const fetcher = useCallback(() => fetchTasks(), [])
  const { data, loading } = useQuery(fetcher)

  if (loading) return <div className="page-loading">Loading...</div>

  return (
    <PageContainer title="Tasks" description="Track mining, labeling, and review tasks.">
      <div className="card">
        <DataTable
          columns={[
            { key: 'task_id', header: 'ID' },
            { key: 'title', header: 'Title' },
            { key: 'task_type', header: 'Type' },
            { key: 'status', header: 'Status', render: (row: TaskItem) => <StatusBadge status={row.status} /> },
          ]}
          data={data ?? []}
          rowKey={(row) => row.task_id}
          emptyText="No tasks found."
        />
      </div>
    </PageContainer>
  )
}
