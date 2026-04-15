import dashboardHandler from '../handlers/dashboardHandler.js'
import { defineRoute } from './route-types.js'
import { buildOutputSchema, Joi } from './schema.js'

const route = defineRoute({
  method: 'get',
  path: '/dashboard',
  validate: {
    output: buildOutputSchema(Joi.object().unknown(true)),
  },
  meta: {
    swagger: {
      summary: 'Dashboard aggregate payload',
      description: 'Aggregate datasets, tasks, exports, runs and sample previews for the web dashboard.',
      tags: ['dashboard'],
    },
  },
  handler: dashboardHandler.get,
})

export default route
