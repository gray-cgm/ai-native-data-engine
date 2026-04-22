import { Link } from 'react-router-dom'
import { Button, Card, Space } from 'antd'
import {
  SearchOutlined,
  DatabaseOutlined,
  HighlightOutlined,
  SafetyCertificateOutlined,
  ExperimentOutlined,
  FormOutlined,
  SendOutlined,
  ExportOutlined,
} from '@ant-design/icons'

export function QuickActionsV2() {
  return (
    <Card title="Quick Actions">
      <Space direction="vertical" style={{ width: '100%' }}>
        <Link to="/catalog"><Button block icon={<DatabaseOutlined />}>Browse Clips & Scenarios</Button></Link>
        <Link to="/explorer/search"><Button block icon={<SearchOutlined />}>Search / NL Query</Button></Link>
        <Link to="/requirements"><Button block icon={<FormOutlined />}>Open Requirements</Button></Link>
        <Link to="/ops/labeling"><Button block icon={<HighlightOutlined />}>Start Labeling Batch</Button></Link>
        <Link to="/ops/checking"><Button block icon={<SafetyCertificateOutlined />}>New Checking Gate</Button></Link>
        <Link to="/ops/mining"><Button block icon={<ExperimentOutlined />}>Run Mining Job</Button></Link>
        <Link to="/ops/release"><Button block icon={<SendOutlined />}>Release Dataset</Button></Link>
        <Link to="/ops/exports"><Button block icon={<ExportOutlined />}>Manage Exports</Button></Link>
      </Space>
    </Card>
  )
}
