import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
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

import { ContributionsView } from './components/contributions-view'
import { ContributionDrawer } from './components/contribution.drawer'
import { SnapshotDetailDrawer } from './components/snapshot-detail.drawer'
import { TrainingHistorySection } from './components/training-history-section'
import { TrainingImpactSection } from './components/training-impact-section'
import { SnapshotsView } from './components/snapshots-view'
import { ConsumersView } from './components/consumers-view'
import { HardSamplesView } from './components/hard-samples-view'
import { RoiView } from './components/roi-view'

afterEach(() => vi.clearAllMocks())

const snapshot = {
  id: 'snap1', x_trace_id: 'trace-1', requirement_id: 'req-1', data_task_id: null,
  operations_task_id: null, gold_pipeline_run_id: null, pipeline_run_count: 1,
  dataset_id: 'ds-1', dataset_version_id: null, export_job_id: null, export_artifact_uri: 's3://x',
  export_format: 'coco', clip_ids: ['c1'], scenario: 'night', title: 'Snap one', summary: 'sum',
  sealed_at: '2026-01-01', consumed_count: 2, train_run_count: 1, last_consumed_at: '2026-01-02',
  hard_sample_count: 0, consumption_state: 'used' as const, created_at: '2026-01-01', updated_at: '2026-01-02',
}

const trainRun = {
  id: 'tr1', name: 'Run', consumer: 'mle', external_run_id: null, model_version: 'v1',
  started_at: '2026-01-01', finished_at: null, status: 'running', snapshot_ids: ['trace-1'],
  parent_trace_ids: [], x_trace_id: 'tr-trace', notes: null, created_at: '2026-01-01', updated_at: '2026-01-02',
}

const hardSample = {
  sample_uid: 's1', dataset_id: 'ds-1', clip_id: 'c1', ts: '1', consumed_count: 3,
  train_run_count: 2, mean_loss: 0.5, max_loss: 0.9, hard_score: 0.8, last_used_at: '2026-01-02',
}

const rollup = {
  dataset_id: 'ds-1', sample_count: 100, consumed_count: 50, train_run_count: 5,
  snapshot_count: 2, mean_loss: 0.4, hard_sample_count: 10, hard_ratio: 0.1,
}

describe('SnapshotsView', () => {
  it('renders snapshot rows and summary', async () => {
    m.fetchSnapshots.mockResolvedValue({
      items: [snapshot], total: 1, summary: { total: 1, used: 1, fresh: 0, cold: 0 },
    })
    renderWithRouter(<SnapshotsView />, ['/exports?tab=snapshots'])
    await waitFor(() => expect(screen.getAllByText(/Snap one|trace-1/).length).toBeGreaterThan(0))
  })
})

describe('ConsumersView', () => {
  it('renders train runs', async () => {
    m.fetchTrainRuns.mockResolvedValue({ items: [trainRun], total: 1 })
    m.fetchUsage.mockResolvedValue({ items: [], total: 0 })
    renderWithRouter(<ConsumersView />, ['/exports?tab=consumers'])
    await waitFor(() => expect(m.fetchTrainRuns).toHaveBeenCalled())
    await waitFor(() => expect(screen.getAllByText(/Run|running/).length).toBeGreaterThan(0))
  })
})

describe('HardSamplesView', () => {
  it('renders hard sample rows', async () => {
    m.fetchContributions.mockResolvedValue({ items: [hardSample], total: 1 })
    renderWithRouter(<HardSamplesView />, ['/exports?tab=hard-samples'])
    await waitFor(() => expect(m.fetchContributions).toHaveBeenCalled())
    await waitFor(() => expect(screen.getAllByText(/s1|c1/).length).toBeGreaterThan(0))
  })
})

describe('RoiView', () => {
  it('renders dataset rollup rows', async () => {
    m.fetchContributionsRollup.mockResolvedValue({ items: [rollup], total: 1 })
    renderWithRouter(<RoiView />, ['/exports?tab=roi'])
    await waitFor(() => expect(m.fetchContributionsRollup).toHaveBeenCalled())
    await waitFor(() => expect(screen.getAllByText(/ds-1/).length).toBeGreaterThan(0))
  })
})

describe('ContributionsView', () => {
  it('renders the lookup input', () => {
    renderWithRouter(<ContributionsView />, ['/exports?tab=hard-samples'])
    expect(document.querySelector('input')).toBeTruthy()
  })
})

describe('ContributionDrawer', () => {
  it('is closed when sampleUid is null', () => {
    renderWithRouter(<ContributionDrawer sampleUid={null} onClose={() => {}} />)
    expect(m.fetchContribution).not.toHaveBeenCalled()
  })
  it('loads contribution data when opened', async () => {
    m.fetchContribution.mockResolvedValue({
      sample_uid: 's1', dataset_id: 'd', clip_id: 'c', ts: null,
      consumed_count: 1, train_run_count: 1, snapshot_count: 0,
      mean_loss: 0.5, max_loss: 0.9, hard_score: 0.3,
      train_run_ids: [], snapshot_traces: [], events: [],
    })
    renderWithRouter(<ContributionDrawer sampleUid="s1" onClose={() => {}} />)
    await waitFor(() => expect(m.fetchContribution).toHaveBeenCalledWith('s1'))
  })
})

describe('SnapshotDetailDrawer', () => {
  it('loads snapshot detail when a trace is given', async () => {
    m.fetchSnapshotDetail.mockResolvedValue({
      id: 'snap1', x_trace_id: 't1', requirement_id: null, data_task_id: null,
      operations_task_id: null, gold_pipeline_run_id: null, pipeline_run_count: 0,
      dataset_id: null, dataset_version_id: null, export_job_id: null, export_artifact_uri: null,
      export_format: null, clip_ids: [], scenario: null, title: null, summary: null, sealed_at: null,
      consumed_count: 0, train_run_count: 0, last_consumed_at: null, hard_sample_count: 0,
      consumption_state: 'fresh', created_at: null, updated_at: null,
      manifest_json: null, train_runs: [],
    })
    renderWithRouter(<SnapshotDetailDrawer traceId="t1" onClose={() => {}} />)
    await waitFor(() => expect(m.fetchSnapshotDetail).toHaveBeenCalledWith('t1'))
  })
})

describe('TrainingHistorySection', () => {
  it('fetches usage events for the clip', async () => {
    m.fetchUsage.mockResolvedValue({ items: [], total: 0 })
    renderWithRouter(<TrainingHistorySection clipId="c1" datasetId="d1" />)
    await waitFor(() => expect(m.fetchUsage).toHaveBeenCalled())
  })
})

describe('TrainingImpactSection', () => {
  it('fetches rollup + contributions for the dataset', async () => {
    m.fetchContributionsRollup.mockResolvedValue({ items: [], total: 0 })
    m.fetchContributions.mockResolvedValue({ items: [], total: 0 })
    renderWithRouter(<TrainingImpactSection datasetId="d1" />)
    await waitFor(() => expect(m.fetchContributionsRollup).toHaveBeenCalled())
  })
})
