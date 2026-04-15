import type { Context } from 'koa'
import JoiRouter from 'koa-joi-router'
import type { Route } from 'koa-joi-router'

import { platformFetch } from '../services/platform.js'

const { Joi } = JoiRouter as typeof JoiRouter & {
  Joi: {
    string(): {
      required(): unknown
      valid(...values: string[]): { optional(): unknown }
      optional(): unknown
    }
  }
}

const ALLOWED_EXPORT_FORMATS = new Set(['lance', 'csv', 'jsonl'])

const route: Route = {
  method: 'post',
  path: '/datasets/:datasetId/exports',
  validate: {
    params: {
      datasetId: Joi.string().required(),
    },
  },
  handler: async (ctx: Context) => {
    const request = ctx.request as typeof ctx.request & {
      params: { datasetId: string }
      body?: unknown
    }
    const datasetId = request.params.datasetId
    const requestBody = request.body && typeof request.body === 'object' ? request.body as { format?: unknown } : {}
    const format = requestBody.format ?? 'lance'
    if (typeof format !== 'string' || !ALLOWED_EXPORT_FORMATS.has(format)) {
      ctx.status = 400
      ctx.body = { error: { message: 'invalid export format' } }
      return
    }
    ctx.body = await platformFetch(`/exports/dataset/${datasetId}?format=${encodeURIComponent(format)}`, {
      method: 'POST',
    })
  },
}

export default route
