import type { DistributionRow } from '@/shared/types/common'

interface DistributionChartProps {
  data: DistributionRow[]
}

export function DistributionChart({ data }: DistributionChartProps) {
  if (data.length === 0) return <p className="text-muted">No data</p>

  const max = Math.max(...data.map((r) => r.sample_count))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
      {data.map((row) => (
        <div key={row.scene} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          <span style={{ width: 120, fontSize: 'var(--font-size-sm)', flexShrink: 0 }}>{row.scene}</span>
          <div style={{ flex: 1, background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)', height: 24 }}>
            <div
              style={{
                width: `${(row.sample_count / max) * 100}%`,
                height: '100%',
                background: 'var(--color-accent)',
                borderRadius: 'var(--radius-sm)',
                minWidth: 2,
              }}
            />
          </div>
          <span style={{ width: 48, textAlign: 'right', fontSize: 'var(--font-size-sm)' }}>{row.sample_count}</span>
        </div>
      ))}
    </div>
  )
}
