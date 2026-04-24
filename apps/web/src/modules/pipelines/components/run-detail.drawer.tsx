import { useEffect, useState } from 'react'
import { Alert, Descriptions, Drawer, Space, Spin, Tag, Timeline, Typography } from 'antd'
import type { RunBreadcrumb } from '../api'
import { fetchRunBreadcrumb } from '../api'

const { Text, Title } = Typography

type Props = {
  runId: string | null
  open: boolean
  onClose: () => void
}

function field(obj: Record<string, unknown> | null | undefined, key: string): string {
  if (!obj) return '—'
  const v = obj[key]
  if (v === null || v === undefined) return '—'
  return String(v)
}

export function RunDetailDrawer({ runId, open, onClose }: Props) {
  const [data, setData] = useState<RunBreadcrumb | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!runId || !open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchRunBreadcrumb(runId)
      .then((bc) => { if (!cancelled) setData(bc) })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [runId, open])

  const req = data?.requirement ?? null
  const dt = data?.data_task ?? null
  const ops = data?.operations_task ?? null
  const run = data?.run ?? {}

  return (
    <Drawer title="Pipeline Run Detail" width={720} open={open} onClose={onClose} destroyOnClose>
      {loading && <Spin />}
      {error && <Alert type="error" showIcon message="Failed to load run detail" description={error} />}
      {!loading && !error && data && (
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <div>
            <Title level={5} style={{ marginTop: 0 }}>Full-chain breadcrumb</Title>
            <Timeline
              items={[
                {
                  color: 'purple',
                  children: (
                    <>
                      <Text strong>Requirement </Text>
                      <Tag>{field(req, 'status')}</Tag>
                      <div><Text>{field(req, 'title')}</Text></div>
                      <Text type="secondary" code>{field(req, 'id')}</Text>
                    </>
                  ),
                },
                {
                  color: 'geekblue',
                  children: (
                    <>
                      <Text strong>DataTask </Text>
                      <Tag color="blue">{field(dt, 'task_type')}</Tag>
                      <Tag>{field(dt, 'status')}</Tag>
                      <div><Text>{field(dt, 'title')}</Text></div>
                      <Text type="secondary" code>{field(dt, 'id')}</Text>
                    </>
                  ),
                },
                {
                  color: 'cyan',
                  children: (
                    <>
                      <Text strong>OperationsTask </Text>
                      {ops && <Tag color="cyan">{field(ops, 'module')}</Tag>}
                      {ops && <Tag>{field(ops, 'status')}</Tag>}
                      <div><Text>{ops ? field(ops, 'title') : <Text type="secondary">无上层运维任务（直接来自 DataTask / Scheduler / External）</Text>}</Text></div>
                      {ops && <Text type="secondary" code>{field(ops, 'id')}</Text>}
                    </>
                  ),
                },
                {
                  color: 'green',
                  children: (
                    <>
                      <Text strong>PipelineRun </Text>
                      <Tag color="green">{field(run, 'status')}</Tag>
                      <Tag color="orange">{field(run, 'trigger_source')}</Tag>
                      <Tag color="magenta">{field(run, 'run_purpose')}</Tag>
                      <div><Text>{field(run, 'pipeline_name')} / stage={field(run, 'stage')}</Text></div>
                      <Text type="secondary" code>{field(run, 'id')}</Text>
                    </>
                  ),
                },
              ]}
            />
          </div>

          <div>
            <Title level={5}>Trace keys</Title>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="x_trace_id">
                <Text code>{field(run, 'x_trace_id')}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="trace_parent_id">
                <Text code>{field(run, 'trace_parent_id')}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="requirement_id">
                <Text code>{field(req, 'id')}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="data_task_id">
                <Text code>{field(dt, 'id')}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="operations_task_id">
                <Text code>{ops ? field(ops, 'id') : '—'}</Text>
              </Descriptions.Item>
            </Descriptions>
          </div>

          <div>
            <Title level={5}>Execution</Title>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Pipeline">{field(run, 'pipeline_name')}</Descriptions.Item>
              <Descriptions.Item label="Stage">{field(run, 'stage')}</Descriptions.Item>
              <Descriptions.Item label="Input URI"><Text code>{field(run, 'input_uri')}</Text></Descriptions.Item>
              <Descriptions.Item label="Output URI"><Text code>{field(run, 'output_uri')}</Text></Descriptions.Item>
              <Descriptions.Item label="Started at">{field(run, 'started_at')}</Descriptions.Item>
              <Descriptions.Item label="Completed at">{field(run, 'completed_at')}</Descriptions.Item>
            </Descriptions>
          </div>

          {run && (run as Record<string, unknown>).metrics !== undefined && (run as Record<string, unknown>).metrics !== null && (
            <div>
              <Title level={5}>Metrics</Title>
              <pre style={{ background: '#fafafa', padding: 12, borderRadius: 4, fontSize: 12 }}>
                {JSON.stringify((run as Record<string, unknown>).metrics, null, 2)}
              </pre>
            </div>
          )}
        </Space>
      )}
    </Drawer>
  )
}
