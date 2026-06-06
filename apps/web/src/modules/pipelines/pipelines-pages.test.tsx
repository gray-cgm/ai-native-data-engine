import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithRouter } from '@/test-utils'

const m = vi.hoisted(() => ({
  fetchRuns: vi.fn(),
  fetchPipelineRuns: vi.fn(),
  fetchRunBreadcrumb: vi.fn(),
  fetchPipelineStageStats: vi.fn(),
  fetchQualityStats: vi.fn(),
  fetchCostStats: vi.fn(),
  fetchRecentTraces: vi.fn(),
  fetchTraceChain: vi.fn(),
  fetchStreamingHealth: vi.fn(),
}))
vi.mock('./api', () => m)

import PipelinesPage from './pages/pipelines.page'

const run = {
  run_id: 'r1',
  job_name: 'xminer',
  status: 'success',
  requirement_id: null,
  created_at: '2026-01-01T00:00:00Z',
  derived_assets: [],
}

const qualityStats = {
  total_runs: 10,
  total_with_metrics: 8,
  pass_rate: 0.8,
  by_gate_result: { pass: 6, waiver: 1, block: 1 },
  top_failure_reasons: [{ reason: 'low_recall', count: 2 }],
  by_run_purpose: {},
  by_stage: {},
}

const costStats = {
  total_runs: 10,
  totals: { cost_usd: 100, cpu_seconds: 1, gpu_seconds: 1, storage_gb: 1, duration_seconds: 1 },
  by_requirement: [{ requirement_id: 'req1', title: 'Req One', cost_usd: 50 }],
  by_pipeline: [{ pipeline_name: 'p1', cost_usd: 40 }],
  by_stage: [{ stage: 's1', cost_usd: 30 }],
  by_run_purpose: [{ run_purpose: 'mining', cost_usd: 20 }],
}

function primeAll() {
  m.fetchRuns.mockResolvedValue([run])
  m.fetchPipelineRuns.mockResolvedValue([run])
  m.fetchQualityStats.mockResolvedValue(qualityStats)
  m.fetchCostStats.mockResolvedValue(costStats)
  m.fetchRecentTraces.mockResolvedValue([
    { x_trace_id: 't1', requirement_id: 'req1', requirement_title: 'Req', run_count: 2, latest_at: null },
  ])
  m.fetchTraceChain.mockResolvedValue({
    x_trace_id: 't1', requirements: [], data_tasks: [], operations_tasks: [], pipeline_runs: [],
  })
  m.fetchStreamingHealth.mockResolvedValue(null)
  m.fetchRunBreadcrumb.mockResolvedValue({})
}

afterEach(() => vi.clearAllMocks())

describe('PipelinesPage tabs', () => {
  it('renders the overview tab by default', async () => {
    primeAll()
    renderWithRouter(<PipelinesPage />, ['/pipelines?tab=overview'])
    await waitFor(() => expect(m.fetchRuns).toHaveBeenCalled())
  })

  it('renders the runs tab', async () => {
    primeAll()
    renderWithRouter(<PipelinesPage />, ['/pipelines?tab=runs'])
    await waitFor(() => expect(m.fetchPipelineRuns).toHaveBeenCalled())
  })

  it('renders the quality tab', async () => {
    primeAll()
    renderWithRouter(<PipelinesPage />, ['/pipelines?tab=quality'])
    await waitFor(() => expect(m.fetchQualityStats).toHaveBeenCalled())
  })

  it('renders the cost tab', async () => {
    primeAll()
    renderWithRouter(<PipelinesPage />, ['/pipelines?tab=cost'])
    await waitFor(() => expect(m.fetchCostStats).toHaveBeenCalled())
    expect(screen.getAllByText(/Req One|Runs/).length).toBeGreaterThan(0)
  })

  it('renders the lineage tab', async () => {
    primeAll()
    renderWithRouter(<PipelinesPage />, ['/pipelines?tab=lineage'])
    await waitFor(() => expect(m.fetchRecentTraces).toHaveBeenCalled())
  })
})
