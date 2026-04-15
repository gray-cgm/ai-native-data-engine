import type { Context } from 'koa'

import { createDatasetExport } from '../engines/exportEngine.js'

class ExportHandler {
  async createDatasetExport(ctx: Context) {
    const request = ctx.request as typeof ctx.request & {
      params: { datasetId: string }
      body?: { format?: string }
    }
    const datasetId = request.params.datasetId
    const format = request.body?.format ?? 'lance'
    ctx.body = await createDatasetExport(datasetId, format)
  }
}

export default new ExportHandler()