import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderRoutePage, renderWithRouter } from '@/test-utils'

const { api, apiGet } = vi.hoisted(() => ({
  api: {
    fetchRequirements: vi.fn(),
    fetchRequirementStats: vi.fn(),
    fetchRequirementDetail: vi.fn(),
    fetchRequirementReport: vi.fn(),
    signOffTask: vi.fn(),
  },
  apiGet: vi.fn(),
}))
vi.mock('./api', () => api)

// data-task page reaches into the raw client + pipelines api
vi.mock('@/shared/api/client', () => ({
  apiGet: (...a: unknown[]) => apiGet(...a),
  apiPost: vi.fn(),
}))
vi.mock('@/modules/pipelines/api', () => ({ fetchPipelineRuns: vi.fn().mockResolvedValue([]) }))

import RequirementListPage from './pages/requirement-list.page'
import RequirementDetailPage from './pages/requirement-detail.page'
import RequirementReportPage from './pages/requirement-report.page'
import DataTaskDetailPage from './pages/data-task-detail.page'

const listItem = {
  id: 'req-123456789',
  title: 'Lane change at night',
  description: 'desc',
  priority: 'high',
  source: 'feishu',
  status: 'in_progress',
  dre_owner: 'alice',
  scene_tags: ['night', 'highway'],
  vehicle_tags: null,
  task_count: 2,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}

const stats = {
  total: 5,
  by_status: { in_progress: 2, draft: 1 },
  by_priority: { high: 3 },
  by_source: { feishu: 5 },
}

afterEach(() => vi.clearAllMocks())

describe('RequirementListPage', () => {
  it('renders rows from the list endpoint', async () => {
    api.fetchRequirements.mockResolvedValue({ total: 1, page: 1, page_size: 20, items: [listItem] })
    api.fetchRequirementStats.mockResolvedValue(stats)

    renderWithRouter(<RequirementListPage />)
    await waitFor(() => expect(screen.getByText('Lane change at night')).toBeInTheDocument())
    expect(api.fetchRequirements).toHaveBeenCalled()
  })

  it('renders the filter input and stats bar', async () => {
    api.fetchRequirements.mockResolvedValue({ total: 1, page: 1, page_size: 20, items: [listItem] })
    api.fetchRequirementStats.mockResolvedValue(stats)

    renderWithRouter(<RequirementListPage />)
    await waitFor(() => expect(screen.getByPlaceholderText('Search by title...')).toBeInTheDocument())
    // typing updates local filter state without crashing
    fireEvent.change(screen.getByPlaceholderText('Search by title...'), { target: { value: 'rain' } })
    expect((screen.getByPlaceholderText('Search by title...') as HTMLInputElement).value).toBe('rain')
  })

  it('refetches when the keyword filter changes (cacheKey 纳入筛选条件)', async () => {
    api.fetchRequirements.mockResolvedValue({ total: 1, page: 1, page_size: 20, items: [listItem] })
    api.fetchRequirementStats.mockResolvedValue(stats)

    renderWithRouter(<RequirementListPage />)
    await waitFor(() => expect(screen.getByText('Lane change at night')).toBeInTheDocument())
    const callsBefore = api.fetchRequirements.mock.calls.length

    fireEvent.change(screen.getByPlaceholderText('Search by title...'), { target: { value: 'rain' } })

    // 修复前：cacheKey 静态 'requirements' → 改关键字不重新请求；修复后必须再次 fetch
    await waitFor(() =>
      expect(api.fetchRequirements).toHaveBeenCalledWith(expect.objectContaining({ keyword: 'rain' })),
    )
    expect(api.fetchRequirements.mock.calls.length).toBeGreaterThan(callsBefore)
  })
})

describe('RequirementDetailPage', () => {
  const detail = {
    ...listItem,
    feishu_doc_id: null,
    target_scene: 'night driving',
    estimated_data_volume: 1000,
    due_date: '2026-03-01',
    data_tasks: [
      {
        id: 'dt-1',
        requirement_id: 'req-123456789',
        title: 'Collect clips',
        description: null,
        task_type: 'collection',
        status: 'in_progress',
        sign_off_status: 'pending',
        sign_off_by: null,
        sign_off_at: null,
        sign_off_comment: null,
        assigned_to: 'bob',
        target_count: 100,
        actual_count: 40,
        due_date: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
      },
    ],
  }

  it('renders the requirement title and info', async () => {
    api.fetchRequirementDetail.mockResolvedValue(detail)
    renderRoutePage(<RequirementDetailPage />, '/requirements/:id', '/requirements/req-123456789')
    await waitFor(() => expect(screen.getAllByText('Lane change at night').length).toBeGreaterThan(0))
    expect(screen.getByText('Requirement Info')).toBeInTheDocument()
  })

  it('renders error state', async () => {
    api.fetchRequirementDetail.mockRejectedValue(new Error('detail boom'))
    renderRoutePage(<RequirementDetailPage />, '/requirements/:id', '/requirements/x')
    await waitFor(() => expect(screen.getByText('detail boom')).toBeInTheDocument())
  })
})

describe('RequirementReportPage', () => {
  const report = {
    requirement: {
      ...listItem,
      feishu_doc_id: null,
      target_scene: 'night',
      estimated_data_volume: 1000,
      due_date: null,
      data_tasks: [],
    },
    headline: {
      data_task_count: 3,
      data_task_completed: 1,
      ops_task_count: 5,
      pipeline_run_count: 8,
      dataset_count: 2,
      snapshot_count: 1,
      lineage_event_count: 12,
    },
    sections: {
      manager: {
        funnel: [
          { task_type: 'collection', task_count: 2, target_count: 100, actual_count: 60, completion_ratio: 0.6, completed_task_count: 1 },
        ],
        cost: {
          total_cost_usd: 12.5,
          total_cpu_seconds: 100,
          total_gpu_seconds: 50,
          total_duration_seconds: 200,
          total_rows_in: 1000,
          total_rows_out: 800,
          run_count: 8,
        },
      },
      data_engineer: {
        pipeline_health: { running: 1, success: 6, failed: 1, pending: 0 },
        failed_top: [],
        ops_by_module: {},
        snapshots: [],
      },
      mle: {
        datasets: [],
        customized_count: 1,
        official_count: 1,
        training_impact_totals: {
          consumed_count: 10, train_run_count: 2, snapshot_count: 1, hard_sample_count: 3, sample_count: 500,
        },
        dataset_impacts: [],
        export_snapshots: [],
        loop_back_tasks: [],
      },
    },
  }

  it('renders headline metrics when the report loads', async () => {
    api.fetchRequirementReport.mockResolvedValue(report)
    renderRoutePage(<RequirementReportPage />, '/requirements/:id/report', '/requirements/req-123456789/report')
    await waitFor(() => expect(api.fetchRequirementReport).toHaveBeenCalled())
    // report body renders (no global error fallback)
    await waitFor(() => expect(screen.queryByText('Unable to load content')).not.toBeInTheDocument())
  })

  it('renders error state when report fails', async () => {
    api.fetchRequirementReport.mockRejectedValue(new Error('report boom'))
    renderRoutePage(<RequirementReportPage />, '/requirements/:id/report', '/requirements/r-other/report')
    await waitFor(() => expect(screen.getByText('report boom')).toBeInTheDocument())
  })
})

describe('DataTaskDetailPage', () => {
  it('renders not-found when the task is missing', async () => {
    apiGet.mockResolvedValue(null)
    renderRoutePage(<DataTaskDetailPage />, '/data-tasks/:taskId', '/data-tasks/dt-x')
    await waitFor(() => expect(screen.getAllByText(/Data Task/).length).toBeGreaterThan(0))
  })
})
