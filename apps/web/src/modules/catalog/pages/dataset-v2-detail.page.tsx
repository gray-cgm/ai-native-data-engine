import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'

import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { PageError } from '@/shared/components/page-error'
import { DataTable } from '@/shared/components/data-table'
import { IdCell } from '@/shared/components/id-cell'
import {
  getDataset,
  listSamples,
  type DatasetSampleV2,
  type DatasetV2,
} from '@/modules/datasets/datasets-api'
import { TrainingImpactSection } from '@/modules/exports/components/training-impact-section'

const { Text, Paragraph } = Typography

function formatTs(ns: number | null | undefined): string {
  if (ns == null) return '—'
  return new Date(ns / 1e6).toLocaleString()
}

export default function DatasetV2DetailPage() {
  const { datasetId = '' } = useParams<{ datasetId: string }>()
  const decoded = decodeURIComponent(datasetId)

  const fetcher = useCallback(() => getDataset(decoded), [decoded])
  const detail = useQuery(fetcher, { cacheKey: `catalog:dataset-v2:${decoded}` })

  const samplesFetcher = useCallback(
    () => listSamples(decoded, { limit: 200 }),
    [decoded],
  )
  const samples = useQuery(samplesFetcher, {
    cacheKey: `catalog:dataset-v2:${decoded}:samples`,
    isEmpty: (d) => (d?.items ?? []).length === 0,
  })

  const [keyword, setKeyword] = useState('')

  if (detail.state === 'loading') return <PageLoading message="Loading dataset…" />
  if (detail.state === 'error')
    return <PageError message={detail.error?.message} onRetry={detail.refetch} />
  if (!detail.data)
    return (
      <PageContainer title="Dataset not found">
        <Card>
          <Paragraph type="secondary">Dataset {decoded} not found.</Paragraph>
          <Link to="/catalog">
            <Button icon={<ArrowLeftOutlined />}>Back to Catalog</Button>
          </Link>
        </Card>
      </PageContainer>
    )

  const ds: DatasetV2 = detail.data.item
  const sampleCount = detail.data.sample_count
  const items = (samples.data?.items ?? []).filter((s) =>
    keyword
      ? [s.clip_id, s.ts_origin, s.origin_ref ?? '', s.training_type]
          .join(' ')
          .toLowerCase()
          .includes(keyword.toLowerCase())
      : true,
  )

  const promotedFrom =
    ds.resolved_meta && typeof ds.resolved_meta === 'object'
      ? (ds.resolved_meta as Record<string, unknown>).promoted_from
      : null

  return (
    <PageContainer
      title={ds.name}
      description={`${ds.dataset_type === 'official' ? 'Official' : 'Customized'} dataset · v${ds.dataset_version}`}
      actions={
        <Link to="/catalog">
          <Button icon={<ArrowLeftOutlined />}>Back to Catalog</Button>
        </Link>
      }
    >
      <Breadcrumb
        style={{ marginBottom: 12 }}
        items={[
          { title: <Link to="/catalog">Catalog</Link> },
          {
            title: (
              <Link to={`/catalog?view=datasets`}>
                {ds.dataset_type === 'official' ? 'Official' : 'Customized'}
              </Link>
            ),
          },
          { title: ds.name },
        ]}
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Samples" value={sampleCount} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Version" value={`v${ds.dataset_version}`} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="Trainable"
              value={ds.allow_train ? 'yes' : 'no'}
              valueStyle={{ color: ds.allow_train ? '#52c41a' : undefined }}
            />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Status" value={ds.status} />
          </Card>
        </Col>
      </Row>

      {typeof promotedFrom === 'string' && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={
            <Space>
              <span>Promoted from customized dataset:</span>
              <Link to={`/catalog/v2/${encodeURIComponent(promotedFrom)}`}>
                <Text code>{promotedFrom}</Text>
              </Link>
            </Space>
          }
        />
      )}

      <Card title="Metadata" style={{ marginBottom: 16 }}>
        <Descriptions size="small" column={2} bordered>
          <Descriptions.Item label="ID">
            <Text copyable style={{ fontFamily: 'monospace' }}>{ds.id}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Type">
            <Tag color={ds.dataset_type === 'official' ? 'blue' : 'default'}>
              {ds.dataset_type}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Source type">{ds.source_type}</Descriptions.Item>
          <Descriptions.Item label="Slice strategy">
            <Space size={4}>
              <Tag>{ds.slice_strategy}</Tag>
              <Tag>{ds.ts_policy}</Tag>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Default range">
            [{ds.default_range_l}, {ds.default_range_r}]
          </Descriptions.Item>
          <Descriptions.Item label="Tag expr" span={2}>
            <Text code>{ds.tag_expr ?? '—'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Requirement">
            {ds.requirement_id ? (
              <Link to={`/requirements/${ds.requirement_id}`}>{ds.requirement_id.slice(0, 8)}…</Link>
            ) : (
              '—'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Created by">{ds.created_by}</Descriptions.Item>
          <Descriptions.Item label="Created at">
            {ds.created_at ? new Date(ds.created_at).toLocaleString() : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Updated at">
            {ds.updated_at ? new Date(ds.updated_at).toLocaleString() : '—'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <TrainingImpactSection datasetId={ds.id} />

      <Card
        title={`Samples (${samples.data?.total ?? sampleCount})`}
        extra={
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="filter by clip / origin / training_type"
            style={{
              padding: '4px 8px',
              border: '1px solid #d9d9d9',
              borderRadius: 4,
              minWidth: 280,
            }}
          />
        }
      >
        {samples.state === 'loading' && <Paragraph type="secondary">Loading samples…</Paragraph>}
        {samples.state === 'error' && (
          <Alert type="error" message={samples.error?.message ?? 'Failed to load samples'} />
        )}
        {samples.state === 'empty' && <Empty description="No samples in this dataset yet." />}
        {samples.state === 'ready' && (
          <DataTable<DatasetSampleV2>
            rowHref={(row) =>
              `/explorer/clips/${encodeURIComponent(row.clip_id)}?ts=${row.ts}&dataset=${encodeURIComponent(ds.id)}`
            }
            columns={[
              {
                key: 'clip_id',
                header: 'Clip',
                width: 280,
                render: (row) => <IdCell value={row.clip_id} variant="mono-ellipsis" maxWidth={240} />,
              },
              {
                key: 'ts',
                header: 'Center ts',
                render: (row) => (
                  <Space direction="vertical" size={0}>
                    <Text code style={{ fontSize: 12 }}>{row.ts}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {formatTs(row.ts)}
                    </Text>
                  </Space>
                ),
              },
              {
                key: 'range',
                header: 'Range [l, r]',
                render: (row) => `[${row.range_l}, ${row.range_r}]`,
              },
              {
                key: 'ts_origin',
                header: 'Origin',
                render: (row) => <Tag>{row.ts_origin}</Tag>,
              },
              {
                key: 'training_type',
                header: 'Split',
                render: (row) => <Tag color="geekblue">{row.training_type}</Tag>,
              },
              {
                key: 'origin_ref',
                header: 'Ref',
                render: (row) =>
                  row.origin_ref ? (
                    <Text style={{ fontSize: 11 }}>{row.origin_ref}</Text>
                  ) : (
                    <Text type="secondary">—</Text>
                  ),
              },
              {
                key: 'created_at',
                header: 'Created',
                render: (row) =>
                  row.created_at ? new Date(row.created_at).toLocaleString() : '—',
              },
            ]}
            data={items}
            rowKey={(row) => row.id}
          />
        )}
      </Card>
    </PageContainer>
  )
}
