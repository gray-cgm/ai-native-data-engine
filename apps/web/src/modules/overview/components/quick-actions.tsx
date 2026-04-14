import { Link } from 'react-router-dom'

interface QuickActionsProps {
  onRunScenario: () => void
  runningScenario: boolean
}

export function QuickActions({ onRunScenario, runningScenario }: QuickActionsProps) {
  return (
    <div className="card">
      <h3>Quick Actions</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
        <button type="button" className="nav-item" onClick={onRunScenario} disabled={runningScenario}>
          {runningScenario ? 'Running Night Intersection Triage...' : 'Run Night Intersection Triage'}
        </button>
        <Link to="/catalog" className="nav-item">Browse Datasets</Link>
        <Link to="/explorer" className="nav-item">Explore Distribution</Link>
        <Link to="/explorer/search" className="nav-item">Search Samples</Link>
        <Link to="/ops/exports" className="nav-item">View Exports</Link>
      </div>
    </div>
  )
}
