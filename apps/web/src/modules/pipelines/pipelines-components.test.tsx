import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { renderWithRouter } from '@/test-utils'

const m = vi.hoisted(() => ({
  fetchRunBreadcrumb: vi.fn(),
  fetchRecentTraces: vi.fn(),
  fetchTraceChain: vi.fn(),
}))
vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api')
  return { ...actual, ...m }
})

import { PlaceholderView } from './components/placeholder-view'
import { RunDetailDrawer } from './components/run-detail.drawer'

afterEach(() => vi.clearAllMocks())

describe('PlaceholderView', () => {
  it('renders title, description and bullets', () => {
    render(<PlaceholderView title="Coming soon" description="desc" bullets={['a', 'b']} />)
    expect(screen.getByText('Coming soon')).toBeInTheDocument()
    expect(screen.getByText('a')).toBeInTheDocument()
  })
  it('renders without bullets', () => {
    render(<PlaceholderView title="t" description="d" />)
    expect(screen.getByText('t')).toBeInTheDocument()
  })
})

describe('RunDetailDrawer', () => {
  it('does not fetch while closed', () => {
    renderWithRouter(<RunDetailDrawer runId="r1" open={false} onClose={() => {}} />)
    expect(m.fetchRunBreadcrumb).not.toHaveBeenCalled()
  })

  it('loads the breadcrumb when opened', async () => {
    m.fetchRunBreadcrumb.mockResolvedValue({
      requirement: { id: 'req1', title: 'Req' },
      data_task: { id: 'dt1' },
      operations_task: null,
      run: { id: 'r1', status: 'success' },
    })
    renderWithRouter(<RunDetailDrawer runId="r1" open onClose={() => {}} />)
    await waitFor(() => expect(m.fetchRunBreadcrumb).toHaveBeenCalledWith('r1'))
  })

  it('shows error when breadcrumb fails', async () => {
    m.fetchRunBreadcrumb.mockRejectedValue(new Error('bc boom'))
    renderWithRouter(<RunDetailDrawer runId="r2" open onClose={() => {}} />)
    await waitFor(() => expect(m.fetchRunBreadcrumb).toHaveBeenCalled())
  })
})
