import type { Context } from 'koa'
import { platformFetch } from '../services/platform.js'

const API_PREFIX = '/api/v1'

type WithParams<P> = Context['request'] & { params: P }

class DataTasksHandler {
  async get(ctx: Context) {
    const req = ctx.request as WithParams<{ id: string }>
    ctx.body = await platformFetch(`${API_PREFIX}/data-tasks/${encodeURIComponent(req.params.id)}`)
  }

  async listOperationsTasks(ctx: Context) {
    const query = ctx.request.query as Record<string, string>
    const usp = new URLSearchParams()
    for (const key of ['data_task_id', 'requirement_id', 'module', 'status']) {
      const v = query[key]
      if (typeof v === 'string' && v.length > 0) usp.set(key, v)
    }
    const tail = usp.toString()
    const items = await platformFetch(`${API_PREFIX}/operations-tasks${tail ? `?${tail}` : ''}`)
    ctx.body = { items }
  }
}

export default new DataTasksHandler()
