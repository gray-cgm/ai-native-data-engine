import pipelinesHandler from '../handlers/pipelinesHandler.js'
import { defineRoute } from './route-types.js'
import { buildOutputSchema, Joi } from './schema.js'

const runQuerySchema = {
  requirement_id: Joi.string().optional(),
  data_task_id: Joi.string().optional(),
  operations_task_id: Joi.string().optional(),
  x_trace_id: Joi.string().optional(),
  stage: Joi.string().optional(),
  status: Joi.string().optional(),
  trigger_source: Joi.string().optional(),
  run_purpose: Joi.string().optional(),
  page: Joi.string().optional(),
  page_size: Joi.string().optional(),
}

export default [
  defineRoute({
    method: 'get',
    path: '/pipelines/runs',
    validate: {
      query: runQuerySchema,
      output: buildOutputSchema(Joi.object().unknown(true)),
    },
    meta: {
      swagger: {
        summary: 'List pipeline runs',
        description: 'Full-chain pipeline runs with x_trace_id / requirement / ops-task filters.',
        tags: ['pipelines'],
      },
    },
    handler: pipelinesHandler.listRuns,
  }),
  defineRoute({
    method: 'get',
    path: '/pipelines/stage-stats',
    validate: {
      output: buildOutputSchema(Joi.object().unknown(true)),
    },
    meta: {
      swagger: {
        summary: 'Pipeline stage statistics',
        description: 'Stage × status counts aggregated across all pipeline runs.',
        tags: ['pipelines'],
      },
    },
    handler: pipelinesHandler.stageStats,
  }),
  defineRoute({
    method: 'get',
    path: '/pipelines/quality-stats',
    validate: {
      output: buildOutputSchema(Joi.object().unknown(true)),
    },
    meta: {
      swagger: {
        summary: 'Pipeline quality statistics',
        description: 'Gate result counts, failure reason top-N, breakdown by run_purpose & stage.',
        tags: ['pipelines'],
      },
    },
    handler: pipelinesHandler.qualityStats,
  }),
  defineRoute({
    method: 'get',
    path: '/pipelines/cost-stats',
    validate: {
      output: buildOutputSchema(Joi.object().unknown(true)),
    },
    meta: {
      swagger: {
        summary: 'Pipeline cost statistics',
        description: 'Cost attribution by requirement / pipeline / stage / run_purpose.',
        tags: ['pipelines'],
      },
    },
    handler: pipelinesHandler.costStats,
  }),
  defineRoute({
    method: 'get',
    path: '/pipelines/traces',
    validate: {
      query: { limit: Joi.string().optional() },
      output: buildOutputSchema(Joi.object().unknown(true)),
    },
    meta: {
      swagger: {
        summary: 'Recent x_trace_ids',
        description: 'Recent trace IDs for Lineage view selector.',
        tags: ['pipelines'],
      },
    },
    handler: pipelinesHandler.listTraces,
  }),
  defineRoute({
    method: 'get',
    path: '/pipelines/streaming-health',
    validate: {
      output: buildOutputSchema(Joi.object().unknown(true)),
    },
    meta: {
      swagger: {
        summary: 'Streaming pipeline health',
        description:
          'Aggregate streaming health for the Pipelines Overview tab: kafka-ui /actuator/health probe + Platform API /streaming/health (broker info, consumer lag, StreamingSummary).',
        tags: ['pipelines'],
      },
    },
    handler: pipelinesHandler.streamingHealth,
  }),
  defineRoute({
    method: 'get',
    path: '/pipelines/runs/:id',
    validate: {
      params: { id: Joi.string().required() },
      output: buildOutputSchema(Joi.object().unknown(true)),
    },
    meta: {
      swagger: {
        summary: 'Pipeline run breadcrumb',
        description: 'Requirement → DataTask → OperationsTask → Run breadcrumb payload.',
        tags: ['pipelines'],
      },
    },
    handler: pipelinesHandler.getRun,
  }),
  defineRoute({
    method: 'get',
    path: '/pipelines/trace/:traceId',
    validate: {
      params: { traceId: Joi.string().required() },
      output: buildOutputSchema(Joi.object().unknown(true)),
    },
    meta: {
      swagger: {
        summary: 'Trace chain aggregate',
        description: 'Aggregate all objects (req/dt/ops/run) sharing the same x_trace_id.',
        tags: ['pipelines'],
      },
    },
    handler: pipelinesHandler.getTrace,
  }),
]
