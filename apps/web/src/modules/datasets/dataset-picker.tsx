import { useEffect, useMemo, useState } from 'react'
import { Button, Select, Space, Tag } from 'antd'
import { PlusOutlined } from '@ant-design/icons'

import { listDatasets, type DatasetV2 } from './datasets-api'
import { NewDatasetModal } from './new-dataset-modal'

type Props = {
  /** Dataset id（datasets_v2.id）或空字符串。 */
  value?: string | null
  onChange?: (value: string | undefined) => void
  /** 限定可选类型；release 模块传 'customized'，其它模块默认两类都列。 */
  filterType?: 'customized' | 'official'
  placeholder?: string
  /** 表单同行默认拉满 */
  style?: React.CSSProperties
}

/**
 * Dataset picker：列出 datasets_v2 的 active 数据集，附带"+ New"按钮可即开即建。
 * 兼容 antd Form.Item 的受控接口（value / onChange）。
 */
export function DatasetPicker({ value, onChange, filterType, placeholder, style }: Props) {
  const [items, setItems] = useState<DatasetV2[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const refresh = () => {
    setLoading(true)
    const params: Record<string, string | number> = { status: 'active', limit: 500 }
    if (filterType) params.dataset_type = filterType
    listDatasets(params)
      .then((resp) => setItems(resp.items))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType])

  const options = useMemo(
    () =>
      items.map((d) => ({
        value: d.id,
        label: (
          <Space size={6}>
            <span>{d.name}</span>
            <Tag color={d.dataset_type === 'official' ? 'blue' : 'default'} style={{ marginRight: 0 }}>
              {d.dataset_type}
            </Tag>
            {d.allow_train && <Tag color="green" style={{ marginRight: 0 }}>train</Tag>}
          </Space>
        ),
        // 让 search 的 filterOption 能匹配到原文
        filterText: `${d.name} ${d.id} ${d.tag_expr ?? ''} ${d.dataset_type}`,
      })),
    [items],
  )

  return (
    <>
      <Space.Compact style={{ width: '100%', ...style }}>
        <Select
          showSearch
          allowClear
          loading={loading}
          value={value || undefined}
          onChange={(v) => onChange?.(v)}
          placeholder={placeholder ?? 'Select a dataset'}
          options={options}
          style={{ flex: 1 }}
          filterOption={(input, opt) =>
            String((opt as { filterText?: string })?.filterText ?? '')
              .toLowerCase()
              .includes(input.toLowerCase())
          }
        />
        <Button icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          New
        </Button>
      </Space.Compact>
      <NewDatasetModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultDatasetType={filterType ?? 'customized'}
        onCreated={(ds) => {
          setItems((prev) => [ds, ...prev])
          onChange?.(ds.id)
        }}
      />
    </>
  )
}
