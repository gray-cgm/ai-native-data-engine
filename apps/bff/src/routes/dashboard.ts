import type { Context } from 'koa'
import type { Route } from 'koa-joi-router'

import { buildDashboardPayload } from '../services/dashboard.js'

const route: Route = {
  method: 'get',
  path: '/dashboard',
  handler: async (ctx: Context) => {
    ctx.body = await buildDashboardPayload()
  },
}

export default route
