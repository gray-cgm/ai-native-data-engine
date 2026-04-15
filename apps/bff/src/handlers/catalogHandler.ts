import type { Context } from 'koa'

import {
  findDataset,
  queryDatasets,
  queryDatasetVersions,
  queryWorkspaces,
} from '../engines/catalogEngine.js'

class CatalogHandler {
  async listWorkspaces(ctx: Context) {
    ctx.body = await queryWorkspaces(ctx.request.query as Record<string, unknown>)
  }

  async listDatasets(ctx: Context) {
    ctx.body = await queryDatasets(ctx.request.query as Record<string, unknown>)
  }

  async getDataset(ctx: Context) {
    const request = ctx.request as typeof ctx.request & { params: { datasetId: string } }
    const params = request.params
    ctx.body = await findDataset(params.datasetId)
  }

  async listDatasetVersions(ctx: Context) {
    const request = ctx.request as typeof ctx.request & { params: { datasetId: string } }
    const params = request.params
    ctx.body = await queryDatasetVersions(params.datasetId, ctx.request.query as Record<string, unknown>)
  }
}

export default new CatalogHandler()