import { config } from '../config/index.js'
import { defineRoute } from './route-types.js'
import { buildOutputSchema, Joi } from './schema.js'

const route = defineRoute({
  method: 'get',
  path: '/health',
  validate: {
    output: buildOutputSchema(
      Joi.object({
        status: Joi.string().required(),
        service: Joi.string().required(),
        upstream: Joi.string().required(),
      }),
    ),
  },
  meta: {
    swagger: {
      summary: 'BFF health status',
      tags: ['system'],
    },
  },
  handler: async (ctx) => {
    ctx.state.skipResponseEnvelope = true
    ctx.body = {
      status: 'ok',
      service: 'bff',
      upstream: config.platformApiBaseUrl,
    }
  },
})

export default route
