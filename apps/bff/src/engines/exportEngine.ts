import { requestDatasetExport } from '../services/export-job.js'

export async function createDatasetExport(datasetId: string, format: string) {
  return requestDatasetExport(datasetId, format)
}