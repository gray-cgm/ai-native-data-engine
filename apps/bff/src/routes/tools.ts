import toolsHandler from '../handlers/toolsHandler.js'
import { defineRoute } from './route-types.js'
import { buildOutputSchema, Joi } from './schema.js'

const unknownObject = Joi.object().unknown(true)

export default [
  defineRoute({
    method: 'get',
    path: '/tools/registry',
    validate: {
      output: buildOutputSchema(unknownObject),
    },
    meta: {
      swagger: {
        summary: 'List tool registry',
        description: 'Return integrated tools with gateway metadata and integration mode.',
        tags: ['tools'],
      },
    },
    handler: toolsHandler.getRegistry,
  }),
  defineRoute({
    method: 'get',
    path: '/tools/:toolId/workspace-context',
    validate: {
      params: {
        toolId: Joi.string().required(),
      },
      output: buildOutputSchema(unknownObject),
    },
    meta: {
      swagger: {
        summary: 'Get tool workspace context',
        description: 'Return workspace-scoped context for a tool workspace page.',
        tags: ['tools'],
      },
    },
    handler: toolsHandler.getWorkspaceContext,
  }),
  defineRoute({
    method: 'get',
    path: '/tools/:toolId/health',
    validate: {
      params: {
        toolId: Joi.string().required(),
      },
      output: buildOutputSchema(unknownObject),
    },
    meta: {
      swagger: {
        summary: 'Get tool runtime health',
        description: 'Probe tool health endpoint and return normalized health status.',
        tags: ['tools'],
      },
    },
    handler: toolsHandler.getHealth,
  }),
]
