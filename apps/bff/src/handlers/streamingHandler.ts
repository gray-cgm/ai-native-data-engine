import type { Context } from 'koa'

import { triggerStreamingBootstrap } from '../engines/streamingEngine.js'

class StreamingHandler {
  async create(ctx: Context) {
    ctx.body = await triggerStreamingBootstrap()
  }
}

export default new StreamingHandler()