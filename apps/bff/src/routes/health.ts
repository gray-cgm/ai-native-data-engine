import type { Context } from 'koa'
import type { Route } from 'koa-joi-router'

import { config } from '../config/index.js'

const route: Route = {
  method: 'get',
  path: '/health',
  handler: async (ctx: Context) => {
    ctx.body = {
      status: 'ok',
      service: 'bff',
      upstream: config.platformApiBaseUrl,
    }
  },
}

export default route
