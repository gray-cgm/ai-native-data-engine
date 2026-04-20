import requirementHandler from '../handlers/requirementHandler.js'
import { defineRoute } from './route-types.js'
import { buildListQuerySchema, buildOutputSchema, Joi } from './schema.js'

const requirementSchema = Joi.object({
  id: Joi.string().required(),
  title: Joi.string().required(),
  priority: Joi.string().required(),
  source: Joi.string().required(),
  status: Joi.string().required(),
  scene_tags: Joi.array().items(Joi.string()).allow(null),
  task_count: Joi.number().integer(),
}).unknown(true)

export default [
  defineRoute({
    method: 'get',
    path: '/requirements',
    validate: {
      query: buildListQuerySchema({
        status: Joi.string().optional(),
        priority: Joi.string().optional(),
        source: Joi.string().optional(),
        keyword: Joi.string().optional(),
      }),
      output: buildOutputSchema(Joi.object().unknown(true)),
    },
    meta: {
      swagger: {
        summary: 'List requirements',
        description: 'Paginated requirement list with filtering by status, priority, source, and keyword.',
        tags: ['requirements'],
      },
    },
    handler: requirementHandler.list,
  }),
  defineRoute({
    method: 'get',
    path: '/requirements/stats',
    validate: {
      output: buildOutputSchema(Joi.object().unknown(true)),
    },
    meta: {
      swagger: {
        summary: 'Requirement statistics',
        description: 'Aggregated counts by status, priority, and source.',
        tags: ['requirements'],
      },
    },
    handler: requirementHandler.stats,
  }),
  defineRoute({
    method: 'get',
    path: '/requirements/:id',
    validate: {
      params: {
        id: Joi.string().required(),
      },
      output: buildOutputSchema(Joi.object().unknown(true)),
    },
    meta: {
      swagger: {
        summary: 'Get requirement detail',
        description: 'Requirement detail with associated data tasks.',
        tags: ['requirements'],
      },
    },
    handler: requirementHandler.get,
  }),
  defineRoute({
    method: 'post',
    path: '/requirements',
    validate: {
      type: 'json',
      body: Joi.object({
        title: Joi.string().required(),
        source: Joi.string().required(),
        dre_owner: Joi.string().required(),
        priority: Joi.string().optional(),
        description: Joi.string().optional().allow('', null),
        target_scene: Joi.string().optional().allow('', null),
        scene_tags: Joi.array().items(Joi.string()).optional(),
        vehicle_tags: Joi.array().items(Joi.string()).optional(),
        estimated_data_volume: Joi.number().integer().optional(),
        due_date: Joi.string().optional().allow(null),
        feishu_doc_id: Joi.string().optional().allow('', null),
      }).required(),
      output: buildOutputSchema(requirementSchema),
    },
    meta: {
      swagger: {
        summary: 'Create requirement',
        description: 'Submit a new data-loop requirement.',
        tags: ['requirements'],
      },
    },
    handler: requirementHandler.create,
  }),
  defineRoute({
    method: 'patch',
    path: '/requirements/:id',
    validate: {
      params: {
        id: Joi.string().required(),
      },
      type: 'json',
      body: Joi.object({
        title: Joi.string().optional(),
        description: Joi.string().optional().allow('', null),
        priority: Joi.string().optional(),
        status: Joi.string().optional(),
        target_scene: Joi.string().optional().allow('', null),
        scene_tags: Joi.array().items(Joi.string()).optional(),
        vehicle_tags: Joi.array().items(Joi.string()).optional(),
        estimated_data_volume: Joi.number().integer().optional(),
        due_date: Joi.string().optional().allow(null),
        feishu_doc_id: Joi.string().optional().allow('', null),
      }).required(),
      output: buildOutputSchema(requirementSchema),
    },
    meta: {
      swagger: {
        summary: 'Update requirement',
        description: 'Partial update of an existing requirement.',
        tags: ['requirements'],
      },
    },
    handler: requirementHandler.update,
  }),
  defineRoute({
    method: 'post',
    path: '/requirements/:id/tasks',
    validate: {
      params: {
        id: Joi.string().required(),
      },
      type: 'json',
      body: Joi.object({
        title: Joi.string().required(),
        task_type: Joi.string().required(),
        description: Joi.string().optional().allow('', null),
        assigned_to: Joi.string().optional().allow('', null),
        target_count: Joi.number().integer().optional(),
        due_date: Joi.string().optional().allow(null),
      }).required(),
      output: buildOutputSchema(Joi.object().unknown(true)),
    },
    meta: {
      swagger: {
        summary: 'Create data task',
        description: 'Create a data task under a requirement.',
        tags: ['requirements'],
      },
    },
    handler: requirementHandler.createTask,
  }),
  defineRoute({
    method: 'patch',
    path: '/data-tasks/:id',
    validate: {
      params: {
        id: Joi.string().required(),
      },
      type: 'json',
      body: Joi.object({
        title: Joi.string().optional(),
        description: Joi.string().optional().allow('', null),
        status: Joi.string().optional(),
        assigned_to: Joi.string().optional().allow('', null),
        target_count: Joi.number().integer().optional(),
        actual_count: Joi.number().integer().optional(),
        due_date: Joi.string().optional().allow(null),
      }).required(),
      output: buildOutputSchema(Joi.object().unknown(true)),
    },
    meta: {
      swagger: {
        summary: 'Update data task',
        description: 'Partial update of an existing data task.',
        tags: ['requirements'],
      },
    },
    handler: requirementHandler.updateTask,
  }),
  defineRoute({
    method: 'post',
    path: '/data-tasks/:id/sign-off',
    validate: {
      params: {
        id: Joi.string().required(),
      },
      type: 'json',
      body: Joi.object({
        approved: Joi.boolean().required(),
        sign_off_by: Joi.string().required(),
        comment: Joi.string().optional().allow('', null),
      }).required(),
      output: buildOutputSchema(Joi.object().unknown(true)),
    },
    meta: {
      swagger: {
        summary: 'Sign off data task',
        description: 'Approve or reject a data task.',
        tags: ['requirements'],
      },
    },
    handler: requirementHandler.signOffTask,
  }),
]
