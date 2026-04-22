import { Typography, Space } from 'antd'
import type { ReactNode } from 'react'

const { Title, Text } = Typography

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
          <Title level={4} style={{ margin: 0 }}>{title}</Title>
          {description && <Text type="secondary">{description}</Text>}
        </div>
        {actions && <Space className="page-actions">{actions}</Space>}
      </div>
      {children}
    </div>
  )
}
