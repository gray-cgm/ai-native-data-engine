import { logger } from '../utils/logger.js'
import { platformFetch } from '../services/platform.js'
import type {
  DashboardPayload,
  DatasetItem,
  DatasetVersion,
  DistributionRow,
  ExportItem,
  RunItem,
  ScenarioTriageSummary,
  SearchRow,
  StreamingSummary,
  TaskItem,
  WorkspaceItem,
} from '../types.js'

export async function getDashboardPayload() {
  const [distributionRes, datasetsRes, tasksRes, workspacesRes, exportsRes, searchRes, runsRes, streamingRes] = await Promise.all([
    platformFetch('/samples/distribution').catch((err) => {
      logger.error('dashboard fetch failed', { endpoint: '/samples/distribution', error: String(err) })
      return { distribution: [], scenario: null }
    }),
    platformFetch('/datasets').catch((err) => {
      logger.error('dashboard fetch failed', { endpoint: '/datasets', error: String(err) })
      return { items: [] }
    }),
    platformFetch('/tasks').catch((err) => {
      logger.error('dashboard fetch failed', { endpoint: '/tasks', error: String(err) })
      return { items: [] }
    }),
    platformFetch('/workspaces').catch((err) => {
      logger.error('dashboard fetch failed', { endpoint: '/workspaces', error: String(err) })
      return { items: [] }
    }),
    platformFetch('/exports').catch((err) => {
      logger.error('dashboard fetch failed', { endpoint: '/exports', error: String(err) })
      return { items: [] }
    }),
    platformFetch('/samples/search-preview').catch((err) => {
      logger.error('dashboard fetch failed', { endpoint: '/samples/search-preview', error: String(err) })
      return { rows: [] }
    }),
    platformFetch('/runs').catch((err) => {
      logger.error('dashboard fetch failed', { endpoint: '/runs', error: String(err) })
      return { items: [] }
    }),
    platformFetch('/streaming/summary').catch((err) => {
      logger.error('dashboard fetch failed', { endpoint: '/streaming/summary', error: String(err) })
      return { summary: null }
    }),
  ])

  const datasets = ((datasetsRes as { items?: DatasetItem[] }).items ?? []) as DatasetItem[]
  const versionEntries = await Promise.all(
    datasets.map(async (item) => {
      const detail = (await platformFetch(`/datasets/${item.dataset_id}`)) as { versions?: DatasetVersion[] }
      return [item.dataset_id, detail.versions ?? []] as const
    }),
  )

  return {
    distribution: ((distributionRes as { distribution?: DistributionRow[] }).distribution ?? []) as DistributionRow[],
    scenario: ((distributionRes as { scenario?: ScenarioTriageSummary }).scenario ?? null) as ScenarioTriageSummary | null,
    streaming: ((streamingRes as { summary?: StreamingSummary | null }).summary ?? null) as StreamingSummary | null,
    datasets,
    datasetVersions: Object.fromEntries(versionEntries),
    tasks: ((tasksRes as { items?: TaskItem[] }).items ?? []) as TaskItem[],
    workspaces: ((workspacesRes as { items?: WorkspaceItem[] }).items ?? []) as WorkspaceItem[],
    exports: ((exportsRes as { items?: ExportItem[] }).items ?? []) as ExportItem[],
    runs: ((runsRes as { items?: RunItem[] }).items ?? []) as RunItem[],
    searchRows: ((searchRes as { rows?: SearchRow[] }).rows ?? []) as SearchRow[],
  } satisfies DashboardPayload
}