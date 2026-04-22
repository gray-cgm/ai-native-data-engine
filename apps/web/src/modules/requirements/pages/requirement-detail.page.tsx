import { useCallback, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Button, Card, Descriptions, Row, Col, Space, Tag, Typography } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { PageError } from '@/shared/components/page-error'
import { PageSuccess } from '@/shared/components/page-success'
import { DataTable } from '@/shared/components/data-table'
import { StatusBadge } from '@/shared/components/status-badge'
import { fetchRequirementDetail, signOffTask } from '../api'
import type { DataTaskView } from '../api'

const { Text } = Typography

const PRIORITY_TAG_COLORS: Record<string, string> = {
  high: 'red',
  medium: 'orange',
  low: 'blue',
}

export default function RequirementDetailPage() {
  const { id } = useParams<{ id: string }>()
  const fetcher = useCallback(() => fetchRequirementDetail(id!), [id])
  const { data, state, error, refetch } = useQuery(fetcher, { cacheKey: `requirement:${id}` })
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [signingOff, setSigningOff] = useState<string | null>(null)

  async function handleSignOff(taskId: string, approved: boolean) {
    setSigningOff(taskId)
    try {
      await signOffTask(taskId, approved, 'admin')
      setSuccessMessage(approved ? 'Task approved successfully.' : 'Task rejected.')
      await refetch()
    } catch {
      setSuccessMessage('Sign-off failed. Please try again.')
    } finally {
      setSigningOff(null)
    }
  }

  if (state === 'loading') {
    return <PageLoading message="Loading requirement..." />
  }

  if (state === 'error') {
    return <PageError message={error?.message} onRetry={refetch} />
  }

  if (!data) {
    return (
      <PageContainer title="Requirement Not Found">
        <Card>
          <p className="text-muted">Requirement not found.</p>
          <Link to="/requirements"><Button>Back to Requirements</Button></Link>
        </Card>
      </PageContainer>
    )
  }

  const explorerSearchHref = (() => {
    const params = new URLSearchParams()
    params.set('requirement', data.id)
    const sceneTags = (data.scene_tags ?? []).filter(Boolean)
    if (sceneTags.length > 0) params.set('tags', sceneTags.join(','))
    if (data.target_scene) params.set('q', data.target_scene)
    else if (data.title) params.set('q', data.title)
    return `/explorer/search?${params.toString()}`
  })()

  return (
    <PageContainer
      title={data.title}
      description={`Requirement ${data.id.slice(0, 8)}… · ${data.source} · ${data.priority}`}
      actions={
        <Space>
          <Link to="/requirements"><Button>Back to list</Button></Link>
          <Link to={explorerSearchHref}>
            <Button type="primary" icon={<SearchOutlined />}>
              Search matching clips
            </Button>
          </Link>
        </Space>
      }
    >
      {successMessage && (
        <PageSuccess
          message={successMessage}
          onDismiss={() => setSuccessMessage(null)}
          autoCloseDuration={3000}
        />
      )}

      {/* Requirement Info Card */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="Requirement Info">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Status">
                <StatusBadge status={data.status} />
              </Descriptions.Item>
              <Descriptions.Item label="Priority">
                <Tag color={PRIORITY_TAG_COLORS[data.priority] ?? 'default'}>
                  {data.priority}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Source">{data.source}</Descriptions.Item>
              <Descriptions.Item label="DRE Owner">{data.dre_owner}</Descriptions.Item>
              <Descriptions.Item label="Due Date">{data.due_date ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Est. Volume">
                {data.estimated_data_volume != null ? data.estimated_data_volume.toLocaleString() : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Created">{new Date(data.created_at).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Updated">{new Date(data.updated_at).toLocaleString()}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Description & Tags">
            <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
              {data.description || <Text type="secondary">No description provided.</Text>}
            </p>
            {data.target_scene && (
              <p style={{ fontSize: 15, marginBottom: 12 }}>
                <strong>Target Scene:</strong> {data.target_scene}
              </p>
            )}
            <div style={{ fontSize: 15, marginBottom: 12 }}>
              <strong>Scene Tags:</strong>{' '}
              {(data.scene_tags ?? []).length > 0 ? (
                (data.scene_tags ?? []).map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))
              ) : (
                <Text type="secondary">None</Text>
              )}
            </div>
            <div style={{ fontSize: 15 }}>
              <strong>Vehicle Tags:</strong>{' '}
              {(data.vehicle_tags ?? []).length > 0 ? (
                (data.vehicle_tags ?? []).map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))
              ) : (
                <Text type="secondary">None</Text>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Data Tasks */}
      <Card title={`Data Tasks (${data.data_tasks.length})`}>
        {data.data_tasks.length === 0 ? (
          <Text type="secondary">No data tasks created for this requirement.</Text>
        ) : (
          <DataTable
            columns={[
              { key: 'title', header: 'Title' },
              { key: 'task_type', header: 'Type' },
              {
                key: 'status',
                header: 'Status',
                render: (row: DataTaskView) => <StatusBadge status={row.status} />,
              },
              { key: 'assigned_to', header: 'Assignee', render: (row: DataTaskView) => row.assigned_to || '—' },
              {
                key: 'sign_off_status',
                header: 'Sign-off',
                render: (row: DataTaskView) => <StatusBadge status={row.sign_off_status} />,
              },
              {
                key: '_progress',
                header: 'Progress',
                render: (row: DataTaskView) => `${row.actual_count} / ${row.target_count}`,
              },
              {
                key: '_actions',
                header: 'Actions',
                render: (row: DataTaskView) => {
                  if (row.sign_off_status !== 'pending') return null
                  const isProcessing = signingOff === row.id
                  return (
                    <Space>
                      <Button
                        type="primary"
                        size="small"
                        onClick={() => handleSignOff(row.id, true)}
                        loading={isProcessing}
                      >
                        Approve
                      </Button>
                      <Button
                        danger
                        size="small"
                        onClick={() => handleSignOff(row.id, false)}
                        loading={isProcessing}
                      >
                        Reject
                      </Button>
                    </Space>
                  )
                },
              },
            ]}
            data={data.data_tasks}
            rowKey={(row) => row.id}
          />
        )}
      </Card>
    </PageContainer>
  )
}
