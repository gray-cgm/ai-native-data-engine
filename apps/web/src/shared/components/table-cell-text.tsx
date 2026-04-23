import { Tooltip, Typography } from 'antd'

const { Text } = Typography

interface TableCellTextProps {
  value: unknown
  lines?: 1 | 2
  code?: boolean
  placeholder?: string
  maxWidth?: number | string
}

function normalizeValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

export function TableCellText({
  value,
  lines = 1,
  code = false,
  placeholder = '—',
  maxWidth,
}: TableCellTextProps) {
  const text = normalizeValue(value)

  if (!text) {
    return <Text type="secondary">{placeholder}</Text>
  }

  const className = [
    'table-cell-text',
    lines === 2 ? 'table-cell-text--2' : '',
    code ? 'table-cell-text--code' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const style = maxWidth != null
    ? { maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth }
    : undefined

  return (
    <Tooltip title={text} placement="topLeft">
      <span className={className} style={style}>
        {text}
      </span>
    </Tooltip>
  )
}