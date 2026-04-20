import type { RequirementItem } from '../services/requirements.js'
import { applyCollectionQuery } from '../utils/collection.js'
import {
  listRequirements,
  getRequirement,
  getRequirementStats,
  createRequirement,
  updateRequirement,
  createDataTask,
  updateDataTask,
  signOffDataTask,
} from '../services/requirements.js'

type Query = Record<string, unknown>

export async function queryRequirements(query: Query) {
  const apiQuery: Record<string, string> = {}
  if (typeof query.status === 'string' && query.status) apiQuery.status = query.status
  if (typeof query.priority === 'string' && query.priority) apiQuery.priority = query.priority
  if (typeof query.source === 'string' && query.source) apiQuery.source = query.source
  if (typeof query.keyword === 'string' && query.keyword) apiQuery.keyword = query.keyword

  const page = typeof query.page === 'string' ? query.page : '1'
  const pageSize = typeof query.pageSize === 'string' ? query.pageSize : '20'
  apiQuery.page = page
  apiQuery.page_size = pageSize

  return listRequirements(apiQuery)
}

export async function findRequirement(id: string) {
  return getRequirement(id)
}

export async function fetchRequirementStats() {
  return getRequirementStats()
}

export async function submitRequirement(body: Record<string, unknown>) {
  return createRequirement(body)
}

export async function patchRequirement(id: string, body: Record<string, unknown>) {
  return updateRequirement(id, body)
}

export async function submitDataTask(body: Record<string, unknown>) {
  return createDataTask(body)
}

export async function patchDataTask(id: string, body: Record<string, unknown>) {
  return updateDataTask(id, body)
}

export async function approveOrRejectDataTask(id: string, body: Record<string, unknown>) {
  return signOffDataTask(id, body)
}
