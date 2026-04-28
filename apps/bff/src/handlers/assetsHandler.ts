import type { Context } from 'koa'

import { createAsset, getAsset, listAssets } from '../engines/assetsEngine.js'

class AssetsHandler {
  async list(ctx: Context) {
    ctx.body = await listAssets(ctx.request.query as Record<string, unknown>)
  }

  async create(ctx: Context) {
    ctx.body = await createAsset(ctx.request.body)
  }

  async detail(ctx: Context) {
    const request = ctx.request as typeof ctx.request & { params: { assetId: string } }
    ctx.body = await getAsset(request.params.assetId)
  }
}

export default new AssetsHandler()
