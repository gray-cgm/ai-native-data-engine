import type { ExportItem, RunItem, TaskItem } from '../types.js'
import { platformFetch } from './platform.js'

export async function listTasks() {
  const response = (await platformFetch('/tasks')) as { items?: TaskItem[] }
  return response.items ?? []
}

export async function listRuns() {
  const response = (await platformFetch('/runs')) as { items?: RunItem[] }
  return response.items ?? []
}

export async function listExports() {
  const response = (await platformFetch('/exports')) as { items?: ExportItem[] }
  return response.items ?? []
}