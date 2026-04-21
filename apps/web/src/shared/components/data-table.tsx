import { useMemo } from 'react'
import { Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { ReactNode } from 'react'

interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
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
        render: col.render
          ? (_: unknown, record: T) => col.render!(record)
          : undefined,
      })),
    [columns],
  )

  return (
    <Table<T>
      columns={antdColumns}
      dataSource={data}
      rowKey={rowKey}
      pagination={false}
      size="middle"
      locale={{ emptyText }}
    />
  )
}
