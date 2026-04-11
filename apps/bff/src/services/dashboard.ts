import { platformFetch } from './platform.js'
import type {
  DashboardPayload,
  DatasetItem,
  DatasetVersion,
  DistributionRow,
  ExportItem,
  SearchRow,
  TaskItem,
  WorkspaceItem,
} from '../types.js'

export async function buildDashboardPayload(): Promise<DashboardPayload> {
  const [distributionRes, datasetsRes, tasksRes, workspacesRes, exportsRes, searchRes] = await Promise.all([
    platformFetch('/samples/distribution'),
    platformFetch('/datasets'),
    platformFetch('/tasks'),
    platformFetch('/workspaces'),
    platformFetch('/exports'),
    platformFetch('/samples/search-preview'),
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
    datasets,
    datasetVersions: Object.fromEntries(versionEntries),
    tasks: ((tasksRes as { items?: TaskItem[] }).items ?? []) as TaskItem[],
    workspaces: ((workspacesRes as { items?: WorkspaceItem[] }).items ?? []) as WorkspaceItem[],
    exports: ((exportsRes as { items?: ExportItem[] }).items ?? []) as ExportItem[],
    searchRows: ((searchRes as { rows?: SearchRow[] }).rows ?? []) as SearchRow[],
  }
}
