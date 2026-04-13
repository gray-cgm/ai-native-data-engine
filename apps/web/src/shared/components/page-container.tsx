import type { ReactNode } from 'react'

interface PageContainerProps {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}

export function PageContainer({ title, description, actions, children }: PageContainerProps) {
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>{title}</h2>
          {description && <p className="text-muted">{description}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
      {children}
    </div>
  )
}
