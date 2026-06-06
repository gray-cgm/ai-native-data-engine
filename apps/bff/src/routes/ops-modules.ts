import opsModulesHandler from '../handlers/opsModulesHandler.js'
import { defineRoute } from './route-types.js'
import { buildListQuerySchema, buildOutputSchema, Joi } from './schema.js'

const unknownObject = Joi.object().unknown(true)

const MODULE_PARAM = Joi.string().valid(
  'labeling',
  'tagging',
  'checking',
  'mining',
  'privacy',
  'release',
)

export default [
  defineRoute({
    method: 'get',
    path: '/ops/overview',
    validate: { output: buildOutputSchema(unknownObject) },
    meta: {
      swagger: {
        summary: 'Aggregate counters across all ops modules',
        tags: ['ops'],
      },
    },
    handler: opsModulesHandler.overview,
  }),
  // labeling 标注保存闭环 —— 必须排在 /ops/:module/:id 之前，
  // 否则 /ops/labeling/annotations 会被当成 module=labeling&id=annotations。
  defineRoute({
    method: 'post',
    path: '/ops/labeling/annotations',
    validate: {
      type: 'json',
      body: unknownObject,
      output: buildOutputSchema(unknownObject),
    },
    meta: { swagger: { summary: 'Save labeling annotations (cornerstone)', tags: ['ops'] } },
    handler: opsModulesHandler.saveAnnotations,
  }),
  defineRoute({
    method: 'get',
    path: '/ops/labeling/annotations',
    validate: {
      query: Joi.object({
        clip_id: Joi.string().required(),
        x_trace_id: Joi.string().optional(),
      }),
      output: buildOutputSchema(unknownObject),
    },
    meta: { swagger: { summary: 'Load latest labeling annotations for a clip', tags: ['ops'] } },
    handler: opsModulesHandler.loadAnnotations,
  }),
  defineRoute({
    method: 'get',
    path: '/ops/:module/vocab',
    validate: {
      params: { module: MODULE_PARAM.required() },
      output: buildOutputSchema(unknownObject),
    },
    meta: { swagger: { summary: 'Return status/kind vocab for a module', tags: ['ops'] } },
    handler: opsModulesHandler.vocab,
  }),
  defineRoute({
    method: 'get',
    path: '/ops/:module/stats',
    validate: {
      params: { module: MODULE_PARAM.required() },
      output: buildOutputSchema(unknownObject),
    },
    meta: { swagger: { summary: 'Status counters for a module', tags: ['ops'] } },
    handler: opsModulesHandler.stats,
  }),
  defineRoute({
    method: 'get',
    path: '/ops/:module',
    validate: {
      params: { module: MODULE_PARAM.required() },
      query: buildListQuerySchema({
        status: Joi.string().optional(),
        kind: Joi.string().optional(),
        datasetId: Joi.string().optional(),
        scenario: Joi.string().optional(),
        requirementId: Joi.string().optional(),
      }),
      output: buildOutputSchema(unknownObject),
    },
    meta: { swagger: { summary: 'List items for an ops module', tags: ['ops'] } },
    handler: opsModulesHandler.list,
  }),
  defineRoute({
    method: 'post',
    path: '/ops/:module',
    validate: {
      params: { module: MODULE_PARAM.required() },
      type: 'json',
      body: unknownObject,
      output: buildOutputSchema(unknownObject),
    },
    meta: { swagger: { summary: 'Create an ops item', tags: ['ops'] } },
    handler: opsModulesHandler.create,
  }),
  defineRoute({
    method: 'get',
    path: '/ops/:module/:id',
    validate: {
      params: { module: MODULE_PARAM.required(), id: Joi.string().required() },
      output: buildOutputSchema(unknownObject),
    },
    meta: { swagger: { summary: 'Get an ops item', tags: ['ops'] } },
    handler: opsModulesHandler.detail,
  }),
  defineRoute({
    method: 'patch',
    path: '/ops/:module/:id',
    validate: {
      params: { module: MODULE_PARAM.required(), id: Joi.string().required() },
      type: 'json',
      body: unknownObject,
      output: buildOutputSchema(unknownObject),
    },
    meta: { swagger: { summary: 'Patch an ops item', tags: ['ops'] } },
    handler: opsModulesHandler.patch,
  }),
  defineRoute({
    method: 'delete',
    path: '/ops/:module/:id',
    validate: {
      params: { module: MODULE_PARAM.required(), id: Joi.string().required() },
      output: buildOutputSchema(unknownObject),
    },
    meta: { swagger: { summary: 'Delete an ops item', tags: ['ops'] } },
    handler: opsModulesHandler.remove,
  }),
]
