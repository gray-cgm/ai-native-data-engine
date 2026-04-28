import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, Breadcrumb, Button, Card, Col, Descriptions, Row, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { apiGet } from '@/shared/api/client'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { StatusBadge } from '@/shared/components/status-badge'
import { TableCellText } from '@/shared/components/table-cell-text'
import type { DataTaskView } from '../api'
import { fetchPipelineRuns, type PipelineRunRow } from '@/modules/pipelines/api'

const { Text, Title } = Typography

type OperationsTask = {
  id: string
  title: string
  module: string
  status: string
  data_task_id: string
  requirement_id?: string | null
  assignee?: string | null
  created_at: string
}

async function fetchDataTask(id: string): Promise<DataTaskView> {
  return apiGet<DataTaskView>(`/data-tasks/${encodeURIComponent(id)}`)
}

async function fetchOperationsTasks(dataTaskId: string): Promise<OperationsTask[]> {
  const res = await apiGet<{ items: OperationsTask[] }>(
    `/operations-tasks?data_task_id=${encodeURIComponent(dataTaskId)}`,
  )
  return res.items ?? []
}

export default function DataTaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const [task, setTask] = useState<DataTaskView | null>(null)
  const [opsTasks, setOpsTasks] = useState<OperationsTask[]>([])
  const [runs, setRuns] = useState<PipelineRunRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const [taskData, opsList, runList] = await Promise.all([
        fetchDataTask(id),
        fetchOperationsTasks(id).catch(() => []),
        fetchPipelineRuns({ data_task_id: id }).catch(() => []),
      ])
      setTask(taskData)
      setOpsTasks(opsList)
      setRuns(runList)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (taskId) load(taskId)
  }, [taskId, load])

  if (loading) return <PageLoading />
  if (error || !task) {
    return (
      <PageContainer title="Data Task">
        <Alert type="error" showIcon message="Failed to load data task" description={error ?? 'Not found'} />
      </PageContainer>
    )
  }

  const opsColumns: ColumnsType<OperationsTask> = [
    { key: 'title', title: 'Title', dataIndex: 'title', width: 240,
      render: (t: string) => <TableCellText value={t} maxWidth={240} /> },
    { key: 'module', title: 'Module', dataIndex: 'module', width: 130,
      render: (m: string) => <Tag color="cyan">{m}</Tag> },
    { key: 'status', title: 'Status', dataIndex: 'status', width: 110,
      render: (s: string) => <StatusBadge status={s} /> },
    { key: 'assignee', title: 'Assignee', dataIndex: 'assignee', width: 140,
      render: (v?: string | null) => v || '—' },
    {
      key: 'open_ops',
      title: 'Open',
      width: 140,
      render: (_: unknown, row: OperationsTask) => {
        // 让 PM 一键跳到对应 ops 子模块，并把 dataTask 过滤预填好。
        const m = row.module?.toLowerCase()
        if (!m) return <Text type="secondary">—</Text>
        const params = new URLSearchParams()
        if (row.requirement_id) params.set('requirement', row.requirement_id)
        params.set('dataTask', row.data_task_id)
        return (
          <Link to={`/ops/${m}?${params.toString()}`}>
            Open {m} →
          </Link>
        )
      },
    },
    { key: 'id', title: 'Ops Task ID', dataIndex: 'id', width: 200,
      render: (v: string) => <TableCellText value={v} maxWidth={200} code /> },
  ]

  const runColumns: ColumnsType<PipelineRunRow> = [
    { key: 'pipeline_name', title: 'Pipeline', dataIndex: 'pipeline_name', width: 180,
      render: (t: string) => <TableCellText value={t} maxWidth={180} /> },
    { key: 'stage', title: 'Stage', dataIndex: 'stage', width: 150,
      render: (t: string) => <Tag>{t}</Tag> },
    { key: 'status', title: 'Status', dataIndex: 'status', width: 100,
      render: (s: string) => <StatusBadge status={s} /> },
    { key: 'trigger_source', title: 'Trigger', dataIndex: 'trigger_source', width: 120,
      render: (t: string) => <Tag color="orange">{t}</Tag> },
    { key: 'run_purpose', title: 'Purpose', dataIndex: 'run_purpose', width: 110,
      render: (t: string) => <Tag color="magenta">{t}</Tag> },
    { key: 'x_trace_id', title: 'x_trace_id', dataIndex: 'x_trace_id', width: 180,
      render: (t?: string | null) => <TableCellText value={t} maxWidth={180} code /> },
    { key: 'created_at', title: 'Created', dataIndex: 'created_at', width: 160,
      render: (t: string) => <Text type="secondary" style={{ fontSize: 12 }}>{t}</Text> },
  ]

  const progress = task.target_count > 0
    ? Math.min(100, Math.round((task.actual_count / task.target_count) * 100))
    : 0

  return (
    <PageContainer
      title={task.title}
      description={`DataTask 详情：关联 Operations Tasks 与 Pipeline Runs 的全链路视图。`}
      actions={
        <Space>
          <Link to={`/requirements/${task.requirement_id}`}>
            <Button icon={<ArrowLeftOutlined />}>Back to Requirement</Button>
          </Link>
          <Link to={`/pipelines?tab=runs&data_task_id=${encodeURIComponent(task.id)}`}>
            <Button type="primary">View in Pipelines</Button>
          </Link>
        </Space>
      }
    >
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <Link to="/requirements">Requirements</Link> },
          { title: <Link to={`/requirements/${task.requirement_id}`}>Requirement</Link> },
          { title: 'Data Task' },
        ]}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="Basic Info">
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="ID" span={2}><Text code>{task.id}</Text></Descriptions.Item>
              <Descriptions.Item label="Type"><Tag color="blue">{task.task_type}</Tag></Descriptions.Item>
              <Descriptions.Item label="Status"><StatusBadge status={task.status} /></Descriptions.Item>
              <Descriptions.Item label="Sign-off"><StatusBadge status={task.sign_off_status} /></Descriptions.Item>
              <Descriptions.Item label="Assignee">{task.assigned_to || '—'}</Descriptions.Item>
              <Descriptions.Item label="Progress">
                {task.actual_count} / {task.target_count} ({progress}%)
              </Descriptions.Item>
              <Descriptions.Item label="Due date">{task.due_date || '—'}</Descriptions.Item>
              <Descriptions.Item label="Description" span={2}>
                {task.description || <Text type="secondary">—</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Created">{task.created_at}</Descriptions.Item>
              <Descriptions.Item label="Updated">{task.updated_at}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Sign-off">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <div><Text type="secondary">Status: </Text><StatusBadge status={task.sign_off_status} /></div>
              <div><Text type="secondary">By: </Text><Text>{task.sign_off_by || '—'}</Text></div>
              <div><Text type="secondary">At: </Text><Text>{task.sign_off_at || '—'}</Text></div>
              <div><Text type="secondary">Comment: </Text><Text>{task.sign_off_comment || '—'}</Text></div>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card
        title={<Title level={5} style={{ margin: 0 }}>Operations Tasks ({opsTasks.length})</Title>}
        style={{ marginTop: 16 }}
        extra={<Text type="secondary">由该 DataTask 派生的运维执行单</Text>}
      >
        <Table<OperationsTask>
          className="app-data-table"
          columns={opsColumns}
          dataSource={opsTasks}
          rowKey={(r) => r.id}
          size="small"
          tableLayout="fixed"
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 8, size: 'small', showSizeChanger: false }}
          locale={{ emptyText: '暂无 Operations Task，可在 Requirement 详情页选择「Create/Open Ops Task」。' }}
        />
      </Card>

      <Card
        title={<Title level={5} style={{ margin: 0 }}>Pipeline Runs ({runs.length})</Title>}
        style={{ marginTop: 16 }}
        extra={
          <Link to={`/pipelines?tab=runs&data_task_id=${encodeURIComponent(task.id)}`}>
            <Button type="link" size="small">Open in Pipelines →</Button>
          </Link>
        }
      >
        <Table<PipelineRunRow>
          className="app-data-table"
          columns={runColumns}
          dataSource={runs}
          rowKey={(r) => r.id}
          size="small"
          tableLayout="fixed"
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 8, size: 'small', showSizeChanger: false }}
          locale={{ emptyText: '暂无 Pipeline Run。可运行 make seed-trace-demo 生成示例数据。' }}
        />
      </Card>
    </PageContainer>
  )
}
