import { useEffect, useState } from 'react'
import { Alert, Card, Input, Space, Typography } from 'antd'
import { useSearchParams } from 'react-router-dom'
import { ContributionDrawer } from './contribution.drawer'

const { Text } = Typography

/** Standalone tab: enter a sample_uid → drilldown drawer.
 *  URL ?sample_uid= keeps deep links working. */
export function ContributionsView() {
  const [params, setParams] = useSearchParams()
  const initial = params.get('sample_uid') ?? ''
  const [input, setInput] = useState(initial)
  const [active, setActive] = useState<string | null>(initial || null)

  useEffect(() => {
    const next = params.get('sample_uid')
    if (next !== active) setActive(next || null)
    if (next !== input) setInput(next ?? '')
    // we deliberately want only param-driven sync; not listening to local state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const open = (uid: string) => {
    const trimmed = uid.trim()
    if (!trimmed) return
    setActive(trimmed)
    const next = new URLSearchParams(params)
    next.set('sample_uid', trimmed)
    setParams(next, { replace: true })
  }

  const close = () => {
    setActive(null)
    const next = new URLSearchParams(params)
    next.delete('sample_uid')
    setParams(next, { replace: true })
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card size="small">
        <Space.Compact style={{ width: '100%', maxWidth: 720 }}>
          <Input
            placeholder="sample_uid（dataset_id:clip_id:ts），从 Hard Samples Tab 复制即可"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={() => open(input)}
            allowClear
          />
          <button
            className="ant-btn ant-btn-primary"
            type="button"
            onClick={() => open(input)}
            disabled={!input.trim()}
          >Lookup</button>
        </Space.Compact>
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            URL 支持 deep link：<code>/exports?tab=contributions&amp;sample_uid=...</code>
          </Text>
        </div>
      </Card>

      {!active && (
        <Alert
          type="info"
          showIcon
          message="选一条 sample_uid 后查看：消费次数、loss 时间序列、关联 train_runs / snapshots。"
        />
      )}

      <ContributionDrawer sampleUid={active} onClose={close} />
    </Space>
  )
}
