import { Link } from 'react-router-dom'
import type { ToolDescriptor } from '@/shared/microfrontends/types'

interface ToolCardProps {
  tool: ToolDescriptor
}

export function ToolCard({ tool }: ToolCardProps) {
  return (
    <article className="tool-card card">
      <div className="tool-card-head">
        <div className="tool-card-badge">{tool.icon}</div>
        <div>
          <h3>{tool.shortName}</h3>
          <p className="text-muted">{tool.summary}</p>
        </div>
      </div>

      <div className="tool-card-meta">
        <span className="tool-chip">{tool.category}</span>
        <span className="tool-chip">{tool.integrationMode}</span>
      </div>

      <p className="tool-card-description">{tool.description}</p>

      <div className="tool-card-list">
        {tool.capabilities.slice(0, 3).map((item) => (
          <span key={item} className="tool-list-item">
            {item}
          </span>
        ))}
      </div>

      <div className="tool-card-actions">
        <Link className="tool-link-button" to={tool.route.path}>
          Open workspace
        </Link>
        <a className="tool-link-secondary" href={tool.baseUrl} target="_blank" rel="noreferrer">
          Open source app
        </a>
      </div>
    </article>
  )
}