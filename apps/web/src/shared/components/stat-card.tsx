import { Card, Statistic } from 'antd'

interface StatCardProps {
  label: string
  value: number | string
}

export function StatCard({ label, value }: StatCardProps) {
  return (
    <Card size="small" className="stat-card">
      <Statistic title={label} value={value} valueStyle={{ fontWeight: 600 }} />
    </Card>
  )
}
