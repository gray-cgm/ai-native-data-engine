import { useMemo } from 'react'
import { Card, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { StatusBadge } from '@/shared/components/status-badge'
import type { ExportItem, RunItem, TaskItem } from '@/shared/types/common'

interface RecentActivityProps {
  tasks: TaskItem[]
  exports: ExportItem[]
  runs: RunItem[]
}

interface ActivityRow {
  key: string
  type: string
  name: string
  status: string
}

const columns: ColumnsType<ActivityRow> = [
  { key: 'type', title: 'Type', dataIndex: 'type' },
  { key: 'name', title: 'Name', dataIndex: 'name' },
  {
    key: 'status',
    title: 'Status',
    dataIndex: 'status',
    render: (status: string) => <StatusBadge status={status} />,
  },
]

export function RecentActivity({ tasks, exports: exportItems, runs }: RecentActivityProps) {
  const dataSource = useMemo<ActivityRow[]>(() => {
    const recentRuns = runs
      .filter((run) => run.job_name.includes('triage') || run.job_name.includes('streaming'))
      .slice(-3)
      .reverse()
      .map((run) => ({ key: `run-${run.run_id}`, type: 'run', name: run.job_name, status: run.status }))

    const scenarioTasks = tasks
      .filter((task) => task.task_type === 'scenario-triage')
      .slice(-3)
      .reverse()
      .map((t) => ({ key: `task-${t.task_id}`, type: t.task_type, name: t.title, status: t.status }))

    const recentExports = exportItems
      .slice(0, 3)
      .map((e) => ({ key: `export-${e.export_id}`, type: 'export', name: `${e.dataset_id} (${e.format})`, status: e.status }))

    return [...recentRuns, ...scenarioTasks, ...recentExports]
  }, [runs, tasks, exportItems])

  return (
    <Card title="Recent Activity">
      <Table<ActivityRow>
        columns={columns}
        dataSource={dataSource}
        pagination={false}
        size="small"
      />
    </Card>
  )
}
