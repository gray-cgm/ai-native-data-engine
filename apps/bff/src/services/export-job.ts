import { platformFetch } from './platform.js'

export async function requestDatasetExport(datasetId: string, format: string) {
  return platformFetch(
    `/api/v1/exports/datasets/${encodeURIComponent(datasetId)}?format=${encodeURIComponent(format)}`,
    { method: 'POST' },
  )
}