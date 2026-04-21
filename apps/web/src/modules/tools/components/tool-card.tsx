import { Link } from 'react-router-dom'
import { Button, Tag, Space } from 'antd'
import { LinkOutlined } from '@ant-design/icons'
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
        <Tag color="blue">{tool.category}</Tag>
        <Tag>{tool.integrationMode}</Tag>
      </div>

      <p className="tool-card-description">{tool.description}</p>

      <div className="tool-card-list">
        {tool.capabilities.slice(0, 3).map((item) => (
          <span key={item} className="tool-list-item">
            {item}
          </span>
        ))}
      </div>

      <Space className="tool-card-actions">
        <Link to={tool.route.path}>
          <Button type="primary">Open workspace</Button>
        </Link>
        <Button type="default" icon={<LinkOutlined />} href={tool.baseUrl} target="_blank" rel="noreferrer">
          Open source app
        </Button>
      </Space>
    </article>
  )
}
