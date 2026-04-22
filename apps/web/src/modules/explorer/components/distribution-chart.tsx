import { Progress, Space, Typography } from 'antd'
import type { DistributionRow } from '@/shared/types/common'

const { Text } = Typography

interface DistributionChartProps {
  data: DistributionRow[]
}

export function DistributionChart({ data }: DistributionChartProps) {
  if (data.length === 0) return <Text type="secondary">No data</Text>

  const max = Math.max(...data.map((r) => r.sample_count))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
      {data.map((row) => (
        <div key={row.scene} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text style={{ width: 120, flexShrink: 0, fontSize: 13 }}>{row.scene}</Text>
          <Progress
            percent={Math.round((row.sample_count / max) * 100)}
            showInfo={false}
            strokeColor="#2175ff"
            style={{ flex: 1, margin: 0 }}
          />
          <Text style={{ width: 48, textAlign: 'right', fontSize: 13 }}>{row.sample_count}</Text>
        </div>
      ))}
    </div>
  )
}
