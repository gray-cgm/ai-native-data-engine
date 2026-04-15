import { useCallback } from 'react'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { PageError } from '@/shared/components/page-error'
import { DataTable } from '@/shared/components/data-table'
import { StatusBadge } from '@/shared/components/status-badge'
import { fetchTasks } from '../api'
import type { TaskItem } from '@/shared/types/common'

export default function TaskBoardPage() {
  const fetcher = useCallback(() => fetchTasks(), [])
  const { data, state, error, refetch } = useQuery(fetcher, {
    isEmpty: (d) => (d as TaskItem[]).length === 0,
  })

  if (state === 'loading') {
    return <PageLoading message="Loading tasks..." />
  }

  if (state === 'error') {
    return <PageError message={error?.message} onRetry={refetch} />
  }

  return (
    <PageContainer title="Tasks" description="Track mining, labeling, and review tasks.">
      <div className="card">
        {state === 'empty' ? (
          <p className="text-muted">No tasks found.</p>
        ) : (
          <DataTable
            columns={[
              { key: 'task_id', header: 'ID' },
              { key: 'title', header: 'Title' },
              { key: 'task_type', header: 'Type' },
              {
                key: 'status',
                header: 'Status',
                render: (row: TaskItem) => <StatusBadge status={row.status} />,
              },
            ]}
            data={data ?? []}
            rowKey={(row) => row.task_id}
            emptyText="No tasks found."
          />
        )}
      </div>
    </PageContainer>
  )
}
