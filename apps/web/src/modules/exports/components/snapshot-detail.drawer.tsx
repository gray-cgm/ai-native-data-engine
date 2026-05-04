import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert, Button, Descriptions, Drawer, Empty, Form, Input, Modal, Space, Spin, Statistic, Table, Tag, Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { TableCellText } from '@/shared/components/table-cell-text'
import { IdCell } from '@/shared/components/id-cell'
import { createTrainRun, fetchSnapshotDetail, type SnapshotDetail, type TrainRun } from '../api'

const { Text, Paragraph } = Typography

function formatTs(ts: string | null) {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  return d.toLocaleString()
}

interface Props {
  traceId: string | null
  onClose: () => void
  onChanged?: () => void
}

export function SnapshotDetailDrawer({ traceId, onClose, onChanged }: Props) {
  const [data, setData] = useState<SnapshotDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registerOpen, setRegisterOpen] = useState(false)

  const load = useCallback((trace: string) => {
    setLoading(true)
    setError(null)
    fetchSnapshotDetail(trace)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (traceId) load(traceId)
    else { setData(null); setError(null) }
  }, [traceId, load])

  const runColumns: ColumnsType<TrainRun> = useMemo(() => [
    { key: 'name', title: 'Name', dataIndex: 'name', width: 160,
      render: (t: string | null) => <TableCellText value={t} maxWidth={160} /> },
    { key: 'consumer', title: 'Consumer', dataIndex: 'consumer', width: 140,
      render: (t: string | null) => <TableCellText value={t} maxWidth={140} /> },
    { key: 'status', title: 'Status', dataIndex: 'status', width: 110,
      render: (s: string) => <Tag color={s === 'completed' ? 'green' : s === 'failed' ? 'red' : 'blue'}>{s}</Tag> },
    { key: 'external_run_id', title: 'External run', dataIndex: 'external_run_id', width: 200,
      render: (t: string | null) => <IdCell value={t} variant="mono-ellipsis" maxWidth={160} /> },
    { key: 'model_version', title: 'Model', dataIndex: 'model_version', width: 130,
      render: (t: string | null) => <TableCellText value={t} maxWidth={130} /> },
    { key: 'started_at', title: 'Started', dataIndex: 'started_at', width: 170,
      render: (t: string | null) => <Text type="secondary">{formatTs(t)}</Text> },
    { key: 'finished_at', title: 'Finished', dataIndex: 'finished_at', width: 170,
      render: (t: string | null) => <Text type="secondary">{formatTs(t)}</Text> },
  ], [])

  return (
    <Drawer
      title={
        <Space direction="vertical" size={0} style={{ minWidth: 0 }}>
          <Text strong>Snapshot detail</Text>
          {traceId ? <IdCell value={traceId} variant="full" /> : null}
        </Space>
      }
      width={760}
      open={!!traceId}
      onClose={onClose}
      destroyOnClose
      extra={
        <Space>
          <Button onClick={() => setRegisterOpen(true)} disabled={!data}>
            Register train run
          </Button>
        </Space>
      }
    >
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      {loading && !data && <Spin />}
      {data && (
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <Statistic title="Train runs" value={data.train_run_count} />
            <Statistic title="Sample consumed" value={data.consumed_count} />
            <Statistic title="Hard samples" value={data.hard_sample_count} />
            <Statistic title="Pipeline runs" value={data.pipeline_run_count} />
          </div>

          <Descriptions size="small" column={2} bordered title="Snapshot">
            <Descriptions.Item label="Title" span={2}>{data.title ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Scenario">{data.scenario ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Format">{data.export_format ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Dataset id">
              <IdCell value={data.dataset_id} variant="full" />
            </Descriptions.Item>
            <Descriptions.Item label="Dataset version">
              <IdCell value={data.dataset_version_id} variant="full" />
            </Descriptions.Item>
            <Descriptions.Item label="Artifact" span={2}>
              <IdCell value={data.export_artifact_uri} variant="full" />
            </Descriptions.Item>
            <Descriptions.Item label="Sealed at">{formatTs(data.sealed_at)}</Descriptions.Item>
            <Descriptions.Item label="Last consumed">{formatTs(data.last_consumed_at)}</Descriptions.Item>
            <Descriptions.Item label="Requirement" span={2}>
              <IdCell value={data.requirement_id} variant="full" />
            </Descriptions.Item>
          </Descriptions>

          {data.summary && (
            <Paragraph type="secondary" style={{ margin: 0 }}>{data.summary}</Paragraph>
          )}

          <div>
            <Text strong>Train runs ({data.train_runs.length})</Text>
            {data.train_runs.length === 0 ? (
              <Empty
                style={{ marginTop: 12 }}
                description="No train runs registered for this snapshot yet. Register one manually, or wait for the dlkit SDK to auto-register."
              />
            ) : (
              <Table<TrainRun>
                style={{ marginTop: 12 }}
                rowKey="id"
                size="small"
                columns={runColumns}
                dataSource={data.train_runs}
                pagination={false}
                scroll={{ x: 900 }}
              />
            )}
          </div>
        </Space>
      )}

      <RegisterTrainRunModal
        open={registerOpen}
        traceId={data?.x_trace_id ?? null}
        onClose={() => setRegisterOpen(false)}
        onSuccess={() => {
          setRegisterOpen(false)
          if (traceId) load(traceId)
          onChanged?.()
        }}
      />
    </Drawer>
  )
}

interface RegisterModalProps {
  open: boolean
  traceId: string | null
  onClose: () => void
  onSuccess: () => void
}

function RegisterTrainRunModal({ open, traceId, onClose, onSuccess }: RegisterModalProps) {
  const [form] = Form.useForm<{
    name?: string
    consumer?: string
    external_run_id?: string
    model_version?: string
    notes?: string
  }>()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) { form.resetFields(); setError(null) }
  }, [open, form])

  const handleOk = async () => {
    if (!traceId) return
    try {
      const values = await form.validateFields()
      setSubmitting(true); setError(null)
      await createTrainRun({
        snapshot_ids: [traceId],
        ...values,
      })
      onSuccess()
    } catch (e) {
      const err = e as Error
      if (err?.message) setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Register train run"
      okText="Register"
      confirmLoading={submitting}
      onOk={handleOk}
      onCancel={onClose}
      destroyOnClose
    >
      <Paragraph type="secondary" style={{ fontSize: 12 }}>
        Manually attach a TrainRun to this snapshot. Once dlkit SDK ships in P1, this is auto-registered.
      </Paragraph>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="Run name">
          <Input placeholder="e.g. mining-net-v3-day1" />
        </Form.Item>
        <Form.Item name="consumer" label="Consumer (user/team)">
          <Input placeholder="e.g. perception-team" />
        </Form.Item>
        <Form.Item name="external_run_id" label="External run id">
          <Input placeholder="MLflow / W&B / Kubeflow run id" />
        </Form.Item>
        <Form.Item name="model_version" label="Model version">
          <Input placeholder="e.g. v0.4.1" />
        </Form.Item>
        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={2} placeholder="optional" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
