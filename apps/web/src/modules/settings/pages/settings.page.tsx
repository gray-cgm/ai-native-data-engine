import { Card, Typography } from 'antd'
import { SettingOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

export default function SettingsPage() {
  return (
    <div style={{ padding: 32 }}>
      <Title level={4}>
        <SettingOutlined style={{ marginRight: 8 }} />
        Settings
      </Title>
      <Card>
        <Text type="secondary">System settings page — coming soon.</Text>
      </Card>
    </div>
  )
}
