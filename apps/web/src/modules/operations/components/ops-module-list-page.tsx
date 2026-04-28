import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { DatasetPicker } from '@/modules/datasets/dataset-picker'

const { Text, Paragraph } = Typography

interface Props {
  module: OpsModuleKey
  /** 额外的行级动作按钮（例：Release 模块的 Promote-to-Official）。
   *  返回的 React 节点会插在 Edit / Delete 之前。 */
  extraRowActions?: (row: OpsItem, refresh: () => Promise<void>) => React.ReactNode
}

const ALL = '__all__'

function parseClipIds(input: string): string[] {
  return input
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean)
}

export function OpsModuleListPage({ module, extraRowActions }: Props) {
  const meta = MODULE_META[module]
  const [searchParams, setSearchParams] = useSearchParams()
  const fromRequirement = searchParams.get('requirement') ?? ''
  const fromDataTask = searchParams.get('dataTask') ?? searchParams.get('data_task') ?? ''
  const fromTrace = searchParams.get('trace') ?? searchParams.get('x_trace_id') ?? ''
  const fromScenario = searchParams.get('scenario') ?? ''
  const fromDataset = searchParams.get('dataset') ?? ''
  const fromQ = searchParams.get('q') ?? ''
  const [statusFilter, setStatusFilter] = useState<string>(ALL)
  const [kindFilter, setKindFilter] = useState<string>(ALL)
  const [search, setSearch] = useState(fromQ)

  // 链路筛选项的"草稿"——用户在输入框里改完按 Apply 才同步到 URL，
  // 这样既支持外部链接传入预填，也避免每个键盘事件都重 fetch。
  const [requirementDraft, setRequirementDraft] = useState(fromRequirement)
  const [dataTaskDraft, setDataTaskDraft] = useState(fromDataTask)
  const [traceDraft, setTraceDraft] = useState(fromTrace)
  const [scenarioDraft, setScenarioDraft] = useState(fromScenario)
  // URL 变化时同步到草稿（外部链接进来 / 浏览器后退）
  useEffect(() => { setRequirementDraft(fromRequirement) }, [fromRequirement])
  useEffect(() => { setDataTaskDraft(fromDataTask) }, [fromDataTask])
  useEffect(() => { setTraceDraft(fromTrace) }, [fromTrace])
  useEffect(() => { setScenarioDraft(fromScenario) }, [fromScenario])

  const updateParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current)
        for (const [k, v] of Object.entries(patch)) {
          if (v && v.length > 0) next.set(k, v)
          else next.delete(k)
        }
        return next
      }, { replace: false })
    },
    [setSearchParams],
  )

  const applyLinkageFilters = useCallback(() => {
    updateParams({
      requirement: requirementDraft.trim() || undefined,
      dataTask: dataTaskDraft.trim() || undefined,
      trace: traceDraft.trim() || undefined,
      scenario: scenarioDraft.trim() || undefined,
      // 清掉 legacy alias，避免叠加
      data_task: undefined,
      x_trace_id: undefined,
    })
  }, [updateParams, requirementDraft, dataTaskDraft, traceDraft, scenarioDraft])

  const clearLinkageFilters = useCallback(() => {
    setRequirementDraft(''); setDataTaskDraft(''); setTraceDraft(''); setScenarioDraft('')
    updateParams({
      requirement: undefined, dataTask: undefined, data_task: undefined,
      trace: undefined, x_trace_id: undefined, scenario: undefined,
    })
  }, [updateParams])

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
        requirementId: fromRequirement || undefined,
        dataTaskId: fromDataTask || undefined,
        xTraceId: fromTrace || undefined,
        scenario: fromScenario || undefined,
        datasetId: fromDataset || undefined,
        q: search || undefined,
      }),
    [module, statusFilter, kindFilter, fromRequirement, fromDataTask, fromTrace, fromScenario, fromDataset, search],
  )
  const listQuery = useQuery<OpsItemListResponse>(listFetcher, {
    cacheKey: `ops-${module}-${statusFilter}-${kindFilter}-${search}-${fromRequirement}-${fromDataTask}-${fromTrace}-${fromScenario}-${fromDataset}`,
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
                data_task_id: fromDataTask || undefined,
                x_trace_id: fromTrace || undefined,
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
              {fromDataTask && <Tag>dataTask: {fromDataTask}</Tag>}
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

      {/* Linkage filters — Requirement / DataTask / x_trace_id / Scenario.
          这些都是项目经理 / 算法负责人最常用的过滤维度，单独拎到一行，
          让用户不用去 URL 里手工拼参数。改完按 Apply 才会真正 fetch。*/}
      <Card
        size="small"
        title={<Text strong>关联筛选 · Linkage</Text>}
        style={{ marginBottom: 12 }}
        extra={
          <Space size={4}>
            <Button size="small" type="primary" onClick={applyLinkageFilters}>
              Apply
            </Button>
            <Button size="small" onClick={clearLinkageFilters}>Clear</Button>
          </Space>
        }
      >
        <Space wrap size={12} style={{ width: '100%' }}>
          <Input
            value={requirementDraft}
            onChange={(e) => setRequirementDraft(e.target.value)}
            onPressEnter={applyLinkageFilters}
            placeholder="Requirement ID"
            style={{ minWidth: 280 }}
            allowClear
            prefix={<Text type="secondary" style={{ fontSize: 12 }}>req</Text>}
          />
          <Input
            value={dataTaskDraft}
            onChange={(e) => setDataTaskDraft(e.target.value)}
            onPressEnter={applyLinkageFilters}
            placeholder="Data Task ID"
            style={{ minWidth: 280 }}
            allowClear
            prefix={<Text type="secondary" style={{ fontSize: 12 }}>dt</Text>}
          />
          <Input
            value={traceDraft}
            onChange={(e) => setTraceDraft(e.target.value)}
            onPressEnter={applyLinkageFilters}
            placeholder="x_trace_id"
            style={{ minWidth: 220 }}
            allowClear
            prefix={<Text type="secondary" style={{ fontSize: 12 }}>trace</Text>}
          />
          <Input
            value={scenarioDraft}
            onChange={(e) => setScenarioDraft(e.target.value)}
            onPressEnter={applyLinkageFilters}
            placeholder="Scenario"
            style={{ minWidth: 180 }}
            allowClear
            prefix={<Text type="secondary" style={{ fontSize: 12 }}>scn</Text>}
          />
        </Space>
        {(fromRequirement || fromDataTask || fromTrace || fromScenario) && (
          <Space wrap size={6} style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Active:</Text>
            {fromRequirement && (
              <Tag color="blue" closable onClose={() => updateParams({ requirement: undefined })}>
                <Link to={`/requirements/${fromRequirement}`} onClick={(e) => e.stopPropagation()}>
                  req:{fromRequirement.slice(0, 8)}
                </Link>
              </Tag>
            )}
            {fromDataTask && (
              <Tag color="purple" closable onClose={() => updateParams({ dataTask: undefined, data_task: undefined })}>
                <Link to={`/data-tasks/${fromDataTask}`} onClick={(e) => e.stopPropagation()}>
                  dt:{fromDataTask.slice(0, 8)}
                </Link>
              </Tag>
            )}
            {fromTrace && (
              <Tag color="geekblue" closable onClose={() => updateParams({ trace: undefined, x_trace_id: undefined })}>
                trace:{fromTrace}
              </Tag>
            )}
            {fromScenario && (
              <Tag color="green" closable onClose={() => updateParams({ scenario: undefined })}>
                scn:{fromScenario}
              </Tag>
            )}
          </Space>
        )}
      </Card>

      {/* Status / Kind / Free-text */}
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
            placeholder="Search id/title/owner/scenario/dataset/clip/trace"
            style={{ minWidth: 320 }}
            allowClear
          />
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
                  data_task_id: fromDataTask || undefined,
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
                  // 都做成可点击 / 可一键反向过滤的标签：req → 跳详情；
                  // dataTask → 跳详情；trace / scenario → 直接套到当前 ops 列表的过滤里。
                  const stop = (e: React.MouseEvent) => e.stopPropagation()
                  const tags: React.ReactNode[] = []
                  if (row.requirement_id) {
                    tags.push(
                      <Tag color="blue" key="req" onClick={stop}>
                        <Link to={`/requirements/${row.requirement_id}`}>
                          req:{row.requirement_id.slice(0, 8)}
                        </Link>
                      </Tag>,
                    )
                  }
                  if (row.data_task_id) {
                    tags.push(
                      <Tag color="purple" key="dt" onClick={stop}>
                        <Link to={`/data-tasks/${row.data_task_id}`}>
                          dt:{row.data_task_id.slice(0, 8)}
                        </Link>
                      </Tag>,
                    )
                  }
                  if (row.x_trace_id) {
                    tags.push(
                      <Tag
                        color="geekblue"
                        key="trace"
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => {
                          stop(e)
                          updateParams({ trace: row.x_trace_id ?? undefined })
                        }}
                        title="点击仅显示同 trace 的条目"
                      >
                        trace:{(row.x_trace_id ?? '').slice(0, 12)}
                      </Tag>,
                    )
                  }
                  if (row.scenario) {
                    tags.push(
                      <Tag
                        color="green"
                        key="scn"
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => {
                          stop(e)
                          updateParams({ scenario: row.scenario ?? undefined })
                        }}
                      >
                        scn:{row.scenario}
                      </Tag>,
                    )
                  }
                  if (row.dataset_id) {
                    tags.push(
                      <Tag key="ds" onClick={stop}>ds:{row.dataset_id.slice(0, 12)}</Tag>,
                    )
                  }
                  if (row.clip_ids.length) {
                    tags.push(
                      <Tag key="clips" onClick={stop}>{row.clip_ids.length} clips</Tag>,
                    )
                  }
                  return tags.length
                    ? <Space size={4} wrap>{tags}</Space>
                    : <Text type="secondary">—</Text>
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
                    {extraRowActions ? extraRowActions(row, refreshAll) : null}
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
                          data_task_id: row.data_task_id ?? undefined,
                          x_trace_id: row.x_trace_id ?? undefined,
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
              <DatasetPicker
                filterType={module === 'release' ? 'customized' : undefined}
                placeholder="Pick a dataset or create one"
              />
            </Form.Item>
          </Space>
          <Form.Item name="requirement_id" label="Requirement">
            <Input placeholder="linked requirement id" />
          </Form.Item>
          <Form.Item name="data_task_id" label="Data Task">
            <Input placeholder="linked data task id" />
          </Form.Item>
          <Form.Item name="x_trace_id" label="x_trace_id" help="跨系统追踪键，自动从 URL ?trace= 预填">
            <Input placeholder="trace_e2e_..." />
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
                <DatasetPicker
                  filterType={module === 'release' ? 'customized' : undefined}
                  placeholder="Pick a dataset or create one"
                />
              </Form.Item>
              <Form.Item name="requirement_id" label="Requirement">
                <Input />
              </Form.Item>
              <Form.Item name="data_task_id" label="Data Task">
                <Input />
              </Form.Item>
              <Form.Item name="x_trace_id" label="x_trace_id">
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
