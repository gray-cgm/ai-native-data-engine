import type { Context } from 'koa'

import {
  addSamples,
  createDataset,
  cutClip,
  getDataset,
  listDatasets,
  listSamples,
  promoteDataset,
} from '../engines/datasetsEngine.js'

class DatasetsHandler {
  async list(ctx: Context) {
    ctx.body = await listDatasets(ctx.request.query as Record<string, unknown>)
  }

  async create(ctx: Context) {
    ctx.body = await createDataset(ctx.request.body)
  }

  async detail(ctx: Context) {
    const request = ctx.request as typeof ctx.request & { params: { datasetId: string } }
    ctx.body = await getDataset(request.params.datasetId)
  }

  async listSamples(ctx: Context) {
    const request = ctx.request as typeof ctx.request & { params: { datasetId: string } }
    ctx.body = await listSamples(request.params.datasetId, ctx.request.query as Record<string, unknown>)
  }

  async cut(ctx: Context) {
    const request = ctx.request as typeof ctx.request & { params: { datasetId: string } }
    const traceHeader = ctx.request.header['x-trace-id']
    const headers: Record<string, string> = {}
    if (typeof traceHeader === 'string') headers['X-Trace-Id'] = traceHeader
    ctx.body = await cutClip(request.params.datasetId, ctx.request.body, headers)
  }

  async addSamples(ctx: Context) {
    const request = ctx.request as typeof ctx.request & { params: { datasetId: string } }
    ctx.body = await addSamples(request.params.datasetId, ctx.request.body)
  }

  async promote(ctx: Context) {
    const request = ctx.request as typeof ctx.request & { params: { datasetId: string } }
    const traceHeader = ctx.request.header['x-trace-id']
    const headers: Record<string, string> = {}
    if (typeof traceHeader === 'string') headers['X-Trace-Id'] = traceHeader
    ctx.body = await promoteDataset(request.params.datasetId, ctx.request.body, headers)
  }
}

export default new DatasetsHandler()
