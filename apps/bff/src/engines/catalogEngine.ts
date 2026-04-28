import type { WorkspaceItem } from '../types.js'
import { applyCollectionQuery } from '../utils/collection.js'
import { platformFetch } from '../services/platform.js'

/**
 * Catalog 引擎只保留 workspace 列表。
 *
 * 旧的 dataset / dataset-version 列表函数已下线 —— v3 重构后 dataset 主数据
 * 走 ``datasets_v2`` 表（apps/bff/src/engines/datasetsEngine.ts）。
 */

type Query = Record<string, unknown>

async function listWorkspaces() {
  const response = (await platformFetch('/workspaces')) as { items?: WorkspaceItem[] }
  return response.items ?? []
}

export async function queryWorkspaces(query: Query) {
  const items = await listWorkspaces()
  return applyCollectionQuery<WorkspaceItem>(items, {
    query,
    defaultSort: { field: 'name', order: 'asc' },
    searchableText: (item) => `${item.workspace_id} ${item.name}`,
  })
}
