import type { Context } from 'koa'
import type { Route } from 'koa-joi-router'

import { platformFetch } from '../services/platform.js'

const route: Route = {
  method: 'post',
  path: '/bootstrap',
  handler: async (ctx: Context) => {
    ctx.body = await platformFetch('/samples/ingest-demo', { method: 'POST' })
  },
}

export default route
