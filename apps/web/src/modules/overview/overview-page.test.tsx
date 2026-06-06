import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithRouter } from '@/test-utils'

const m = vi.hoisted(() => ({
  fetchRequirementStats: vi.fn(),
  fetchRequirementList: vi.fn(),
  fetchPipelineRuns: vi.fn(),
  fetchPipelineCostStats: vi.fn(),
  fetchDatasets: vi.fn(),
  fetchOpsOverview: vi.fn(),
  fetchScenarios: vi.fn(),
  fetchToolsRegistry: vi.fn(),
  fetchSnapshotsSummary: vi.fn(),
}))
vi.mock('./api', () => m)

import OverviewPage from './pages/overview.page'

afterEach(() => vi.clearAllMocks())

function primeAll() {
  m.fetchRequirementStats.mockResolvedValue({ total: 4, by_status: { draft: 1 }, by_priority: { high: 2 }, by_source: {} })
  m.fetchRequirementList.mockResolvedValue({ items: [], total: 0 })
  m.fetchPipelineRuns.mockResolvedValue({ items: [], total: 0 })
  m.fetchPipelineCostStats.mockResolvedValue({ total_runs: 0, totals: {} })
  m.fetchDatasets.mockResolvedValue({ items: [], total: 0 })
  m.fetchOpsOverview.mockResolvedValue({ modules: [] })
  m.fetchScenarios.mockResolvedValue({ items: [] })
  m.fetchToolsRegistry.mockResolvedValue({ items: [] })
  m.fetchSnapshotsSummary.mockResolvedValue({ total: 0, used: 0, fresh: 0, cold: 0 })
}

describe('OverviewPage', () => {
  it('loads every dashboard card endpoint', async () => {
    primeAll()
    renderWithRouter(<OverviewPage />)
    await waitFor(() => expect(m.fetchRequirementStats).toHaveBeenCalled())
    expect(m.fetchOpsOverview).toHaveBeenCalled()
    expect(m.fetchPipelineRuns).toHaveBeenCalled()
    expect(m.fetchDatasets).toHaveBeenCalled()
    expect(m.fetchScenarios).toHaveBeenCalled()
    expect(m.fetchToolsRegistry).toHaveBeenCalled()
    expect(m.fetchSnapshotsSummary).toHaveBeenCalled()
  })

  it('survives per-card fetch failures (cards isolate errors)', async () => {
    primeAll()
    m.fetchScenarios.mockRejectedValue(new Error('scenario down'))
    renderWithRouter(<OverviewPage />)
    await waitFor(() => expect(m.fetchRequirementStats).toHaveBeenCalled())
    // page itself still renders (no global crash)
    expect(document.body.textContent?.length ?? 0).toBeGreaterThan(0)
  })
})
