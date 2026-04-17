import streamingHandler from '../handlers/streamingHandler.js'
import { defineRoute } from './route-types.js'
import { buildOutputSchema } from './schema.js'

const route = defineRoute({
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

export default route