import type { Context } from 'koa'

import {
  createEvent,
  getDimension,
  getEvent,
  listEvents,
} from '../engines/eventsEngine.js'

class EventsHandler {
  async list(ctx: Context) {
    ctx.body = await listEvents(ctx.request.query as Record<string, unknown>)
  }

  async create(ctx: Context) {
    ctx.body = await createEvent(ctx.request.body)
  }

  async detail(ctx: Context) {
    const request = ctx.request as typeof ctx.request & { params: { eventPk: string } }
    ctx.body = await getEvent(request.params.eventPk)
  }

  async dimension(ctx: Context) {
    const request = ctx.request as typeof ctx.request & { params: { dimension: string } }
    ctx.body = await getDimension(request.params.dimension, ctx.request.query as Record<string, unknown>)
  }
}

export default new EventsHandler()
