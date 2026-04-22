import type { Context } from 'koa'

import { fetchToolHealth, fetchToolRegistry, fetchToolWorkspaceContext } from '../services/tools.js'

class ToolsHandler {
  async getRegistry(ctx: Context) {
    ctx.body = await fetchToolRegistry()
  }

  async getWorkspaceContext(ctx: Context) {
    const request = ctx.request as typeof ctx.request & { params: { toolId: string } }
    const actorHeader = ctx.get('x-actor-id')
    const requestId = typeof ctx.state.requestId === 'string' ? ctx.state.requestId : null
    ctx.body = await fetchToolWorkspaceContext(request.params.toolId, {
      requestId,
      actor: actorHeader || 'platform-operator',
    })
  }

  async getHealth(ctx: Context) {
    const request = ctx.request as typeof ctx.request & { params: { toolId: string } }
    ctx.body = await fetchToolHealth(request.params.toolId)
  }
}

export default new ToolsHandler()
