import { Link } from 'react-router-dom'
import { Card, Col, Row, Space, Tag, Typography } from 'antd'
import type { OpsOverview, OpsStats } from '@/modules/operations/ops-modules-api'
import { MODULE_META, OPS_MODULES } from '@/modules/operations/ops-modules-api'

const { Text, Title } = Typography

interface Props {
  overview: OpsOverview | null
}

function findStats(overview: OpsOverview | null, key: string): OpsStats | undefined {
  return overview?.modules.find((m) => m.module === key)
}

function nonTotalEntries(counts: Record<string, number> | undefined) {
  return Object.entries(counts ?? {}).filter(([k]) => k !== 'total')
}

export function OperationsPulse({ overview }: Props) {
  return (
    <Card
      title="Operations Pulse"
      extra={<Link to="/ops">Open Tasks</Link>}
      style={{ marginBottom: 16 }}
    >
      <Row gutter={[12, 12]}>
        {OPS_MODULES.map((key) => {
          const meta = MODULE_META[key]
          const stats = findStats(overview, key)
          const total = stats?.counts.total ?? 0
          const entries = nonTotalEntries(stats?.counts).slice(0, 4)
          return (
            <Col xs={24} sm={12} lg={8} key={key}>
              <Card size="small" style={{ borderTop: `3px solid ${meta.accent}` }} hoverable>
                <Space
                  direction="vertical"
                  size={4}
                  style={{ width: '100%' }}
                >
                  <Link to={`/ops/${key}`} style={{ display: 'block' }}>
                    <Title level={5} style={{ margin: 0 }}>{meta.label}</Title>
                  </Link>
                  <Text type="secondary" style={{ fontSize: 12 }}>{meta.description}</Text>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 24, fontWeight: 600 }}>{total}</span>
                    <Text type="secondary">open items</Text>
                  </div>
                  {entries.length > 0 && (
                    <Space wrap size={4}>
                      {entries.map(([status, count]) => (
                        <Tag key={status} color="blue-inverse" style={{ fontSize: 11 }}>
                          {status}: {count}
                        </Tag>
                      ))}
                    </Space>
                  )}
                </Space>
              </Card>
            </Col>
          )
        })}
      </Row>
    </Card>
  )
}
