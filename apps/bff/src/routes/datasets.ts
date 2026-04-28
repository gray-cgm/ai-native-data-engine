import datasetsHandler from '../handlers/datasetsHandler.js'
import { defineRoute } from './route-types.js'
import { buildOutputSchema, Joi } from './schema.js'

const unknownObject = Joi.object().unknown(true)

export default [
  defineRoute({
    method: 'get',
    path: '/datasets',
    validate: {
      query: Joi.object({
        status: Joi.string().optional(),
        dataset_type: Joi.string().optional(),
        requirement_id: Joi.string().optional(),
        limit: Joi.number().integer().min(1).max(500).optional(),
      }).unknown(true),
      output: buildOutputSchema(unknownObject),
    },
    meta: {
      swagger: {
        summary: 'List datasets (v2)',
        description: 'Proxy /api/v1/datasets — Dataset 主表（v2）。',
        tags: ['datasets'],
      },
    },
    handler: datasetsHandler.list,
  }),
  defineRoute({
    method: 'post',
    path: '/datasets',
    validate: {
      type: 'json',
      body: unknownObject,
      output: buildOutputSchema(unknownObject),
    },
    meta: {
      swagger: {
        summary: 'Create dataset',
        description: '创建 official / customized 数据集。',
        tags: ['datasets'],
      },
    },
    handler: datasetsHandler.create,
  }),
  defineRoute({
    method: 'get',
    path: '/datasets/:datasetId',
    validate: {
      params: { datasetId: Joi.string().required() },
      output: buildOutputSchema(unknownObject),
    },
    handler: datasetsHandler.detail,
  }),
  defineRoute({
    method: 'get',
    path: '/datasets/:datasetId/samples',
    validate: {
      params: { datasetId: Joi.string().required() },
      query: Joi.object({
        clip_id: Joi.string().optional(),
        training_type: Joi.string().optional(),
        limit: Joi.number().integer().min(1).max(2000).optional(),
        offset: Joi.number().integer().min(0).optional(),
      }).unknown(true),
      output: buildOutputSchema(unknownObject),
    },
    handler: datasetsHandler.listSamples,
  }),
  defineRoute({
    method: 'post',
    path: '/datasets/:datasetId/cut',
    validate: {
      type: 'json',
      params: { datasetId: Joi.string().required() },
      body: Joi.object({
        clip_id: Joi.string().required(),
        ts_start: Joi.number().integer().required(),
        ts_end: Joi.number().integer().required(),
        ts_center: Joi.number().integer().optional(),
        range_l: Joi.number().integer().optional(),
        range_r: Joi.number().integer().optional(),
        requirement_id: Joi.string().optional(),
        operations_task_id: Joi.string().optional(),
        x_trace_id: Joi.string().optional(),
        note: Joi.string().optional(),
      }).unknown(true),
      output: buildOutputSchema(unknownObject),
    },
    meta: {
      swagger: {
        summary: 'Flexible cut',
        description: 'Explorer 灵活切割：选定 [ts_start, ts_end] 写入 sample + LineageEvent。',
        tags: ['datasets'],
      },
    },
    handler: datasetsHandler.cut,
  }),
  defineRoute({
    method: 'post',
    path: '/datasets/:datasetId/samples',
    validate: {
      type: 'json',
      params: { datasetId: Joi.string().required() },
      body: unknownObject,
      output: buildOutputSchema(unknownObject),
    },
    handler: datasetsHandler.addSamples,
  }),
  defineRoute({
    method: 'post',
    path: '/datasets/:datasetId/promote',
    validate: {
      type: 'json',
      params: { datasetId: Joi.string().required() },
      body: Joi.object({
        name: Joi.string().optional(),
        tag_expr: Joi.string().optional(),
        allow_train: Joi.boolean().optional(),
        requirement_id: Joi.string().optional(),
        ops_item_id: Joi.string().optional(),
        x_trace_id: Joi.string().optional(),
        pipeline_run_id: Joi.string().optional(),
        created_by: Joi.string().optional(),
      }).unknown(true),
      output: buildOutputSchema(unknownObject),
    },
    meta: {
      swagger: {
        summary: 'Promote customized → official',
        description:
          'Operations · Release：把一个 customized 数据集提级为 official，复制 samples，写 LineageEvent(release)。',
        tags: ['datasets'],
      },
    },
    handler: datasetsHandler.promote,
  }),
]
