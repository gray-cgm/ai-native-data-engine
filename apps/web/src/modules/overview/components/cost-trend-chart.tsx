import { useMemo } from 'react'
import { Line } from '@ant-design/plots'
import { useNavigate } from 'react-router-dom'
import { Empty } from 'antd'
import type { PipelineRunRow } from '../api'

interface Props {
  runs: PipelineRunRow[]
  /** Lookback window in days (default 14) */
  windowDays?: number
}

function dayKey(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function readCost(metrics: Record<string, unknown> | null | undefined): number {
  if (!metrics) return 0
  const v = metrics['cost_usd']
  return typeof v === 'number' ? v : 0
}

/**
 * Line chart: daily PipelineRun cost over a lookback window.
 * Click a point → /pipelines?tab=cost (drilldown).
 *
 * MVP: Aggregation is client-side; for high-volume backends move to a
 * /pipelines/cost-by-day endpoint (P3).
 */
export function CostTrendChart({ runs, windowDays = 14 }: Props) {
  const navigate = useNavigate()

  const data = useMemo(() => {
    const now = new Date()
    const buckets: Record<string, number> = {}
    for (let i = windowDays - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      buckets[d.toISOString().slice(0, 10)] = 0
    }
    for (const run of runs) {
      const k = dayKey(run.completed_at ?? run.started_at ?? run.created_at)
      if (!k || !(k in buckets)) continue
      buckets[k] += readCost(run.metrics)
    }
    return Object.entries(buckets).map(([day, cost]) => ({ day, cost: Number(cost.toFixed(4)) }))
  }, [runs, windowDays])

  const total = data.reduce((s, d) => s + d.cost, 0)

  if (total === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="近 14 天暂无 cost_usd 数据；run.metrics 内未上报 cost。"
      />
    )
  }

  return (
    <Line
      data={data}
      xField="day"
      yField="cost"
      height={220}
      point={{ shapeField: 'circle', sizeField: 4 }}
      style={{ lineWidth: 2 }}
      axis={{
        x: { title: null, labelFontSize: 11 },
        y: { title: 'cost (USD)', labelFontSize: 11 },
      }}
      tooltip={{
        items: [{ name: 'Cost (USD)', channel: 'y' }],
      }}
      onReady={({ chart }) => {
        chart.on('plot:click', () => navigate('/pipelines?tab=cost'))
      }}
    />
  )
}
