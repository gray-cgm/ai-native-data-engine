import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatusBadge } from './status-badge'
import { TableCellText } from './table-cell-text'
import { EmptyState } from './empty-state'
import { PageContainer } from './page-container'
import { PageError } from './page-error'
import { PageLoading } from './page-loading'
import { StatCard } from './stat-card'
import { PageStateView } from './page-state-view'
import { IdCell } from './id-cell'
import { ErrorBoundary } from './error-boundary'

describe('StatusBadge', () => {
  it('renders known status with underscores spaced', () => {
    render(<StatusBadge status="in_progress" />)
    expect(screen.getByText('in progress')).toBeInTheDocument()
  })
  it('renders unknown status with default color', () => {
    render(<StatusBadge status="mystery" />)
    expect(screen.getByText('mystery')).toBeInTheDocument()
  })
})

describe('TableCellText', () => {
  it('renders placeholder for empty', () => {
    render(<TableCellText value={null} placeholder="N/A" />)
    expect(screen.getByText('N/A')).toBeInTheDocument()
  })
  it('stringifies numbers and objects', () => {
    const { rerender } = render(<TableCellText value={42} />)
    expect(screen.getByText('42')).toBeInTheDocument()
    rerender(<TableCellText value={{ a: 1 }} />)
    expect(screen.getByText('{"a":1}')).toBeInTheDocument()
  })
  it('applies 2-line + code classes and maxWidth style', () => {
    const { container } = render(<TableCellText value="hi" lines={2} code maxWidth={120} />)
    const span = container.querySelector('.table-cell-text')
    expect(span?.className).toContain('table-cell-text--2')
    expect(span?.className).toContain('table-cell-text--code')
  })
})

describe('EmptyState', () => {
  it('uses default and custom messages', () => {
    const { rerender } = render(<EmptyState />)
    expect(screen.getByText('No data available')).toBeInTheDocument()
    rerender(<EmptyState message="Nothing here" />)
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })
})

describe('PageContainer', () => {
  it('renders title, description, actions, children', () => {
    render(
      <PageContainer title="My Page" description="desc" actions={<button>Act</button>}>
        <div>body</div>
      </PageContainer>,
    )
    expect(screen.getByText('My Page')).toBeInTheDocument()
    expect(screen.getByText('desc')).toBeInTheDocument()
    expect(screen.getByText('Act')).toBeInTheDocument()
    expect(screen.getByText('body')).toBeInTheDocument()
  })
})

describe('PageError', () => {
  it('shows message and retry button', () => {
    const onRetry = vi.fn()
    render(<PageError message="bad" onRetry={onRetry} />)
    expect(screen.getByText('bad')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Try Again'))
    expect(onRetry).toHaveBeenCalled()
  })
  it('renders without retry', () => {
    render(<PageError />)
    expect(screen.getByText(/An error occurred/)).toBeInTheDocument()
  })
})

describe('PageLoading', () => {
  it('renders custom message', () => {
    render(<PageLoading message="please wait" />)
    expect(screen.getByText('please wait')).toBeInTheDocument()
  })
})

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Total" value={9} />)
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
  })
})

describe('PageStateView', () => {
  it('renders loading/error/empty/ready branches', () => {
    const { rerender } = render(
      <PageStateView state="loading" error={null}>
        <div>kids</div>
      </PageStateView>,
    )
    expect(screen.queryByText('kids')).not.toBeInTheDocument()

    rerender(
      <PageStateView state="error" error={new Error('e')}>
        <div>kids</div>
      </PageStateView>,
    )
    expect(screen.getByText('e')).toBeInTheDocument()

    rerender(
      <PageStateView state="empty" error={null} emptyMessage="empty!">
        <div>kids</div>
      </PageStateView>,
    )
    expect(screen.getByText('empty!')).toBeInTheDocument()

    rerender(
      <PageStateView state="ready" error={null}>
        <div>kids</div>
      </PageStateView>,
    )
    expect(screen.getByText('kids')).toBeInTheDocument()
  })
})

describe('IdCell', () => {
  it('renders placeholder when missing', () => {
    render(<IdCell value={null} placeholder="--" />)
    expect(screen.getByText('--')).toBeInTheDocument()
  })
  it('truncates in short variant', () => {
    render(<IdCell value="0123456789abcdef" head={4} />)
    expect(screen.getByText('0123…')).toBeInTheDocument()
  })
  it('shows full value in full variant', () => {
    render(<IdCell value="abcдef" variant="full" />)
    expect(screen.getByText('abcдef')).toBeInTheDocument()
  })
  it('mono-ellipsis variant with maxWidth', () => {
    render(<IdCell value="xyz-id" variant="mono-ellipsis" maxWidth={100} />)
    expect(screen.getAllByText('xyz-id').length).toBeGreaterThan(0)
  })
})

function Boom(): JSX.Element {
  throw new Error('crash')
}

describe('ErrorBoundary', () => {
  it('renders fallback default UI on child error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('crash')).toBeInTheDocument()
    spy.mockRestore()
  })
  it('renders custom fallback', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary fallback={<div>custom fb</div>}>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByText('custom fb')).toBeInTheDocument()
    spy.mockRestore()
  })
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>safe</div>
      </ErrorBoundary>,
    )
    expect(screen.getByText('safe')).toBeInTheDocument()
  })
})
