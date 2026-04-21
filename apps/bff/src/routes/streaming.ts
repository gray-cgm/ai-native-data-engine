import streamingHandler from '../handlers/streamingHandler.js'
import { defineRoute } from './route-types.js'
import { buildOutputSchema } from './schema.js'

const bootstrapRoute = defineRoute({
  method: 'post',
  path: '/streaming/bootstrap',
  validate: {
    output: buildOutputSchema(),
  },
  meta: {
    swagger: {
      summary: 'Bootstrap local streaming demo',
      description: 'Trigger the local-first streaming demo in Platform API.',
      tags: ['streaming'],
    },
  },
  handler: streamingHandler.create,
})

const summaryRoute = defineRoute({
  method: 'get',
  path: '/streaming/summary',
  validate: {
    output: buildOutputSchema(),
  },
  meta: {
    swagger: {
      summary: 'Get streaming pipeline summary',
      description: 'Returns event counts, batch summaries, and scene distribution for the local streaming pipeline.',
      tags: ['streaming'],
    },
  },
  handler: streamingHandler.getSummary,
})

export default [bootstrapRoute, summaryRoute]