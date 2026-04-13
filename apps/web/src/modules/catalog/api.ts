import { apiGet, apiPost } from '@/shared/api/client'
import type { DatasetItem, DatasetVersion, DashboardPayload } from '@/shared/types/common'

export interface DatasetDetail {
  dataset: DatasetItem
  versions: DatasetVersion[]
}

export async function fetchDatasets(): Promise<DatasetItem[]> {
  const data = await apiGet<DashboardPayload>('/dashboard')
  return data.datasets
}

export async function fetchDatasetDetail(datasetId: string): Promise<DatasetDetail> {
  const data = await apiGet<DashboardPayload>('/dashboard')
  const dataset = data.datasets.find((d) => d.dataset_id === datasetId)
  if (!dataset) throw new Error(`Dataset ${datasetId} not found`)
  const versions = data.datasetVersions[datasetId] ?? []
  return { dataset, versions }
}

export async function exportDataset(datasetId: string): Promise<unknown> {
  return apiPost(`/datasets/${datasetId}/exports`)
}
