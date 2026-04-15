import { StatusBadge } from '@/shared/components/status-badge'
import type { ExportItem, RunItem, TaskItem } from '@/shared/types/common'

interface RecentActivityProps {
  tasks: TaskItem[]
  exports: ExportItem[]
  runs: RunItem[]
}

export function RecentActivity({ tasks, exports, runs }: RecentActivityProps) {
  const recentRuns = runs
    .filter((run) => run.job_name.includes('triage'))
    .slice(-3)
    .reverse()

  const scenarioTasks = tasks
    .filter((task) => task.task_type === 'scenario-triage')
    .slice(-3)
    .reverse()

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
          {recentRuns.map((run) => (
            <tr key={`run-${run.run_id}`}>
              <td>run</td>
              <td>{run.job_name}</td>
              <td><StatusBadge status={run.status} /></td>
            </tr>
          ))}
          {scenarioTasks.map((t) => (
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
