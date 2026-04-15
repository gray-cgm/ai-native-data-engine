import operationsHandler from '../handlers/operationsHandler.js'
import { defineRoute } from './route-types.js'
import { exportSchema, runSchema, taskSchema } from './resource-schemas.js'
import { buildListQuerySchema, buildOutputSchema, buildPaginatedListSchema, Joi } from './schema.js'

export default [
  defineRoute({
    method: 'get',
    path: '/tasks',
    validate: {
      query: buildListQuerySchema({
        status: Joi.string().optional(),
        taskType: Joi.string().optional(),
      }),
      output: buildOutputSchema(buildPaginatedListSchema(taskSchema)),
    },
    meta: {
      swagger: {
        summary: 'List tasks',
        description: 'Task management list endpoint with local filtering, search and pagination.',
        tags: ['operations'],
      },
    },
    handler: operationsHandler.listTasks,
  }),
  defineRoute({
    method: 'get',
    path: '/runs',
    validate: {
      query: buildListQuerySchema({
        status: Joi.string().optional(),
      }),
      output: buildOutputSchema(buildPaginatedListSchema(runSchema)),
    },
    meta: {
      swagger: {
        summary: 'List runs',
        description: 'Run management list endpoint with local filtering, search and pagination.',
        tags: ['operations'],
      },
    },
    handler: operationsHandler.listRuns,
  }),
  defineRoute({
    method: 'get',
    path: '/exports',
    validate: {
      query: buildListQuerySchema({
        datasetId: Joi.string().optional(),
        status: Joi.string().optional(),
        format: Joi.string().optional(),
      }),
      output: buildOutputSchema(buildPaginatedListSchema(exportSchema)),
    },
    meta: {
      swagger: {
        summary: 'List exports',
        description: 'Export job management list endpoint with local filtering, search and pagination.',
        tags: ['operations'],
      },
    },
    handler: operationsHandler.listExports,
  }),
]