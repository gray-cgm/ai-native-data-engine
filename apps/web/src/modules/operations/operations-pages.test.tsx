import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithRouter } from '@/test-utils'

const m = vi.hoisted(() => ({
  fetchOpsItems: vi.fn(),
  fetchOpsItem: vi.fn(),
  createOpsItem: vi.fn(),
  patchOpsItem: vi.fn(),
  deleteOpsItem: vi.fn(),
  fetchOpsVocab: vi.fn(),
  fetchOpsStats: vi.fn(),
  fetchOpsOverview: vi.fn(),
}))
const dash = vi.hoisted(() => ({ fetchTasks: vi.fn(), fetchExports: vi.fn() }))

vi.mock('./ops-modules-api', async () => {
  const actual = await vi.importActual<typeof import('./ops-modules-api')>('./ops-modules-api')
  return { ...actual, ...m }
})
vi.mock('./api', () => dash)
vi.mock('@/modules/datasets/dataset-picker', () => ({
  DatasetPicker: () => <div data-testid="dataset-picker" />,
}))
vi.mock('../components/promote-to-official-button', () => ({
  PromoteToOfficialButton: () => <button>Promote</button>,
}))

import LabelingPage from './pages/labeling.page'
import MiningPage from './pages/mining.page'
import ReleasePage from './pages/release.page'
import TaskBoardPage from './pages/task-board.page'
import ExportListPage from './pages/export-list.page'
import CheckingPage from './pages/checking.page'
import TaggingPage from './pages/tagging.page'

const opsItem = {
  id: 'item-abcdef123',
  module: 'labeling' as const,
  title: 'Label batch 1',
  status: 'in_progress',
  kind: 'bbox',
  owner: 'alice',
  clip_ids: ['c-1', 'c-2'],
  dataset_id: 'ds-1',
  scenario: 'night',
  requirement_id: 'req-1',
  data_task_id: 'dt-1',
  operations_task_id: null,
  x_trace_id: 'trace-xyz',
  payload: { foo: 'bar' },
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}

function primeOps(items = [opsItem]) {
  m.fetchOpsItems.mockResolvedValue({ items, pagination: { total: items.length, skip: 0, limit: 20 } })
  m.fetchOpsVocab.mockResolvedValue({ module: 'labeling', status_options: ['in_progress', 'done'], kind_options: ['bbox'] })
  m.fetchOpsStats.mockResolvedValue({ module: 'labeling', counts: { total: 1, in_progress: 1 } })
}

afterEach(() => vi.clearAllMocks())

describe('OpsModuleListPage via LabelingPage', () => {
  it('renders items and stats', async () => {
    primeOps()
    renderWithRouter(<LabelingPage />, ['/ops/labeling'])
    await waitFor(() => expect(screen.getByText('Label batch 1')).toBeInTheDocument())
    expect(screen.getByText('Labeling')).toBeInTheDocument()
    // extraRowActions link rendered
    expect(screen.getByText('标注')).toBeInTheDocument()
  })

  it('shows empty state with a create CTA', async () => {
    primeOps([])
    m.fetchOpsStats.mockResolvedValue({ module: 'labeling', counts: { total: 0 } })
    renderWithRouter(<LabelingPage />, ['/ops/labeling'])
    await waitFor(() => expect(screen.getByText(/Create first/)).toBeInTheDocument())
  })

  it('opens the create modal', async () => {
    primeOps()
    renderWithRouter(<LabelingPage />, ['/ops/labeling'])
    await waitFor(() => expect(screen.getByText('Label batch 1')).toBeInTheDocument())
    fireEvent.click(screen.getByText(/New Labeling/))
    await waitFor(() => expect(screen.getAllByText(/Title/).length).toBeGreaterThan(0))
  })

  it('opens the edit drawer for a row', async () => {
    primeOps()
    renderWithRouter(<LabelingPage />, ['/ops/labeling'])
    await waitFor(() => expect(screen.getByText('Label batch 1')).toBeInTheDocument())
    fireEvent.click(screen.getAllByText('Edit')[0])
    await waitFor(() => expect(screen.getByText(/Edit ·/)).toBeInTheDocument())
  })

  it('applies and clears linkage filters via the URL', async () => {
    primeOps()
    renderWithRouter(<LabelingPage />, ['/ops/labeling'])
    await waitFor(() => expect(screen.getByText('Label batch 1')).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText('Requirement ID'), { target: { value: 'req-9' } })
    fireEvent.click(screen.getByText('Apply'))
    await waitFor(() =>
      expect(
        m.fetchOpsItems.mock.calls.some(([, params]) => params?.requirementId === 'req-9'),
      ).toBe(true),
    )
    fireEvent.click(screen.getByText('Clear'))
  })

  it('refreshes the list on demand', async () => {
    primeOps()
    renderWithRouter(<LabelingPage />, ['/ops/labeling'])
    await waitFor(() => expect(screen.getByText('Label batch 1')).toBeInTheDocument())
    m.fetchOpsItems.mockClear()
    fireEvent.click(screen.getByText('Refresh'))
    await waitFor(() => expect(m.fetchOpsItems).toHaveBeenCalled())
  })

  it('renders error state when list fails', async () => {
    m.fetchOpsItems.mockRejectedValue(new Error('ops boom'))
    m.fetchOpsVocab.mockResolvedValue({ module: 'mining', status_options: [], kind_options: [] })
    m.fetchOpsStats.mockResolvedValue({ module: 'mining', counts: {} })
    renderWithRouter(<MiningPage />, ['/ops/mining'])
    await waitFor(() => expect(screen.getByText('ops boom')).toBeInTheDocument())
  })

  it('renders the release module with promote action', async () => {
    primeOps()
    renderWithRouter(<ReleasePage />, ['/ops/release'])
    await waitFor(() => expect(screen.getByText('Promote')).toBeInTheDocument())
  })

  it('renders the checking and tagging modules', async () => {
    primeOps()
    renderWithRouter(<CheckingPage />, ['/ops/checking'])
    await waitFor(() => expect(screen.getByText('Label batch 1')).toBeInTheDocument())
    primeOps()
    renderWithRouter(<TaggingPage />, ['/ops/tagging'])
    await waitFor(() => expect(screen.getAllByText('Label batch 1').length).toBeGreaterThan(0))
  })
})

describe('TaskBoardPage', () => {
  it('renders task rows', async () => {
    dash.fetchTasks.mockResolvedValue([
      { task_id: 't1', title: 'Collect', status: 'pending', task_type: 'collection' },
    ])
    renderWithRouter(<TaskBoardPage />)
    await waitFor(() => expect(screen.getByText('Collect')).toBeInTheDocument())
  })
})

describe('ExportListPage', () => {
  it('renders export rows', async () => {
    dash.fetchExports.mockResolvedValue([
      { export_id: 'e1', dataset_id: 'd1', format: 'coco', status: 'done', output_path: '/out' },
    ])
    renderWithRouter(<ExportListPage />)
    await waitFor(() => expect(screen.getByText('coco')).toBeInTheDocument())
  })
})
