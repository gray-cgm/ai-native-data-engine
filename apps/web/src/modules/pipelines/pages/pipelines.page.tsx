import { useMemo } from 'react'
import { Tabs, Typography } from 'antd'
import { useSearchParams } from 'react-router-dom'
import { PageContainer } from '@/shared/components/page-container'
import { CostView } from '../components/cost-view'
import { LineageView } from '../components/lineage-view'
import { OverviewView } from '../components/overview-view'
import { QualityView } from '../components/quality-view'
import { RunsView } from '../components/runs-view'

const TAB_KEYS = ['overview', 'runs', 'lineage', 'quality', 'cost'] as const
type TabKey = typeof TAB_KEYS[number]

function isTabKey(value: string | null): value is TabKey {
  return value !== null && (TAB_KEYS as readonly string[]).includes(value)
}

const SUBTITLES: Record<TabKey, string> = {
  overview: '概览：批处理 Dagster Runs 与流式事件Kafka Pipeline 的综合态势。',
  runs: 'Runs：所有 PipelineRun 的全链路过滤（x_trace_id / Requirement / OperationsTask），点击行查看 RunDetail 抽屉。',
  lineage: 'Lineage：按 x_trace_id 聚合的 DAG 血缘视图 — Requirement → DataTask → OperationsTask → Run。',
  quality: 'Quality：Gate 结果分布、失败原因 Top-N，按 run_purpose / stage 维度钻取。',
  cost: 'Cost：运行成本归因（Requirement / Pipeline / Stage / Purpose）以及 CPU/GPU/Storage 汇总。',
}

export default function PipelinesPage() {
  const [params, setParams] = useSearchParams()
  const rawTab = params.get('tab')
  const active: TabKey = isTabKey(rawTab) ? rawTab : 'overview'

  const items = useMemo(() => [
    { key: 'overview', label: 'Overview', children: <OverviewView /> },
    { key: 'runs', label: 'Runs', children: <RunsView /> },
    { key: 'lineage', label: 'Lineage', children: <LineageView /> },
    { key: 'quality', label: 'Quality', children: <QualityView /> },
    { key: 'cost', label: 'Cost', children: <CostView /> },
  ], [])

  return (
    <PageContainer title="Pipelines" description={SUBTITLES[active]}>
      <Tabs
        activeKey={active}
        onChange={(k) => {
          const next = new URLSearchParams(params)
          next.set('tab', k)
          setParams(next, { replace: true })
        }}
        items={items}
        renderTabBar={() => <></>}
        destroyInactiveTabPane
      />
      {active !== 'runs' ? null : (
        <Typography.Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
          提示：点击 Runs 列表的任意一行打开 RunDetail 抽屉，查看 Requirement → DataTask → OperationsTask → Run 四层面包屑与 trace keys。
        </Typography.Paragraph>
      )}
    </PageContainer>
  )
}
