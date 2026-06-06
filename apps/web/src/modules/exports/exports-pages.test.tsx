import { afterEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderWithRouter } from '@/test-utils'

const m = vi.hoisted(() => ({
  fetchSnapshots: vi.fn(),
  fetchSnapshotDetail: vi.fn(),
  fetchTrainRuns: vi.fn(),
  createTrainRun: vi.fn(),
  patchTrainRun: vi.fn(),
  fetchUsage: vi.fn(),
  fetchContributions: vi.fn(),
  fetchContributionsRollup: vi.fn(),
  fetchContribution: vi.fn(),
}))
vi.mock('./api', () => m)

import ExportsPage from './pages/exports.page'

function primeAll() {
  m.fetchSnapshots.mockResolvedValue({
    items: [],
    total: 0,
    summary: { total: 0, used: 0, fresh: 0, cold: 0 },
  })
  m.fetchTrainRuns.mockResolvedValue({ items: [], total: 0 })
  m.fetchUsage.mockResolvedValue({ items: [], total: 0 })
  m.fetchContributions.mockResolvedValue({ items: [], total: 0 })
  m.fetchContributionsRollup.mockResolvedValue({ items: [], total: 0 })
}

afterEach(() => vi.clearAllMocks())

describe('ExportsPage tabs', () => {
  it('renders snapshots tab by default', async () => {
    primeAll()
    renderWithRouter(<ExportsPage />, ['/exports?tab=snapshots'])
    await waitFor(() => expect(m.fetchSnapshots).toHaveBeenCalled())
  })

  it('renders consumers tab', async () => {
    primeAll()
    renderWithRouter(<ExportsPage />, ['/exports?tab=consumers'])
    await waitFor(() => expect(m.fetchTrainRuns).toHaveBeenCalled())
  })

  it('renders hard-samples tab', async () => {
    primeAll()
    renderWithRouter(<ExportsPage />, ['/exports?tab=hard-samples'])
    await waitFor(() => expect(m.fetchContributions).toHaveBeenCalled())
  })

  it('renders roi tab', async () => {
    primeAll()
    renderWithRouter(<ExportsPage />, ['/exports?tab=roi'])
    await waitFor(() => expect(m.fetchContributionsRollup).toHaveBeenCalled())
  })
})
