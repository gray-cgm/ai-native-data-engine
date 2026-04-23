import { useMemo } from 'react'
import { Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { ReactNode } from 'react'
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
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  emptyText = 'No data',
}: DataTableProps<T>) {
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

  return (
    <Table<T>
      className="app-data-table"
      columns={antdColumns}
      dataSource={data}
      rowKey={rowKey}
      pagination={false}
      size="middle"
      tableLayout="fixed"
      scroll={{ x: 'max-content' }}
      locale={{ emptyText }}
    />
  )
}
