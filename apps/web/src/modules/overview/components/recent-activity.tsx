import { StatusBadge } from '@/shared/components/status-badge'
import type { TaskItem, ExportItem } from '@/shared/types/common'

interface RecentActivityProps {
  tasks: TaskItem[]
  exports: ExportItem[]
}

export function RecentActivity({ tasks, exports }: RecentActivityProps) {
  return (
    <div className="card">
      <h3>Recent Activity</h3>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Name</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {tasks.slice(0, 3).map((t) => (
            <tr key={`task-${t.task_id}`}>
              <td>{t.task_type}</td>
              <td>{t.title}</td>
              <td><StatusBadge status={t.status} /></td>
            </tr>
          ))}
          {exports.slice(0, 3).map((e) => (
            <tr key={`export-${e.export_id}`}>
              <td>export</td>
              <td>{e.dataset_id} ({e.format})</td>
              <td><StatusBadge status={e.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
