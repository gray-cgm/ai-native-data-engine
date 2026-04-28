import type { Context } from 'koa'

import { queryWorkspaces } from '../engines/catalogEngine.js'

class CatalogHandler {
  async listWorkspaces(ctx: Context) {
    ctx.body = await queryWorkspaces(ctx.request.query as Record<string, unknown>)
  }
}

export default new CatalogHandler()
