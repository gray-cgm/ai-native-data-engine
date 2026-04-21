import type { Context } from 'koa'

import { getStreamingSummary, triggerStreamingBootstrap } from '../engines/streamingEngine.js'

class StreamingHandler {
  async create(ctx: Context) {
    ctx.body = await triggerStreamingBootstrap()
  }

  async getSummary(ctx: Context) {
    ctx.body = await getStreamingSummary()
  }
}

export default new StreamingHandler()