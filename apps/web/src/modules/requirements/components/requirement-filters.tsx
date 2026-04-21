import { Select, Input, Space } from 'antd'
import { SearchOutlined } from '@ant-design/icons'

interface RequirementFiltersProps {
  status: string
  priority: string
  keyword: string
  onStatusChange: (value: string) => void
  onPriorityChange: (value: string) => void
  onKeywordChange: (value: string) => void
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
]

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priority' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

export function RequirementFilters({
  status,
  priority,
  keyword,
  onStatusChange,
  onPriorityChange,
  onKeywordChange,
}: RequirementFiltersProps) {
  return (
    <Space wrap style={{ marginBottom: 16 }}>
      <Select
        value={status}
        onChange={onStatusChange}
        options={STATUS_OPTIONS}
        style={{ minWidth: 150 }}
      />
      <Select
        value={priority}
        onChange={onPriorityChange}
        options={PRIORITY_OPTIONS}
        style={{ minWidth: 150 }}
      />
      <Input
        value={keyword}
        onChange={(e) => onKeywordChange(e.target.value)}
        placeholder="Search by title..."
        prefix={<SearchOutlined />}
        allowClear
        style={{ minWidth: 240 }}
      />
    </Space>
  )
}
