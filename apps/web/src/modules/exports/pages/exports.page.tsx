import { useMemo } from 'react'
import { Tabs } from 'antd'
import { useSearchParams } from 'react-router-dom'
import { PageContainer } from '@/shared/components/page-container'
import { SnapshotsView } from '../components/snapshots-view'
import { ConsumersView } from '../components/consumers-view'
import { HardSamplesView } from '../components/hard-samples-view'
import { RoiView } from '../components/roi-view'
import { ContributionsView } from '../components/contributions-view'

const TAB_KEYS = ['snapshots', 'consumers', 'hard-samples', 'roi', 'contributions'] as const
type TabKey = typeof TAB_KEYS[number]

function isTabKey(value: string | null): value is TabKey {
  return value !== null && (TAB_KEYS as readonly string[]).includes(value)
}

const SUBTITLES: Record<TabKey, string> = {
  snapshots: 'Snapshots：每条 export 收据 + 训练消费计数。点击行查看详情、注册 train run。',
  consumers: 'Consumers：哪个 user / team 在哪个 snapshot 上跑了多少次训练。点击行下钻 sample 级消费事件。',
  'hard-samples': 'Hard Samples：mean_loss × log(1+consumed_count) 倒序，一键 Send to Mining。',
  roi: 'ROI：Dataset 级看板，消费次数 / 平均 loss / hard 占比；点行进 dataset 详情 Training Impact。',
  contributions: 'Contributions：sample_uid 查询单条 sample 的训练贡献度（loss 时间序列 + 关联 train_runs）。',
}

export default function ExportsPage() {
  const [params, setParams] = useSearchParams()
  const rawTab = params.get('tab')
  const active: TabKey = isTabKey(rawTab) ? rawTab : 'snapshots'

  const items = useMemo(() => [
    { key: 'snapshots', label: 'Snapshots', children: <SnapshotsView /> },
    { key: 'consumers', label: 'Consumers', children: <ConsumersView /> },
    { key: 'hard-samples', label: 'Hard Samples', children: <HardSamplesView /> },
    { key: 'roi', label: 'ROI', children: <RoiView /> },
    { key: 'contributions', label: 'Contributions', children: <ContributionsView /> },
  ], [])

  return (
    <PageContainer title="Exports" description={SUBTITLES[active]}>
      <Tabs
        activeKey={active}
        onChange={(k) => {
          const next = new URLSearchParams(params)
          next.set('tab', k)
          setParams(next, { replace: true })
        }}
        items={items}
        destroyInactiveTabPane
      />
    </PageContainer>
  )
}
