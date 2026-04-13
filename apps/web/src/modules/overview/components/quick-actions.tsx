import { Link } from 'react-router-dom'

export function QuickActions() {
  return (
    <div className="card">
      <h3>Quick Actions</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
        <Link to="/catalog" className="nav-item">Browse Datasets</Link>
        <Link to="/explorer" className="nav-item">Explore Distribution</Link>
        <Link to="/explorer/search" className="nav-item">Search Samples</Link>
        <Link to="/ops/exports" className="nav-item">View Exports</Link>
      </div>
    </div>
  )
}
