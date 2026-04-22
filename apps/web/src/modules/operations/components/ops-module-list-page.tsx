import { useCallback, useMemo, useState } from 'react'
import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { PageError } from '@/shared/components/page-error'
import { DataTable } from '@/shared/components/data-table'
import { StatusBadge } from '@/shared/components/status-badge'
import {
  MODULE_META,
  createOpsItem,
  deleteOpsItem,
  fetchOpsItems,
  fetchOpsStats,
  fetchOpsVocab,
  patchOpsItem,
  type OpsItem,
  type OpsItemCreateInput,
  type OpsItemListResponse,
  type OpsItemPatchInput,
  type OpsModuleKey,
  type OpsStats,
  type OpsVocab,
} from '../ops-modules-api'

const { Text, Paragraph } = Typography

interface Props {
  module: OpsModuleKey
}

const ALL = '__all__'

function parseClipIds(input: string): string[] {
  return input
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean)
}

export function OpsModuleListPage({ module }: Props) {
  const meta = MODULE_META[module]
  const [searchParams] = useSearchParams()
  const fromRequirement = searchParams.get('requirement') ?? ''
  const fromScenario = searchParams.get('scenario') ?? ''
  const fromDataset = searchParams.get('dataset') ?? ''
  const fromQ = searchParams.get('q') ?? ''
  const [statusFilter, setStatusFilter] = useState<string>(ALL)
  const [kindFilter, setKindFilter] = useState<string>(ALL)
  const [search, setSearch] = useState(fromQ)
  const [createOpen, setCreateOpen] = useState(false)
  const [drawerId, setDrawerId] = useState<string | null>(null)
  const [createForm] = Form.useForm<OpsItemCreateInput & { clip_ids_raw?: string }>()
  const [editForm] = Form.useForm<OpsItemPatchInput & { clip_ids_raw?: string }>()

  // ── Data ──────────────────────────────────────────────────────────────

  const listFetcher = useCallback(
    () =>
      fetchOpsItems(module, {
        status: statusFilter === ALL ? undefined : statusFilter,
        kind: kindFilter === ALL ? undefined : kindFilter,
        requirementId: module === 'mining' ? fromRequirement || undefined : undefined,
        scenario: module === 'mining' ? fromScenario || undefined : undefined,
        datasetId: module === 'mining' ? fromDataset || undefined : undefined,
        q: search || undefined,
      }),
    [module, statusFilter, kindFilter, fromRequirement, fromScenario, fromDataset, search],
  )
  const listQuery = useQuery<OpsItemListResponse>(listFetcher, {
    cacheKey: `ops-${module}-${statusFilter}-${kindFilter}-${search}`,
    isEmpty: (d) => (d.items ?? []).length === 0,
  })

  const vocabFetcher = useCallback(() => fetchOpsVocab(module), [module])
  const vocabQuery = useQuery<OpsVocab>(vocabFetcher, { cacheKey: `ops-${module}-vocab` })
  const vocab = vocabQuery.data

  const statsFetcher = useCallback(() => fetchOpsStats(module), [module])
  const statsQuery = useQuery<OpsStats>(statsFetcher, { cacheKey: `ops-${module}-stats` })
  const stats = statsQuery.data

  const items = listQuery.data?.items ?? []
  const total = listQuery.data?.pagination?.total ?? items.length
  const drawerItem: OpsItem | null = useMemo(
    () => items.find((item) => item.id === drawerId) ?? null,
    [items, drawerId],
  )

  // ── Handlers ──────────────────────────────────────────────────────────

  const refreshAll = useCallback(async () => {
    await Promise.all([listQuery.refetch(), statsQuery.refetch()])
  }, [listQuery, statsQuery])

  const [busy, setBusy] = useState(false)

  const handleCreate = useCallback(
    async (values: OpsItemCreateInput & { clip_ids_raw?: string }) => {
      setBusy(true)
      try {
        const { clip_ids_raw, ...rest } = values
        const payload: OpsItemCreateInput = {
          ...rest,
          clip_ids: clip_ids_raw ? parseClipIds(clip_ids_raw) : undefined,
        }
        await createOpsItem(module, payload)
        message.success(`Created ${meta.label.toLowerCase()} item`)
        setCreateOpen(false)
        createForm.resetFields()
        await refreshAll()
      } catch (err) {
        message.error((err as Error).message)
      } finally {
        setBusy(false)
      }
    },
    [module, meta, createForm, refreshAll],
  )

  const handlePatch = useCallback(
    async (id: string, values: OpsItemPatchInput & { clip_ids_raw?: string }) => {
      setBusy(true)
      try {
        const { clip_ids_raw, ...rest } = values
        const payload: OpsItemPatchInput = {
          ...rest,
          clip_ids: clip_ids_raw !== undefined ? parseClipIds(clip_ids_raw) : undefined,
        }
        await patchOpsItem(module, id, payload)
        message.success('Updated')
        setDrawerId(null)
        editForm.resetFields()
        await refreshAll()
      } catch (err) {
        message.error((err as Error).message)
      } finally {
        setBusy(false)
      }
    },
    [module, editForm, refreshAll],
  )

  const handleQuickStatus = useCallback(
    async (id: string, status: string) => {
      setBusy(true)
      try {
        await patchOpsItem(module, id, { status })
        message.success(`Status → ${status}`)
        await refreshAll()
      } catch (err) {
        message.error((err as Error).message)
      } finally {
        setBusy(false)
      }
    },
    [module, refreshAll],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      setBusy(true)
      try {
        await deleteOpsItem(module, id)
        message.success('Deleted')
        setDrawerId(null)
        await refreshAll()
      } catch (err) {
        message.error((err as Error).message)
      } finally {
        setBusy(false)
      }
    },
    [module, refreshAll],
  )

  // ── Render ────────────────────────────────────────────────────────────

  if (listQuery.state === 'loading')
    return <PageLoading message={`Loading ${meta.label.toLowerCase()}...`} />
  if (listQuery.state === 'error')
    return <PageError message={listQuery.error?.message} onRetry={listQuery.refetch} />

  const counts = stats?.counts ?? {}

  return (
    <PageContainer
      title={meta.label}
      description={meta.description}
      actions={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={refreshAll}>Refresh</Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              createForm.setFieldsValue({
                requirement_id: fromRequirement || undefined,
                scenario: fromScenario || undefined,
                dataset_id: fromDataset || undefined,
                title: fromQ ? `Mining candidate set · ${fromQ}` : undefined,
              })
              setCreateOpen(true)
            }}
          >
            New {meta.label}
          </Button>
        </Space>
      }
    >
      {module === 'mining' && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space direction="vertical" size={6}>
            <Text>
              <strong>Mining != Explorer:</strong> Explorer is for interactive discovery and verification;
              Mining is an operational queue that creates reusable corner-case candidate sets for review,
              tagging, checking, and release.
            </Text>
            <Text type="secondary">
              Explorer answers "what clips exist now". Mining answers "what candidate set should be
              produced and tracked next".
            </Text>
            <Space wrap>
              <Link to="/explorer/search">Go to Explorer Search</Link>
              <Link to="/requirements">Go to Requirements</Link>
              {fromRequirement && <Tag>requirement: {fromRequirement}</Tag>}
              {fromScenario && <Tag>scenario: {fromScenario}</Tag>}
              {fromDataset && <Tag>dataset: {fromDataset}</Tag>}
            </Space>
          </Space>
        </Card>
      )}

      {/* Stats row */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap size={24}>
          <Statistic title="Total" value={counts.total ?? total} />
          {(vocab?.status_options ?? []).slice(0, 5).map((s) => (
            <Statistic
              key={s}
              title={s.replace(/_/g, ' ')}
              value={counts[s] ?? 0}
              valueStyle={{ fontSize: 20 }}
            />
          ))}
        </Space>
      </Card>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap size={12}>
          <Select
            value={statusFilter}
            onChange={(v) => setStatusFilter(String(v))}
            style={{ minWidth: 180 }}
            options={[
              { label: 'All status', value: ALL },
              ...(vocab?.status_options ?? []).map((s) => ({
                label: `${s} (${counts[s] ?? 0})`,
                value: s,
              })),
            ]}
          />
          <Select
            value={kindFilter}
            onChange={(v) => setKindFilter(String(v))}
            style={{ minWidth: 180 }}
            options={[
              { label: 'All kinds', value: ALL },
              ...(vocab?.kind_options ?? []).map((k) => ({ label: k, value: k })),
            ]}
          />
          <Input.Search
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search id/title/owner/scenario/dataset/clip"
            style={{ minWidth: 320 }}
            allowClear
          />
          {module === 'mining' && fromRequirement && <Tag color="blue">Scoped requirement: {fromRequirement}</Tag>}
        </Space>
      </Card>

      {/* Items */}
      <Card>
        {items.length === 0 ? (
          <Empty description={`No ${meta.label.toLowerCase()} items yet.`}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                createForm.setFieldsValue({
                  requirement_id: fromRequirement || undefined,
                  scenario: fromScenario || undefined,
                  dataset_id: fromDataset || undefined,
                  title: fromQ ? `Mining candidate set · ${fromQ}` : undefined,
                })
                setCreateOpen(true)
              }}
            >
              Create first {meta.label.toLowerCase()} item
            </Button>
          </Empty>
        ) : (
          <DataTable<OpsItem>
            columns={[
              { key: 'id', header: 'ID' },
              { key: 'title', header: 'Title' },
              {
                key: 'kind',
                header: 'Kind',
                render: (row) => (row.kind ? <Tag>{row.kind}</Tag> : <Text type="secondary">—</Text>),
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => (
                  <Select
                    size="small"
                    value={row.status}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(v) => handleQuickStatus(row.id, v)}
                    style={{ minWidth: 140 }}
                    options={(vocab?.status_options ?? [row.status]).map((s) => ({
                      label: s.replace(/_/g, ' '),
                      value: s,
                    }))}
                  />
                ),
              },
              {
                key: 'scope',
                header: 'Scope',
                render: (row) => {
                  const parts: string[] = []
                  if (row.scenario) parts.push(`scenario:${row.scenario}`)
                  if (row.dataset_id) parts.push(`dataset:${row.dataset_id}`)
                  if (row.requirement_id) parts.push(`req:${row.requirement_id}`)
                  if (row.clip_ids.length) parts.push(`${row.clip_ids.length} clips`)
                  return parts.length ? parts.join(' · ') : <Text type="secondary">—</Text>
                },
              },
              { key: 'owner', header: 'Owner', render: (row) => row.owner ?? '—' },
              {
                key: 'updated_at',
                header: 'Updated',
                render: (row) => new Date(row.updated_at).toLocaleString(),
              },
              {
                key: 'actions',
                header: '',
                render: (row) => (
                  <Space
                    onClick={(e) => e.stopPropagation()}
                    size={4}
                  >
                    <Button
                      size="small"
                      type="link"
                      icon={<EditOutlined />}
                      onClick={() => {
                        setDrawerId(row.id)
                        editForm.setFieldsValue({
                          title: row.title,
                          status: row.status,
                          kind: row.kind ?? undefined,
                          owner: row.owner ?? undefined,
                          scenario: row.scenario ?? undefined,
                          dataset_id: row.dataset_id ?? undefined,
                          requirement_id: row.requirement_id ?? undefined,
                          clip_ids_raw: (row.clip_ids ?? []).join(', '),
                        })
                      }}
                    >
                      Edit
                    </Button>
                    <Popconfirm
                      title="Delete this item?"
                      onConfirm={() => handleDelete(row.id)}
                      okButtonProps={{ danger: true }}
                    >
                      <Button size="small" type="link" danger icon={<DeleteOutlined />}>
                        Delete
                      </Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
            data={items}
            rowKey={(row) => row.id}
          />
        )}
      </Card>

      {/* Create modal */}
      <Modal
        title={`New ${meta.label}`}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={busy}
        destroyOnClose
      >
        <Form<OpsItemCreateInput & { clip_ids_raw?: string }>
          form={createForm}
          layout="vertical"
          onFinish={(values) => handleCreate(values)}
        >
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Title is required' }]}
          >
            <Input placeholder={`e.g. ${meta.label} batch for xminer-pipeline-video`} />
          </Form.Item>
          <Space size={12} style={{ width: '100%', display: 'flex' }}>
            <Form.Item name="kind" label="Kind" style={{ flex: 1 }}>
              <Select
                allowClear
                options={(vocab?.kind_options ?? []).map((k) => ({ label: k, value: k }))}
              />
            </Form.Item>
            <Form.Item name="status" label="Status" style={{ flex: 1 }}>
              <Select
                allowClear
                options={(vocab?.status_options ?? []).map((s) => ({ label: s, value: s }))}
              />
            </Form.Item>
          </Space>
          <Form.Item name="owner" label="Owner">
            <Input placeholder="username or team" />
          </Form.Item>
          <Space size={12} style={{ width: '100%', display: 'flex' }}>
            <Form.Item name="scenario" label="Scenario" style={{ flex: 1 }}>
              <Input placeholder="e.g. xminer-pipeline-video" />
            </Form.Item>
            <Form.Item name="dataset_id" label="Dataset" style={{ flex: 1 }}>
              <Input placeholder="e.g. scenario:xminer-pipeline-video" />
            </Form.Item>
          </Space>
          <Form.Item name="requirement_id" label="Requirement">
            <Input placeholder="linked requirement id" />
          </Form.Item>
          <Form.Item name="clip_ids_raw" label="Clip IDs" help="Comma or whitespace separated">
            <Input.TextArea rows={3} placeholder="c-abc..., c-def..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail / edit drawer */}
      <Drawer
        title={drawerItem ? `Edit · ${drawerItem.title}` : 'Loading...'}
        width={540}
        open={drawerId !== null}
        onClose={() => setDrawerId(null)}
        destroyOnClose
        extra={
          drawerItem && (
            <Popconfirm
              title="Delete this item?"
              onConfirm={() => handleDelete(drawerItem.id)}
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<DeleteOutlined />}>
                Delete
              </Button>
            </Popconfirm>
          )
        }
        footer={
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => setDrawerId(null)}>Cancel</Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={busy}
              onClick={() => editForm.submit()}
            >
              Save
            </Button>
          </Space>
        }
      >
        {drawerItem && (
          <>
            <Descriptions size="small" column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="ID">
                <Text code>{drawerItem.id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Module">{drawerItem.module}</Descriptions.Item>
              <Descriptions.Item label="Current status">
                <StatusBadge status={drawerItem.status} />
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {new Date(drawerItem.created_at).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="Updated">
                {new Date(drawerItem.updated_at).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>
            <Form<OpsItemPatchInput & { clip_ids_raw?: string }>
              form={editForm}
              layout="vertical"
              onFinish={(values) => handlePatch(drawerItem.id, values)}
            >
              <Form.Item name="title" label="Title">
                <Input />
              </Form.Item>
              <Space size={12} style={{ width: '100%', display: 'flex' }}>
                <Form.Item name="status" label="Status" style={{ flex: 1 }}>
                  <Select
                    options={(vocab?.status_options ?? []).map((s) => ({ label: s, value: s }))}
                  />
                </Form.Item>
                <Form.Item name="kind" label="Kind" style={{ flex: 1 }}>
                  <Select
                    allowClear
                    options={(vocab?.kind_options ?? []).map((k) => ({ label: k, value: k }))}
                  />
                </Form.Item>
              </Space>
              <Form.Item name="owner" label="Owner">
                <Input />
              </Form.Item>
              <Form.Item name="scenario" label="Scenario">
                <Input />
              </Form.Item>
              <Form.Item name="dataset_id" label="Dataset">
                <Input />
              </Form.Item>
              <Form.Item name="requirement_id" label="Requirement">
                <Input />
              </Form.Item>
              <Form.Item name="clip_ids_raw" label="Clip IDs" help="Comma or whitespace separated">
                <Input.TextArea rows={3} />
              </Form.Item>
            </Form>
            <Card size="small" title="Payload" style={{ marginTop: 12 }}>
              <Paragraph
                code
                style={{ margin: 0, maxHeight: 180, overflow: 'auto', fontSize: 12 }}
              >
                {JSON.stringify(drawerItem.payload ?? {}, null, 2)}
              </Paragraph>
            </Card>
          </>
        )}
      </Drawer>
    </PageContainer>
  )
}
