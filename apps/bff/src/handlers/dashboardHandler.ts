import type { Context } from 'koa'

import { getDashboardPayload } from '../engines/dashboardEngine.js'

class DashboardHandler {
  async get(ctx: Context) {
    ctx.body = await getDashboardPayload()
  }
}

export default new DashboardHandler()