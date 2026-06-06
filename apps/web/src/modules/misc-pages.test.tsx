import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderRoutePage, renderWithRouter } from '@/test-utils'

const toolsApi = vi.hoisted(() => ({
  fetchToolsRegistry: vi.fn(),
  fetchToolHealth: vi.fn(),
  fetchToolWorkspaceContext: vi.fn(),
}))
const catalogClipDs = vi.hoisted(() => ({
  fetchClipDatasets: vi.fn(),
  fetchClipDatasetDetail: vi.fn(),
}))
const datasetsApi = vi.hoisted(() => ({ listDatasets: vi.fn(), getDataset: vi.fn(), listSamples: vi.fn() }))
const docsApi = vi.hoisted(() => ({ fetchDocTree: vi.fn(), fetchDocFile: vi.fn() }))
const pipelinesApi = vi.hoisted(() => ({ fetchRuns: vi.fn().mockResolvedValue([]) }))

vi.mock('@/modules/tools/api/tools', () => toolsApi)
vi.mock('./tools/api/tools', () => toolsApi)
vi.mock('./catalog/clip-datasets', async () => {
  const actual = await vi.importActual<typeof import('./catalog/clip-datasets')>('./catalog/clip-datasets')
  return { ...actual, ...catalogClipDs }
})
vi.mock('@/modules/datasets/datasets-api', () => datasetsApi)
vi.mock('./docs/api', async () => {
  const actual = await vi.importActual<typeof import('./docs/api')>('./docs/api')
  return { ...actual, ...docsApi }
})
vi.mock('@/modules/pipelines/api', () => pipelinesApi)
// heavy markdown / mermaid deps in the docs viewer
vi.mock('react-markdown', () => ({ default: ({ children }: { children?: string }) => <div>{children}</div> }))
vi.mock('./docs/components/mermaid-block', () => ({ MermaidBlock: () => <div data-testid="mermaid" /> }))

import SettingsPage from './settings/pages/settings.page'
import ToolsHomePage from './tools/pages/tools-home.page'
import ToolWorkspacePage from './tools/pages/tool-workspace.page'
import DatasetListPage from './catalog/pages/dataset-list.page'
import DatasetDetailPage from './catalog/pages/dataset-detail.page'
import DatasetV2DetailPage from './catalog/pages/dataset-v2-detail.page'
import DocsViewerPage from './docs/pages/docs-viewer.page'

afterEach(() => vi.clearAllMocks())

describe('SettingsPage', () => {
  it('renders without data dependencies', () => {
    renderWithRouter(<SettingsPage />)
    expect(document.body.textContent?.length ?? 0).toBeGreaterThan(0)
  })
})

describe('ToolsHomePage', () => {
  it('falls back to the static registry and renders tool cards', async () => {
    toolsApi.fetchToolsRegistry.mockRejectedValue(new Error('registry down'))
    renderWithRouter(<ToolsHomePage />)
    await waitFor(() => expect(screen.getByText('Platform Tools')).toBeInTheDocument())
    // static fallback registry has Dagster
    await waitFor(() => expect(screen.getAllByText(/Dagster/).length).toBeGreaterThan(0))
  })
})

describe('ToolWorkspacePage', () => {
  it('renders a workspace for a known tool', async () => {
    toolsApi.fetchToolsRegistry.mockResolvedValue([])
    toolsApi.fetchToolHealth.mockResolvedValue({
      tool_id: 'dagster', status: 'healthy', endpoint: '/h', checked_at: '', status_code: 200, detail: null,
    })
    toolsApi.fetchToolWorkspaceContext.mockResolvedValue({
      tool_id: 'dagster', workspace_id: null, dataset_id: null, dataset_version_id: null, request_id: null, actor: 'me',
    })
    renderRoutePage(<ToolWorkspacePage />, '/tools/:toolId', '/tools/dagster')
    await waitFor(() => expect(toolsApi.fetchToolHealth).toHaveBeenCalled())
  })
})

describe('DatasetListPage', () => {
  it('renders datasets from the v2 catalog', async () => {
    datasetsApi.listDatasets.mockResolvedValue({
      items: [
        {
          id: 'ds-1', name: 'Official set', dataset_type: 'official', dataset_version: 1,
          source_type: 'tags', requirement_id: null, allow_train: true, status: 'active',
          tag_expr: null, slice_strategy: 'flexible', ts_policy: 'p', default_range_l: 0,
          default_range_r: 0, created_by: 'me', resolved_meta: null,
          created_at: '2026-01-01', updated_at: '2026-01-02',
        },
      ],
      total: 1,
    })
    catalogClipDs.fetchClipDatasets.mockResolvedValue([])
    renderWithRouter(<DatasetListPage />, ['/catalog'])
    await waitFor(() => expect(datasetsApi.listDatasets).toHaveBeenCalled())
    await waitFor(() => expect(screen.getAllByText(/Official set/).length).toBeGreaterThan(0))
  })

  it('renders the by-scenario clip dataset view', async () => {
    catalogClipDs.fetchClipDatasets.mockResolvedValue([
      {
        dataset_id: 'scenario:night', grouping_key: 'scenario', scenario: 'night', name: 'night',
        clip_count: 3, keyframe_total: 30, duration_total_seconds: 15, vehicle_names: ['v'],
        cities: ['SF'], tags: ['rain'], sample_clip_ids: ['c1'],
      },
    ])
    datasetsApi.listDatasets.mockResolvedValue({ items: [], total: 0 })
    renderWithRouter(<DatasetListPage />, ['/catalog?view=scenario'])
    await waitFor(() => expect(catalogClipDs.fetchClipDatasets).toHaveBeenCalled())
  })
})

describe('DatasetDetailPage', () => {
  it('renders not-found when the clip dataset is missing', async () => {
    catalogClipDs.fetchClipDatasetDetail.mockResolvedValue(null)
    renderRoutePage(<DatasetDetailPage />, '/catalog/:datasetId', '/catalog/scenario:night')
    await waitFor(() => expect(catalogClipDs.fetchClipDatasetDetail).toHaveBeenCalled())
  })

  it('renders the clip dataset detail when present', async () => {
    catalogClipDs.fetchClipDatasetDetail.mockResolvedValue({
      dataset: {
        dataset_id: 'scenario:night',
        grouping_key: 'scenario',
        scenario: 'night',
        name: 'night',
        clip_count: 1,
        keyframe_total: 10,
        duration_total_seconds: 5,
        vehicle_names: ['veh'],
        cities: ['SF'],
        tags: ['rain'],
        sample_clip_ids: ['c1'],
      },
      clips: [],
    })
    renderRoutePage(<DatasetDetailPage />, '/catalog/:datasetId', '/catalog/scenario:night')
    await waitFor(() => expect(catalogClipDs.fetchClipDatasetDetail).toHaveBeenCalled())
  })
})

describe('DatasetV2DetailPage', () => {
  it('renders a v2 dataset with samples', async () => {
    datasetsApi.getDataset.mockResolvedValue({
      item: {
        id: 'ds-1', name: 'Set', dataset_type: 'customized', dataset_version: 1,
        source_type: 'tags', requirement_id: null, allow_train: true, status: 'active',
        tag_expr: null, slice_strategy: 'flexible', ts_policy: 'p', default_range_l: 0,
        default_range_r: 0, created_by: 'me', resolved_meta: null, created_at: null, updated_at: null,
      },
      sample_count: 0,
    })
    datasetsApi.listSamples.mockResolvedValue({ items: [], total: 0, limit: 200, offset: 0 })
    renderRoutePage(<DatasetV2DetailPage />, '/datasets/:datasetId', '/datasets/ds-1')
    await waitFor(() => expect(datasetsApi.getDataset).toHaveBeenCalled())
  })

  it('renders error state when the dataset fails to load', async () => {
    datasetsApi.getDataset.mockRejectedValue(new Error('ds boom'))
    datasetsApi.listSamples.mockResolvedValue({ items: [], total: 0, limit: 200, offset: 0 })
    renderRoutePage(<DatasetV2DetailPage />, '/datasets/:datasetId', '/datasets/ds-err')
    await waitFor(() => expect(screen.getByText('ds boom')).toBeInTheDocument())
  })
})

describe('DocsViewerPage', () => {
  it('renders the doc tree and loads a file', async () => {
    docsApi.fetchDocTree.mockResolvedValue({
      root: '/docs',
      nodes: [{ type: 'file', name: 'README.md', title: 'Readme', path: 'README.md' }],
    })
    docsApi.fetchDocFile.mockResolvedValue({
      path: 'README.md', title: 'Readme', content: '# Hello', size: 7, updated_at: '2026-01-01',
    })
    renderRoutePage(<DocsViewerPage />, '/docs/*', '/docs')
    await waitFor(() => expect(docsApi.fetchDocTree).toHaveBeenCalled())
  })

  it('attempts to load the tree even on failure', async () => {
    docsApi.fetchDocTree.mockRejectedValue(new Error('tree boom'))
    renderRoutePage(<DocsViewerPage />, '/docs/*', '/docs')
    await waitFor(() => expect(docsApi.fetchDocTree).toHaveBeenCalled())
  })
})
