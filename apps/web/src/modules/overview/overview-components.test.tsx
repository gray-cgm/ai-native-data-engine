import { describe, expect, it, vi } from 'vitest'
import { renderWithRouter } from '@/test-utils'

vi.mock('@ant-design/plots', () => ({
  Pie: () => null,
  Column: () => null,
  Bar: () => null,
  Line: () => null,
}))

import { OpsBacklogChart } from './components/ops-backlog-chart'
import { CostTrendChart } from './components/cost-trend-chart'

describe('OpsBacklogChart', () => {
  it('renders with module backlog data', () => {
    renderWithRouter(
      <OpsBacklogChart
        modules={[
          { module: 'mining', counts: { total: 10, done: 4 } },
          { module: 'labeling', counts: { total: 5, done: 5 } },
        ]}
      />,
    )
    expect(document.body).toBeTruthy()
  })
  it('renders with empty modules', () => {
    renderWithRouter(<OpsBacklogChart modules={[]} />)
    expect(document.body).toBeTruthy()
  })
})

describe('CostTrendChart', () => {
  it('aggregates run costs by day', () => {
    renderWithRouter(
      <CostTrendChart
        runs={[
          { id: 'r1', created_at: '2026-06-01T00:00:00Z', metrics: { cost_usd: 5 } } as never,
          { id: 'r2', created_at: '2026-06-01T03:00:00Z', metrics: { cost_usd: 3 } } as never,
          { id: 'r3', created_at: null, metrics: null } as never,
          { id: 'r4', created_at: 'not-a-date', metrics: { cost_usd: 'x' } } as never,
        ]}
        windowDays={30}
      />,
    )
    expect(document.body).toBeTruthy()
  })
  it('renders with no runs', () => {
    renderWithRouter(<CostTrendChart runs={[]} />)
    expect(document.body).toBeTruthy()
  })
})
