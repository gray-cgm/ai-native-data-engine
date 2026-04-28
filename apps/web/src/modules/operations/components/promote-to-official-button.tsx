import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Form, Input, Modal, Switch, Tooltip, Typography, message } from 'antd'
import { ExportOutlined } from '@ant-design/icons'

import {
  getDataset,
  promoteDataset,
  type DatasetV2,
} from '@/modules/datasets/datasets-api'
import type { OpsItem } from '../ops-modules-api'

const { Text, Paragraph } = Typography

type Props = {
  item: OpsItem
  /** 父表 refetch 钩子；提级成功后调用。 */
  refresh: () => Promise<void>
}

/**
 * Operations · Release 行级动作：把 OpsItem.dataset_id 指向的 customized 数据集
 * 提级为 official。仅在 status=approved 且 dataset_id 非空时可用。
 */
export function PromoteToOfficialButton({ item, refresh }: Props) {
  const [open, setOpen] = useState(false)
  const [src, setSrc] = useState<{ item: DatasetV2; sample_count: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [name, setName] = useState('')
  const [tagExpr, setTagExpr] = useState('')
  const [allowTrain, setAllowTrain] = useState(true)

  const datasetId = item.dataset_id
  const enabled = item.status === 'approved' && !!datasetId

  useEffect(() => {
    if (!open || !datasetId) return
    setLoading(true)
    setLoadError(null)
    setSrc(null)
    getDataset(datasetId)
      .then((resp) => {
        setSrc(resp)
        if (!name) setName(`${resp.item.name}_official`)
        if (!tagExpr) setTagExpr(resp.item.tag_expr ?? `promoted_from:${resp.item.id}`)
      })
      .catch((err) => {
        const msg = (err as Error).message
        setLoadError(msg.includes('404') || msg.includes('not found') ? 'not_found' : msg)
      })
      .finally(() => setLoading(false))
    // 仅在开/关切换时拉一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, datasetId])

  const onSubmit = async () => {
    if (!datasetId) return
    setSubmitting(true)
    try {
      const result = await promoteDataset(datasetId, {
        name: name.trim() || undefined,
        tag_expr: tagExpr.trim() || undefined,
        allow_train: allowTrain,
        ops_item_id: item.id,
        requirement_id: item.requirement_id ?? undefined,
        x_trace_id: item.x_trace_id ?? undefined,
      })
      message.success(
        `Promoted: ${result.samples_copied} samples copied (deduped ${result.samples_deduped})`,
      )
      setOpen(false)
      await refresh()
    } catch (err) {
      message.error(`Promote failed: ${(err as Error).message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const tip = !item.dataset_id
    ? 'OpsItem 缺少 dataset_id，无法 promote'
    : item.status !== 'approved'
      ? `仅 status=approved 时可 promote（当前 ${item.status}）`
      : ''

  const button = (
    <Button
      size="small"
      type="link"
      icon={<ExportOutlined />}
      disabled={!enabled}
      onClick={() => setOpen(true)}
    >
      Promote
    </Button>
  )

  return (
    <>
      {tip ? <Tooltip title={tip}>{button}</Tooltip> : button}
      <Modal
        open={open}
        title="Promote customized dataset → official"
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        confirmLoading={submitting}
        okButtonProps={{ disabled: !src }}
        destroyOnClose
      >
        {loading && <Paragraph type="secondary">Loading source dataset…</Paragraph>}
        {loadError === 'not_found' && (
          <Alert
            type="error"
            showIcon
            message={
              <span>
                Dataset <Text code>{datasetId}</Text> not found.
              </span>
            }
            description={
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                此 OpsItem 的 dataset_id 指向一个不存在的数据集。先到{' '}
                <Link to="/catalog" target="_blank" rel="noreferrer">
                  Catalog
                </Link>{' '}
                创建一个 customized 数据集（或编辑此 OpsItem 选择已有数据集），再回来 Promote。
              </Paragraph>
            }
          />
        )}
        {loadError && loadError !== 'not_found' && (
          <Alert type="error" showIcon message={`Load source dataset failed: ${loadError}`} />
        )}
        {src && (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message={
                <span>
                  Source: <Text code>{src.item.name}</Text> (v{src.item.dataset_version}) ·{' '}
                  <Text strong>{src.sample_count}</Text> samples will be copied
                </span>
              }
            />
            <Form layout="vertical">
              <Form.Item label="Official dataset name" required>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Form.Item>
              <Form.Item label="Tag expr">
                <Input
                  value={tagExpr}
                  onChange={(e) => setTagExpr(e.target.value)}
                  placeholder={`promoted_from:${src.item.id}`}
                />
              </Form.Item>
              <Form.Item label="Trainable (allow_train)">
                <Switch checked={allowTrain} onChange={setAllowTrain} />{' '}
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Official 数据集默认可训练；提级时可关闭以再走一轮 sign-off
                </Text>
              </Form.Item>
            </Form>
            <Paragraph type="secondary" style={{ fontSize: 12 }}>
              提级会写一条 LineageEvent(<Text code>release</Text>)，并把当前 OpsItem 的 status 推到{' '}
              <Text code>published</Text>。
            </Paragraph>
          </>
        )}
      </Modal>
    </>
  )
}
