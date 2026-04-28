import { useEffect, useMemo, useState } from 'react'
import { Alert, Form, Input, InputNumber, Modal, Radio, Select, Space, Typography, message } from 'antd'

import {
  createDataset,
  flexibleCut,
  listDatasets,
  type DatasetV2,
} from '@/modules/datasets/datasets-api'

const { Text } = Typography

type Props = {
  open: boolean
  clipId: string
  /** Selected window in nanoseconds (Lance meta-aligned). */
  windowNs: { startNs: number; endNs: number }
  onClose: () => void
  onSaved?: (datasetId: string) => void
}

/**
 * 保存切片弹窗：选定 dataset（或新建一个 customized dataset），调用
 * /api/datasets/:id/cut。时间戳完全采用 Lance metadata 的 ns 单位，避免在视频
 * 秒数与时间戳之间二次推算带来的误差。
 */
export function SaveCutModal({
  open,
  clipId,
  windowNs,
  onClose,
  onSaved,
}: Props) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [datasets, setDatasets] = useState<DatasetV2[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [name, setName] = useState('')
  const [requirementId, setRequirementId] = useState('')
  const [rangeL, setRangeL] = useState<number>(-1)
  const [rangeR, setRangeR] = useState<number>(3)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoadingList(true)
    listDatasets({ status: 'active', dataset_type: 'customized', limit: 100 })
      .then((resp) => {
        setDatasets(resp.items)
        if (!selectedId && resp.items.length > 0) {
          setSelectedId(resp.items[0].id)
        }
      })
      .catch((err) => {
        message.error(`Failed to load datasets: ${err.message ?? err}`)
      })
      .finally(() => setLoadingList(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const tsCenter = useMemo(
    () => Math.round((windowNs.startNs + windowNs.endNs) / 2),
    [windowNs.startNs, windowNs.endNs],
  )
  const durationMs = (windowNs.endNs - windowNs.startNs) / 1e6

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      let datasetId = selectedId
      if (mode === 'new') {
        if (!name.trim()) {
          message.warning('Please input a dataset name')
          return
        }
        const created = await createDataset({
          name: name.trim(),
          dataset_type: 'customized',
          source_type: 'other',
          requirement_id: requirementId.trim() || undefined,
          allow_train: false,
        })
        datasetId = created.id
      }
      if (!datasetId) {
        message.warning('Pick or create a dataset first')
        return
      }
      const result = await flexibleCut(datasetId, {
        clip_id: clipId,
        ts_start: windowNs.startNs,
        ts_end: windowNs.endNs,
        ts_center: tsCenter,
        range_l: rangeL,
        range_r: rangeR,
        note: note.trim() || undefined,
        requirement_id: requirementId.trim() || undefined,
      })
      if (result.deduplicated) {
        message.info('Sample already exists; treated as idempotent.')
      } else {
        message.success(`Saved cut to ${datasetId}`)
      }
      onSaved?.(datasetId)
      onClose()
    } catch (err) {
      const e = err as Error
      message.error(`Save failed: ${e.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="Save flexible cut"
      open={open}
      onOk={handleSubmit}
      onCancel={onClose}
      okText="Save"
      confirmLoading={submitting}
      destroyOnClose
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Alert
          type="info"
          showIcon
          message={
            <Space size={6} wrap>
              <Text>Clip:</Text>
              <Text code>{clipId}</Text>
              <Text>Window (Lance ns):</Text>
              <Text code>{windowNs.startNs}</Text>
              <Text>→</Text>
              <Text code>{windowNs.endNs}</Text>
              <Text type="secondary">({durationMs.toFixed(0)} ms)</Text>
            </Space>
          }
        />
        <Radio.Group
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          options={[
            { label: 'Append to existing dataset', value: 'existing' },
            { label: 'Create new customized dataset', value: 'new' },
          ]}
          optionType="button"
        />
        <Form layout="vertical">
          {mode === 'existing' ? (
            <Form.Item label="Customized dataset" required>
              <Select
                showSearch
                value={selectedId}
                onChange={setSelectedId}
                loading={loadingList}
                placeholder="Choose a customized dataset"
                options={datasets.map((d) => ({ value: d.id, label: `${d.name} · v${d.dataset_version}` }))}
                filterOption={(input, opt) =>
                  String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
          ) : (
            <Form.Item label="New dataset name" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ds_my_clip_cuts_v1"
              />
            </Form.Item>
          )}
          <Form.Item label="Requirement ID (optional)">
            <Input
              value={requirementId}
              onChange={(e) => setRequirementId(e.target.value)}
              placeholder="DMD-..."
            />
          </Form.Item>
          <Form.Item label="Range (frames)">
            <Space>
              <InputNumber value={rangeL} onChange={(v) => setRangeL(Number(v ?? -1))} />
              <Text type="secondary">to</Text>
              <InputNumber value={rangeR} onChange={(v) => setRangeR(Number(v ?? 3))} />
            </Space>
          </Form.Item>
          <Form.Item label="Note (optional)">
            <Input.TextArea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why this cut matters"
            />
          </Form.Item>
        </Form>
      </Space>
    </Modal>
  )
}
