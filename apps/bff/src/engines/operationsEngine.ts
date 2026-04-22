import type { ExportItem, RunItem, TaskItem } from '../types.js'
import { applyCollectionQuery } from '../utils/collection.js'
import { platformFetch } from '../services/platform.js'

type Query = Record<string, unknown>

async function listTasks() {
  const response = (await platformFetch('/tasks')) as { items?: TaskItem[] }
  return response.items ?? []
}

async function listRuns() {
  const response = (await platformFetch('/runs')) as { items?: RunItem[] }
  return response.items ?? []
}

async function listExports() {
  const response = (await platformFetch('/exports')) as { items?: ExportItem[] }
  return response.items ?? []
}

export async function queryTasks(query: Query) {
  const status = getString(query.status)
  const taskType = getString(query.taskType)
  const items = await listTasks()

  return applyCollectionQuery<TaskItem>(items, {
    query,
    defaultSort: { field: 'title', order: 'asc' },
    filter: (item) => {
      if (status && item.status !== status) {
        return false
      }
      if (taskType && item.task_type !== taskType) {
        return false
      }
      return true
    },
    searchableText: (item) => `${item.task_id} ${item.title} ${item.status} ${item.task_type}`,
  })
}

export async function queryRuns(query: Query) {
  const status = getString(query.status)
  const items = await listRuns()

  return applyCollectionQuery<RunItem>(items, {
    query,
    defaultSort: { field: 'run_id', order: 'desc' },
    filter: (item) => {
      if (status && item.status !== status) {
        return false
      }
      return true
    },
    searchableText: (item) => `${item.run_id} ${item.job_name} ${item.status}`,
  })
}

export async function queryExports(query: Query) {
  const datasetId = getString(query.datasetId)
  const status = getString(query.status)
  const format = getString(query.format)
  const items = await listExports()

  return applyCollectionQuery<ExportItem>(items, {
    query,
    defaultSort: { field: 'export_id', order: 'desc' },
    filter: (item) => {
      if (datasetId && item.dataset_id !== datasetId) {
        return false
      }
      if (status && item.status !== status) {
        return false
      }
      if (format && item.format !== format) {
        return false
      }
      return true
    },
    searchableText: (item) => `${item.export_id} ${item.dataset_id} ${item.format} ${item.status}`,
  })
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}