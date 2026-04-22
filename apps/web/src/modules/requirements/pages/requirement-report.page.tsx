import { useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Alert, Button, Card, Col, Descriptions, Row, Space, Statistic, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { BarChartOutlined, FileSearchOutlined, RobotOutlined } from '@ant-design/icons'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { PageError } from '@/shared/components/page-error'
import { StatusBadge } from '@/shared/components/status-badge'
import { fetchRequirementReport, type RequirementReportView } from '../api'

const { Text } = Typography

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`
}

type GenericRow = Record<string, unknown>

const runColumns: ColumnsType<GenericRow> = [
  { key: 'run_id', title: 'Run ID', dataIndex: 'run_id' },
  { key: 'job_name', title: 'Job', dataIndex: 'job_name' },
  {
    key: 'status',
    title: 'Status',
    dataIndex: 'status',
    render: (status: string) => <StatusBadge status={status} />,
  },
  { key: 'trigger_source', title: 'Trigger', dataIndex: 'trigger_source', render: (v: string) => v ?? '—' },
  { key: 'reason_code', title: 'Reason', dataIndex: 'reason_code', render: (v: string) => v ?? '—' },
  {
    key: 'estimated_cost',
    title: 'Est. Cost',
    dataIndex: 'estimated_cost',
    render: (v?: number) => (typeof v === 'number' ? `$${v.toFixed(4)}` : '—'),
  },
]

const taskColumns: ColumnsType<GenericRow> = [
  { key: 'task_id', title: 'Task ID', dataIndex: 'task_id' },
  { key: 'title', title: 'Title', dataIndex: 'title' },
  { key: 'task_type', title: 'Type', dataIndex: 'task_type' },
  {
    key: 'status',
    title: 'Status',
    dataIndex: 'status',
    render: (status: string) => <StatusBadge status={status} />,
  },
  { key: 'pipeline_run_id', title: 'Run', dataIndex: 'pipeline_run_id', render: (v: string) => v ?? '—' },
]

const exportColumns: ColumnsType<GenericRow> = [
  { key: 'export_id', title: 'Export ID', dataIndex: 'export_id' },
  { key: 'dataset_id', title: 'Dataset', dataIndex: 'dataset_id' },
  { key: 'format', title: 'Format', dataIndex: 'format' },
  {
    key: 'status',
    title: 'Status',
    dataIndex: 'status',
    render: (status: string) => <StatusBadge status={status} />,
  },
]

export default function RequirementReportPage() {
  const { id } = useParams<{ id: string }>()
  const fetcher = useCallback(() => fetchRequirementReport(id!), [id])
  const { data, state, error, refetch } = useQuery<RequirementReportView>(fetcher, {
    cacheKey: `requirement-report:${id}`,
  })

  if (state === 'loading') {
    return <PageLoading message="Building requirement report..." />
  }

  if (state === 'error') {
    return <PageError message={error?.message} onRetry={refetch} />
  }

  if (!data) {
    return (
      <PageContainer title="Requirement Report">
        <Card>
          <Text type="secondary">No report data available.</Text>
        </Card>
      </PageContainer>
    )
  }

  const result = data.result_summary
  const cost = data.cost_summary

  return (
    <PageContainer
      title="Requirement Report"
      description={`${data.requirement.title} · ${data.requirement.id}`}
      actions={
        <Space>
          <Link to={`/requirements/${data.requirement.id}`}><Button>Back to Requirement</Button></Link>
          <Button icon={<BarChartOutlined />} disabled={!data.automation.superset.can_auto_create}>
            Create Superset Dashboard (Planned)
          </Button>
          <Button icon={<RobotOutlined />}>
            Trigger LLM Analysis (Planned)
          </Button>
        </Space>
      }
    >
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}><Statistic title="Data Tasks" value={result.data_task_count} /></Col>
        <Col xs={24} md={8}><Statistic title="Operations Tasks" value={result.operations_task_count} /></Col>
        <Col xs={24} md={8}><Statistic title="Pipeline Runs" value={result.run_count} /></Col>
        <Col xs={24} md={8}><Statistic title="Signed Off" value={result.data_task_signed_off_count} /></Col>
        <Col xs={24} md={8}><Statistic title="Export Artifacts" value={result.export_count} /></Col>
        <Col xs={24} md={8}><Statistic title="Latest Run Status" value={result.latest_run_status ?? 'n/a'} /></Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="Result Summary">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Target Samples">{result.total_target_count.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Actual Samples">{result.total_actual_count.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Completed Data Tasks">{result.data_task_completed_count}</Descriptions.Item>
              <Descriptions.Item label="Requirement Status">
                <StatusBadge status={data.requirement.status} />
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Cost Summary">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Estimated Cost">${cost.estimated_cost.toFixed(4)}</Descriptions.Item>
              <Descriptions.Item label="Duration">{Math.round(cost.duration_seconds)}s</Descriptions.Item>
              <Descriptions.Item label="CPU Seconds">{Math.round(cost.cpu_seconds)}s</Descriptions.Item>
              <Descriptions.Item label="GPU Seconds">{Math.round(cost.gpu_seconds)}s</Descriptions.Item>
              <Descriptions.Item label="Input">{formatBytes(cost.input_bytes)}</Descriptions.Item>
              <Descriptions.Item label="Output">{formatBytes(cost.output_bytes)}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <Card title="Automation Plan" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={8}>
          <Tag color={data.automation.superset.can_auto_create ? 'blue' : 'default'}>
            Superset: {data.automation.superset.status}
          </Tag>
          <Text type="secondary">Dashboard name: {data.automation.superset.dashboard_name}</Text>
          <Tag color="purple">LLM Analysis: {data.automation.llm_analysis.status}</Tag>
          <Text type="secondary">Trigger mode: {data.automation.llm_analysis.trigger}</Text>
          <Alert
            type="info"
            showIcon
            icon={<FileSearchOutlined />}
            message="Current stage"
            description="This page already aggregates requirement outcome and cost data. Superset auto-create and LLM narrative generation are exposed as planned triggers and can be wired to backend jobs in the next iteration."
          />
        </Space>
      </Card>

      <Card title="Linked Operations Tasks" style={{ marginBottom: 16 }}>
        <Table<GenericRow>
          columns={taskColumns}
          dataSource={data.linked_items.operations_tasks}
          rowKey={(row) => String(row.task_id ?? Math.random())}
          pagination={{ pageSize: 6 }}
          size="small"
        />
      </Card>

      <Card title="Linked Pipeline Runs" style={{ marginBottom: 16 }}>
        <Table<GenericRow>
          columns={runColumns}
          dataSource={data.linked_items.runs}
          rowKey={(row) => String(row.run_id ?? Math.random())}
          pagination={{ pageSize: 6 }}
          size="small"
        />
      </Card>

      <Card title="Linked Exports">
        <Table<GenericRow>
          columns={exportColumns}
          dataSource={data.linked_items.exports}
          rowKey={(row) => String(row.export_id ?? Math.random())}
          pagination={{ pageSize: 6 }}
          size="small"
        />
      </Card>
    </PageContainer>
  )
}
