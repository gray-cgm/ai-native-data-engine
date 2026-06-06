import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

import { DataTable } from './data-table'

type Row = Record<string, unknown> & { id: string; name: string }

const rows: Row[] = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' },
]

function renderTable(props: Partial<React.ComponentProps<typeof DataTable<Row>>> = {}) {
  return render(
    <MemoryRouter>
      <DataTable<Row>
        columns={[
          { key: 'id', header: 'ID' },
          { key: 'name', header: 'Name', render: (r) => r.name },
        ]}
        data={rows}
        rowKey={(r) => r.id}
        {...props}
      />
    </MemoryRouter>,
  )
}

describe('DataTable', () => {
  it('renders rows and headers', () => {
    renderTable()
    expect(screen.getAllByText('ID').length).toBeGreaterThan(0)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('shows empty text when no data', () => {
    renderTable({ data: [], emptyText: 'Empty here' })
    expect(screen.getByText('Empty here')).toBeInTheDocument()
  })

  it('calls onRowClick when a row is clicked', () => {
    const onRowClick = vi.fn()
    renderTable({ onRowClick })
    fireEvent.click(screen.getByText('Alpha'))
    expect(onRowClick).toHaveBeenCalledWith(rows[0])
  })

  it('navigates via rowHref on click', () => {
    navigate.mockClear()
    renderTable({ rowHref: (r) => `/detail/${r.id}` })
    fireEvent.click(screen.getByText('Beta'))
    expect(navigate).toHaveBeenCalledWith('/detail/b')
  })

  it('opens new tab on meta-click with rowHref', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderTable({ rowHref: (r) => `/d/${r.id}` })
    fireEvent.click(screen.getByText('Alpha'), { metaKey: true })
    expect(openSpy).toHaveBeenCalledWith('/d/a', '_blank', 'noopener,noreferrer')
    openSpy.mockRestore()
  })

  it('triggers row action on Enter key', () => {
    const onRowClick = vi.fn()
    renderTable({ onRowClick })
    const cell = screen.getByText('Alpha')
    const row = cell.closest('tr')!
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(onRowClick).toHaveBeenCalled()
  })
})
