import { useCallback, useMemo } from 'react'
import { Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { TableCellText } from './table-cell-text'

interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  width?: number | string
  ellipsis?: boolean
  lines?: 1 | 2
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowKey: (row: T) => string
  emptyText?: string
  /** Click handler — gets the row clicked. */
  onRowClick?: (row: T) => void
  /**
   * Pure-navigation form: if provided, the row navigates to this href
   * (preserves middle-click "open in new tab" + cmd/ctrl-click semantics).
   * If both this and onRowClick are set, onRowClick wins.
   */
  rowHref?: (row: T) => string
  /** Highlight a row as currently selected (e.g. drawer is open for it). */
  isRowSelected?: (row: T) => boolean
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  emptyText = 'No data',
  onRowClick,
  rowHref,
  isRowSelected,
}: DataTableProps<T>) {
  const navigate = useNavigate()
  const isClickable = !!onRowClick || !!rowHref

  const antdColumns: ColumnsType<T> = useMemo(
    () =>
      columns.map((col) => ({
        key: col.key,
        title: col.header,
        dataIndex: col.key,
        width: col.width,
        ellipsis: col.ellipsis === false ? false : { showTitle: false },
        render: col.render
          ? (_: unknown, record: T) => {
            const rendered = col.render!(record)
            if (typeof rendered === 'string' || typeof rendered === 'number' || typeof rendered === 'boolean') {
              return <TableCellText value={rendered} lines={col.lines ?? 1} />
            }
            return rendered
          }
          : (value: unknown) => <TableCellText value={value} lines={col.lines ?? 1} />,
      })),
    [columns],
  )

  const rowClassName = useCallback(
    (record: T) => {
      const classes: string[] = []
      if (isClickable) classes.push('clickable-row')
      if (isRowSelected?.(record)) classes.push('clickable-row--selected')
      return classes.join(' ')
    },
    [isClickable, isRowSelected],
  )

  const onRow = useMemo(() => {
    if (!isClickable) return undefined
    return (record: T) => ({
      onClick: (event: React.MouseEvent) => {
        // Don't intercept clicks on inline links / buttons inside the row.
        const target = event.target as HTMLElement
        if (target.closest('a, button, .ant-tag-checkable, [data-stop-row-click]')) return
        if (onRowClick) {
          onRowClick(record)
          return
        }
        if (rowHref) {
          const href = rowHref(record)
          if (event.metaKey || event.ctrlKey || event.button === 1) {
            window.open(href, '_blank', 'noopener,noreferrer')
          } else {
            navigate(href)
          }
        }
      },
      onAuxClick: (event: React.MouseEvent) => {
        // Middle-click → new tab when rowHref provided
        if (event.button !== 1 || !rowHref) return
        const target = event.target as HTMLElement
        if (target.closest('a, button')) return
        window.open(rowHref(record), '_blank', 'noopener,noreferrer')
      },
      tabIndex: 0,
      onKeyDown: (event: React.KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        const target = event.target as HTMLElement
        if (target.closest('a, button, input, textarea, select')) return
        event.preventDefault()
        if (onRowClick) onRowClick(record)
        else if (rowHref) navigate(rowHref(record))
      },
    })
  }, [isClickable, navigate, onRowClick, rowHref])

  return (
    <Table<T>
      className="app-data-table"
      columns={antdColumns}
      dataSource={data}
      rowKey={rowKey}
      pagination={false}
      size="small"
      tableLayout="fixed"
      scroll={{ x: 'max-content' }}
      locale={{ emptyText }}
      rowClassName={isClickable || isRowSelected ? rowClassName : undefined}
      onRow={onRow}
    />
  )
}
