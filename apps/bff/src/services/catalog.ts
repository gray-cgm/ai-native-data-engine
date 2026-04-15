import type { DatasetDetail, DatasetItem, DatasetVersion, WorkspaceItem } from '../types.js'
import { platformFetch } from './platform.js'

export async function listWorkspaces() {
  const response = (await platformFetch('/workspaces')) as { items?: WorkspaceItem[] }
  return response.items ?? []
}

export async function listDatasets() {
  const response = (await platformFetch('/datasets')) as { items?: DatasetItem[] }
  return response.items ?? []
}

export async function getDataset(datasetId: string) {
  return (await platformFetch(`/datasets/${datasetId}`)) as DatasetDetail
}

export async function listDatasetVersions(datasetId: string) {
  const response = (await platformFetch(`/datasets/${datasetId}/versions`)) as { items?: DatasetVersion[] }
  return response.items ?? []
}