import dataTasksHandler from '../handlers/dataTasksHandler.js'
import { defineRoute } from './route-types.js'
import { buildOutputSchema, Joi } from './schema.js'

export default [
  defineRoute({
    method: 'get',
    path: '/data-tasks/:id',
    validate: {
      params: { id: Joi.string().required() },
      output: buildOutputSchema(Joi.object().unknown(true)),
    },
    meta: {
      swagger: {
        summary: 'Data task detail',
        description: 'Get a single data task by id.',
        tags: ['data-tasks'],
      },
    },
    handler: dataTasksHandler.get,
  }),
  defineRoute({
    method: 'get',
    path: '/operations-tasks',
    validate: {
      query: {
        data_task_id: Joi.string().optional(),
        requirement_id: Joi.string().optional(),
        module: Joi.string().optional(),
        status: Joi.string().optional(),
      },
      output: buildOutputSchema(Joi.object().unknown(true)),
    },
    meta: {
      swagger: {
        summary: 'List operations tasks',
        description: 'List OperationsTask entries, optionally filtered by data_task_id / requirement_id.',
        tags: ['data-tasks'],
      },
    },
    handler: dataTasksHandler.listOperationsTasks,
  }),
]
