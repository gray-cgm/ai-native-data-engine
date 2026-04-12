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

const route: Route = {
  method: 'post',
  path: '/datasets/:datasetId/exports',
  validate: {
    params: {
      datasetId: Joi.string().required(),
    },
    type: 'json',
    body: {
      format: Joi.string().valid('parquet', 'csv', 'jsonl').optional(),
    },
  },
  handler: async (ctx: Context) => {
    const request = ctx.request as typeof ctx.request & {
      params: { datasetId: string }
      body?: { format?: string }
    }
    const datasetId = request.params.datasetId
    const requestBody = request.body ?? {}
    const format = requestBody.format ?? 'parquet'
    ctx.body = await platformFetch(`/exports/dataset/${datasetId}?format=${encodeURIComponent(format)}`, {
      method: 'POST',
    })
  },
}

export default route
