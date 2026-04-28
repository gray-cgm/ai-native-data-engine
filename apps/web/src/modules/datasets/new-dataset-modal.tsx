import { useState } from 'react'
import { Form, Input, InputNumber, Modal, Radio, Switch, Typography, message } from 'antd'

import { createDataset, type DatasetV2 } from './datasets-api'

const { Text } = Typography

type Props = {
  open: boolean
  onClose: () => void
  /** 创建成功后回调（可用来刷新列表 / 把新 dataset 选入表单等）。 */
  onCreated?: (dataset: DatasetV2) => void
  /** 默认 dataset_type；OpsItem release 场景预填 customized，避免误选 official 后被 API 拒。 */
  defaultDatasetType?: 'customized' | 'official'
  /** 默认 requirement_id；从 OpsItem 行带过来。 */
  defaultRequirementId?: string
}

export function NewDatasetModal({
  open,
  onClose,
  onCreated,
  defaultDatasetType = 'customized',
  defaultRequirementId,
}: Props) {
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    let values: {
      name: string
      dataset_type: 'customized' | 'official'
      source_type: 'tags' | 'csv' | 'other'
      requirement_id?: string
      tag_expr?: string
      allow_train?: boolean
      default_range_l?: number
      default_range_r?: number
    }
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    setSubmitting(true)
    try {
      const created = await createDataset(values)
      message.success(`Created ${created.dataset_type} dataset: ${created.name}`)
      onCreated?.(created)
      form.resetFields()
      onClose()
    } catch (err) {
      message.error(`Create failed: ${(err as Error).message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      title="New dataset"
      onOk={handleSubmit}
      onCancel={() => {
        form.resetFields()
        onClose()
      }}
      okText="Create"
      confirmLoading={submitting}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          dataset_type: defaultDatasetType,
          source_type: 'other',
          allow_train: false,
          default_range_l: -1,
          default_range_r: 3,
          requirement_id: defaultRequirementId,
        }}
      >
        <Form.Item
          name="name"
          label="Name"
          rules={[{ required: true, message: 'name is required' }]}
        >
          <Input placeholder="ds_my_clip_cuts_v1" />
        </Form.Item>
        <Form.Item name="dataset_type" label="Type">
          <Radio.Group
            options={[
              { label: 'Customized', value: 'customized' },
              { label: 'Official', value: 'official' },
            ]}
            optionType="button"
          />
        </Form.Item>
        <Form.Item name="source_type" label="Source">
          <Radio.Group
            options={[
              { label: 'tags', value: 'tags' },
              { label: 'csv', value: 'csv' },
              { label: 'other', value: 'other' },
            ]}
            optionType="button"
          />
        </Form.Item>
        <Form.Item
          name="tag_expr"
          label="Tag expr"
          help={<Text type="secondary" style={{ fontSize: 12 }}>official 必填，e.g. <Text code>migration_v1 AND cutin</Text></Text>}
        >
          <Input placeholder="optional for customized" />
        </Form.Item>
        <Form.Item name="requirement_id" label="Requirement ID (optional)">
          <Input placeholder="DMD-..." />
        </Form.Item>
        <Form.Item label="Default range (frames)">
          <Form.Item name="default_range_l" noStyle>
            <InputNumber />
          </Form.Item>
          <Text type="secondary" style={{ margin: '0 8px' }}>to</Text>
          <Form.Item name="default_range_r" noStyle>
            <InputNumber />
          </Form.Item>
        </Form.Item>
        <Form.Item name="allow_train" label="Trainable" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  )
}
