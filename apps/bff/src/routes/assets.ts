import assetsHandler from '../handlers/assetsHandler.js'
import { defineRoute } from './route-types.js'
import { buildOutputSchema, Joi } from './schema.js'

const unknownObject = Joi.object().unknown(true)

export default [
  defineRoute({
    method: 'get',
    path: '/assets',
    validate: {
      query: Joi.object({
        asset_kind: Joi.string().valid('raw', 'derived').optional(),
        clip_id: Joi.string().optional(),
        requirement_id: Joi.string().optional(),
        x_trace_id: Joi.string().optional(),
        producer_pipeline_run_id: Joi.string().optional(),
        producer_event_id: Joi.string().optional(),
        limit: Joi.number().integer().min(1).max(1000).optional(),
      }).unknown(true),
      output: buildOutputSchema(unknownObject),
    },
    meta: {
      swagger: {
        summary: 'List assets',
        description: 'Asset 取代 ingest/curate/publish：raw 与 derived 数据资产统一登记。',
        tags: ['assets'],
      },
    },
    handler: assetsHandler.list,
  }),
  defineRoute({
    method: 'post',
    path: '/assets',
    validate: {
      type: 'json',
      body: unknownObject,
      output: buildOutputSchema(unknownObject),
    },
    handler: assetsHandler.create,
  }),
  defineRoute({
    method: 'get',
    path: '/assets/:assetId',
    validate: {
      params: { assetId: Joi.string().required() },
      output: buildOutputSchema(unknownObject),
    },
    handler: assetsHandler.detail,
  }),
]
