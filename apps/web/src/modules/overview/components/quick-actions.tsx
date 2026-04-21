import { Link } from 'react-router-dom'
import { Button, Card, Space, Typography } from 'antd'
import {
  ThunderboltOutlined,
  CloudOutlined,
  DatabaseOutlined,
  BarChartOutlined,
  SearchOutlined,
  ExportOutlined,
} from '@ant-design/icons'

const { Title } = Typography

interface QuickActionsProps {
  onRunScenario: () => void
  onRunStreaming: () => void
  runningScenario: boolean
  runningStreaming: boolean
}

export function QuickActions({ onRunScenario, onRunStreaming, runningScenario, runningStreaming }: QuickActionsProps) {
  return (
    <Card title="Quick Actions">
      <Space direction="vertical" style={{ width: '100%' }}>
        <Button
          block
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={onRunScenario}
          loading={runningScenario}
        >
          {runningScenario ? 'Running Night Intersection Triage...' : 'Run Night Intersection Triage'}
        </Button>
        <Button
          block
          icon={<CloudOutlined />}
          onClick={onRunStreaming}
          loading={runningStreaming}
        >
          {runningStreaming ? 'Running Local Streaming Demo...' : 'Run Local Streaming Demo'}
        </Button>
        <Link to="/catalog"><Button block type="text" icon={<DatabaseOutlined />}>Browse Datasets</Button></Link>
        <Link to="/explorer"><Button block type="text" icon={<BarChartOutlined />}>Explore Distribution</Button></Link>
        <Link to="/explorer/search"><Button block type="text" icon={<SearchOutlined />}>Search Samples</Button></Link>
        <Link to="/ops/exports"><Button block type="text" icon={<ExportOutlined />}>View Exports</Button></Link>
      </Space>
    </Card>
  )
}
