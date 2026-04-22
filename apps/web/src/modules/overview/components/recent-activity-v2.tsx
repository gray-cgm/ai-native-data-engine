import { useMemo } from 'react'
import { Card, Table, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { StatusBadge } from '@/shared/components/status-badge'
import type { ExportItem, RunItem, TaskItem } from '@/shared/types/common'

const { Text } = Typography

interface Props {
  tasks: TaskItem[]
  exports: ExportItem[]
  runs: RunItem[]
}

interface ActivityRow {
  key: string
  type: string
  name: string
  status: string
  when: string
}

const columns: ColumnsType<ActivityRow> = [
  { key: 'type', title: 'Type', dataIndex: 'type', width: 110 },
  { key: 'name', title: 'Name', dataIndex: 'name' },
  {
    key: 'status',
    title: 'Status',
    dataIndex: 'status',
    render: (status: string) => <StatusBadge status={status} />,
    width: 120,
  },
  {
    key: 'when',
    title: 'When',
    dataIndex: 'when',
    width: 120,
    render: (when: string) => (when ? <Text type="secondary">{when}</Text> : '—'),
  },
]

function asTime(value: unknown): number {
  if (typeof value === 'string') return Date.parse(value) || 0
  if (typeof value === 'number') return value
  return 0
}

export function RecentActivityV2({ tasks, exports: exportItems, runs }: Props) {
  const dataSource = useMemo<ActivityRow[]>(() => {
    const rows: Array<ActivityRow & { _ts: number }> = []
    for (const task of tasks) {
      const ts = asTime((task as Record<string, unknown>).updated_at ?? (task as Record<string, unknown>).created_at)
      rows.push({
        key: `task-${task.task_id}`,
        type: task.task_type,
        name: task.title,
        status: task.status,
        when: ts ? new Date(ts).toLocaleString() : '',
        _ts: ts,
      })
    }
    for (const run of runs) {
      const ts = asTime((run as Record<string, unknown>).completed_at ?? (run as Record<string, unknown>).started_at)
      rows.push({
        key: `run-${run.run_id}`,
        type: 'run',
        name: run.job_name,
        status: run.status,
        when: ts ? new Date(ts).toLocaleString() : '',
        _ts: ts,
      })
    }
    for (const exp of exportItems) {
      const ts = asTime((exp as Record<string, unknown>).created_at)
      rows.push({
        key: `export-${exp.export_id}`,
        type: 'export',
        name: `${exp.dataset_id} (${exp.format})`,
        status: exp.status,
        when: ts ? new Date(ts).toLocaleString() : '',
        _ts: ts,
      })
    }
    rows.sort((a, b) => b._ts - a._ts)
    return rows.slice(0, 10).map(({ _ts: _drop, ...row }) => {
      void _drop
      return row
    })
  }, [tasks, exportItems, runs])

  return (
    <Card title="Recent Activity">
      <Table<ActivityRow>
        columns={columns}
        dataSource={dataSource}
        pagination={false}
        size="small"
        locale={{ emptyText: 'No recent activity yet.' }}
      />
    </Card>
  )
}
