import { platformFetch } from './platform.js'

export async function requestDatasetExport(datasetId: string, format: string) {
  return platformFetch(`/exports/dataset/${datasetId}?format=${encodeURIComponent(format)}`, {
    method: 'POST',
  })
}