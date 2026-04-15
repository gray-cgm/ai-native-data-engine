import type { Context } from 'koa'

import { queryExports, queryRuns, queryTasks } from '../engines/operationsEngine.js'

class OperationsHandler {
  async listTasks(ctx: Context) {
    ctx.body = await queryTasks(ctx.request.query as Record<string, unknown>)
  }

  async listRuns(ctx: Context) {
    ctx.body = await queryRuns(ctx.request.query as Record<string, unknown>)
  }

  async listExports(ctx: Context) {
    ctx.body = await queryExports(ctx.request.query as Record<string, unknown>)
  }
}

export default new OperationsHandler()