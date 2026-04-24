import { Card, Empty, Space, Typography } from 'antd'
import { ExperimentOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

type Props = {
  title: string
  description: string
  bullets?: string[]
}

export function PlaceholderView({ title, description, bullets = [] }: Props) {
  return (
    <Card>
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <Empty
          image={<ExperimentOutlined style={{ fontSize: 56, color: '#8c8c8c' }} />}
          imageStyle={{ height: 70 }}
          description={
            <div>
              <Title level={4} style={{ marginBottom: 4 }}>{title}</Title>
              <Text type="secondary">{description}</Text>
            </div>
          }
        />
        {bullets.length > 0 && (
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <Text type="secondary" style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Upcoming capabilities
            </Text>
            <ul style={{ marginTop: 8, paddingLeft: 20, color: '#595959' }}>
              {bullets.map((b) => <li key={b} style={{ marginBottom: 4 }}>{b}</li>)}
            </ul>
          </div>
        )}
      </Space>
    </Card>
  )
}
