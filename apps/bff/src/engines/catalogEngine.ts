import type { DatasetItem, DatasetVersion, WorkspaceItem } from '../types.js'
import { applyCollectionQuery } from '../utils/collection.js'
import { getDataset, listDatasets, listDatasetVersions, listWorkspaces } from '../services/catalog.js'

type Query = Record<string, unknown>

export async function queryWorkspaces(query: Query) {
  const items = await listWorkspaces()
  return applyCollectionQuery<WorkspaceItem>(items, {
    query,
    defaultSort: { field: 'name', order: 'asc' },
    searchableText: (item) => `${item.workspace_id} ${item.name}`,
  })
}

export async function queryDatasets(query: Query) {
  const workspaceId = getString(query.workspaceId)
  const profile = getString(query.profile)
  const items = await listDatasets()

  return applyCollectionQuery<DatasetItem>(items, {
    query,
    defaultSort: { field: 'name', order: 'asc' },
    filter: (item) => {
      if (workspaceId && item.workspace_id !== workspaceId) {
        return false
      }
      if (profile && item.profile !== profile) {
        return false
      }
      return true
    },
    searchableText: (item) => `${item.dataset_id} ${item.name} ${item.workspace_id} ${item.profile}`,
  })
}

export async function findDataset(datasetId: string) {
  const detail = await getDataset(datasetId)
  return {
    ...detail,
    versionCount: detail.versions.length,
  }
}

export async function queryDatasetVersions(datasetId: string, query: Query) {
  const tableName = getString(query.tableName)
  const items = await listDatasetVersions(datasetId)

  return applyCollectionQuery<DatasetVersion>(items, {
    query,
    defaultSort: { field: 'version_id', order: 'desc' },
    filter: (item) => {
      if (tableName && item.table_name !== tableName) {
        return false
      }
      return true
    },
    searchableText: (item) => `${item.version_id} ${item.table_name} ${item.dataset_id}`,
  })
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}