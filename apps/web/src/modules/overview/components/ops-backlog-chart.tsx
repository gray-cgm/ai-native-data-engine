import { useMemo } from 'react'
import { Column } from '@ant-design/plots'
import { useNavigate } from 'react-router-dom'
import { Empty } from 'antd'
import type { OpsModuleSummary } from '../api'

interface Props {
  modules: OpsModuleSummary[]
}

const MODULE_LABEL: Record<string, string> = {
  mining: 'Mining',
  tagging: 'Tagging',
  labeling: 'Labeling',
  checking: 'Checking',
  privacy: 'Privacy',
  release: 'Release',
}

/**
 * Bar chart of OpsItem backlog per module.
 * Click a bar → /ops/{module}.
 *
 * "Backlog" = total OpsItems minus done — i.e. anything not yet shipped.
 */
export function OpsBacklogChart({ modules }: Props) {
  const navigate = useNavigate()

  const data = useMemo(() => modules.map((m) => {
    const total = m.counts.total ?? 0
    const done = m.counts.done ?? 0
    const backlog = Math.max(0, total - done)
    return {
      module: MODULE_LABEL[m.module] ?? m.module,
      moduleKey: m.module,
      backlog,
      done,
    }
  }), [modules])

  if (modules.length === 0) {
    return <Empty description="No ops modules data" image={Empty.PRESENTED_IMAGE_SIMPLE} />
  }

  return (
    <Column
      data={data}
      xField="module"
      yField="backlog"
      colorField="module"
      legend={false}
      height={220}
      label={{
        position: 'top',
        style: { fill: '#475569', fontSize: 12 },
      }}
      tooltip={{
        items: [
          { name: 'Backlog', channel: 'y' },
          { name: 'Done', field: 'done' },
        ],
      }}
      onReady={({ chart }) => {
        chart.on('plot:click', (evt: { data?: { data?: { moduleKey?: string } } }) => {
          const key = evt.data?.data?.moduleKey
          if (key) navigate(`/ops/${key}`)
        })
      }}
    />
  )
}
