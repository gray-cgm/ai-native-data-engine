import type { Context } from 'koa'

import { triggerDemoBootstrap } from '../engines/bootstrapEngine.js'

class BootstrapHandler {
  async create(ctx: Context) {
    ctx.body = await triggerDemoBootstrap()
  }
}

export default new BootstrapHandler()