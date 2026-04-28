import eventsHandler from '../handlers/eventsHandler.js'
import { defineRoute } from './route-types.js'
import { buildOutputSchema, Joi } from './schema.js'

const unknownObject = Joi.object().unknown(true)

export default [
  defineRoute({
    method: 'get',
    path: '/events',
    validate: {
      query: Joi.object({
        event_type: Joi.string().optional(),
        requirement_id: Joi.string().optional(),
        x_trace_id: Joi.string().optional(),
        operations_task_id: Joi.string().optional(),
        limit: Joi.number().integer().min(1).max(500).optional(),
      }).unknown(true),
      output: buildOutputSchema(unknownObject),
    },
    meta: {
      swagger: {
        summary: 'List lineage events',
        description: 'Snowflake 中心 LineageEvent 列表。',
        tags: ['events'],
      },
    },
    handler: eventsHandler.list,
  }),
  defineRoute({
    method: 'post',
    path: '/events',
    validate: {
      type: 'json',
      body: unknownObject,
      output: buildOutputSchema(unknownObject),
    },
    handler: eventsHandler.create,
  }),
  defineRoute({
    method: 'get',
    path: '/events/dimensions/:dimension',
    validate: {
      params: {
        dimension: Joi.string().valid('tagging', 'labeling', 'checking', 'mining').required(),
      },
      query: Joi.object({
        requirement_id: Joi.string().optional(),
        x_trace_id: Joi.string().optional(),
        clip_id: Joi.string().optional(),
        limit: Joi.number().integer().min(1).max(500).optional(),
      }).unknown(true),
      output: buildOutputSchema(unknownObject),
    },
    meta: {
      swagger: {
        summary: 'Snowflake dimension view',
        description: '4 个维度：tagging / labeling / checking / mining。',
        tags: ['events'],
      },
    },
    handler: eventsHandler.dimension,
  }),
  defineRoute({
    method: 'get',
    path: '/events/:eventPk',
    validate: {
      params: { eventPk: Joi.string().required() },
      output: buildOutputSchema(unknownObject),
    },
    handler: eventsHandler.detail,
  }),
]
