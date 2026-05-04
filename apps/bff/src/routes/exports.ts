import exportHandler from '../handlers/exportHandler.js'
import exportsHandler from '../handlers/exportsHandler.js'
import { defineRoute } from './route-types.js'
import { buildOutputSchema, Joi } from './schema.js'

const datasetExport = defineRoute({
  method: 'post',
  path: '/datasets/:datasetId/exports',
  validate: {
    params: {
      datasetId: Joi.string().required(),
    },
    type: 'json',
    body: Joi.object({
      format: Joi.string().valid('lance', 'csv', 'jsonl').default('lance'),
    }).required(),
    output: buildOutputSchema(),
  },
  meta: {
    swagger: {
      summary: 'Create dataset export',
      description: 'Forward an export request to the Platform API for the target dataset.',
      tags: ['exports'],
    },
  },
  handler: exportHandler.createDatasetExport,
})

const listSnapshots = defineRoute({
  method: 'get',
  path: '/exports/snapshots',
  validate: {
    query: {
      limit: Joi.number().integer().min(1).max(500).optional(),
      scenario: Joi.string().optional(),
      dataset_id: Joi.string().optional(),
      consumed: Joi.string().valid('yes', 'no').optional(),
    },
    output: buildOutputSchema(Joi.object().unknown(true)),
  },
  meta: {
    swagger: {
      summary: 'List export snapshots',
      description:
        'List dataset_snapshot_manifests with consumption counters; aggregates fresh / used summary.',
      tags: ['exports'],
    },
  },
  handler: exportsHandler.listSnapshots,
})

const getSnapshot = defineRoute({
  method: 'get',
  path: '/exports/snapshots/:traceId',
  validate: {
    params: { traceId: Joi.string().required() },
    output: buildOutputSchema(Joi.object().unknown(true)),
  },
  meta: {
    swagger: {
      summary: 'Snapshot detail',
      description: 'Snapshot receipt + attached train_runs.',
      tags: ['exports'],
    },
  },
  handler: exportsHandler.getSnapshot,
})

const listTrainRuns = defineRoute({
  method: 'get',
  path: '/exports/train-runs',
  validate: {
    query: {
      limit: Joi.number().integer().min(1).max(500).optional(),
      snapshot_trace: Joi.string().optional(),
      consumer: Joi.string().optional(),
      status: Joi.string().optional(),
    },
    output: buildOutputSchema(Joi.object().unknown(true)),
  },
  meta: {
    swagger: {
      summary: 'List train runs',
      description: 'List TrainRun rows. Filter by snapshot_trace / consumer / status.',
      tags: ['exports'],
    },
  },
  handler: exportsHandler.listTrainRuns,
})

const getTrainRun = defineRoute({
  method: 'get',
  path: '/exports/train-runs/:runId',
  validate: {
    params: { runId: Joi.string().required() },
    output: buildOutputSchema(Joi.object().unknown(true)),
  },
  meta: {
    swagger: {
      summary: 'Train run detail',
      tags: ['exports'],
    },
  },
  handler: exportsHandler.getTrainRun,
})

const createTrainRun = defineRoute({
  method: 'post',
  path: '/exports/train-runs',
  validate: {
    type: 'json',
    body: Joi.object({
      snapshot_ids: Joi.array().items(Joi.string()).min(1).required(),
      name: Joi.string().optional(),
      consumer: Joi.string().optional(),
      external_run_id: Joi.string().optional(),
      model_version: Joi.string().optional(),
      notes: Joi.string().optional(),
    }).required(),
    output: buildOutputSchema(Joi.object().unknown(true)),
  },
  meta: {
    swagger: {
      summary: 'Register a train run',
      description: 'Manually register a TrainRun (dlkit SDK 上线前的人工通道).',
      tags: ['exports'],
    },
  },
  handler: exportsHandler.createTrainRun,
})

const patchTrainRun = defineRoute({
  method: 'patch',
  path: '/exports/train-runs/:runId',
  validate: {
    params: { runId: Joi.string().required() },
    type: 'json',
    body: Joi.object({
      status: Joi.string().valid('completed', 'failed', 'running', 'unknown').optional(),
      finished_at: Joi.string().isoDate().optional(),
      notes: Joi.string().optional(),
    }).required(),
    output: buildOutputSchema(Joi.object().unknown(true)),
  },
  meta: {
    swagger: {
      summary: 'Update train run status',
      tags: ['exports'],
    },
  },
  handler: exportsHandler.patchTrainRun,
})

const listUsage = defineRoute({
  method: 'get',
  path: '/exports/usage',
  validate: {
    query: {
      snapshot_trace: Joi.string().optional(),
      train_run_id: Joi.string().optional(),
      sample_uid: Joi.string().optional(),
      limit: Joi.number().integer().min(1).max(1000).optional(),
    },
    output: buildOutputSchema(Joi.object().unknown(true)),
  },
  meta: {
    swagger: {
      summary: 'List sample consumption events',
      description: 'Filter by snapshot_trace / train_run_id / sample_uid.',
      tags: ['exports'],
    },
  },
  handler: exportsHandler.listUsage,
})

const listContributions = defineRoute({
  method: 'get',
  path: '/exports/contributions',
  validate: {
    query: {
      dataset_id: Joi.string().optional(),
      limit: Joi.number().integer().min(1).max(500).optional(),
    },
    output: buildOutputSchema(Joi.object().unknown(true)),
  },
  meta: {
    swagger: {
      summary: 'Top hard samples',
      description: 'Live aggregation; sort by hard_score desc.',
      tags: ['exports'],
    },
  },
  handler: exportsHandler.listContributions,
})

const getContributionsRollup = defineRoute({
  method: 'get',
  path: '/exports/contributions/rollup',
  validate: {
    query: {
      dataset_id: Joi.string().optional(),
    },
    output: buildOutputSchema(Joi.object().unknown(true)),
  },
  meta: {
    swagger: {
      summary: 'Dataset-level contribution rollup',
      tags: ['exports'],
    },
  },
  handler: exportsHandler.getContributionsRollup,
})

const getContribution = defineRoute({
  method: 'get',
  path: '/exports/contributions/:sampleUid',
  validate: {
    params: { sampleUid: Joi.string().required() },
    output: buildOutputSchema(Joi.object().unknown(true)),
  },
  meta: {
    swagger: {
      summary: 'Single sample contribution',
      tags: ['exports'],
    },
  },
  handler: exportsHandler.getContribution,
})

export default [
  datasetExport,
  listSnapshots,
  getSnapshot,
  listTrainRuns,
  getTrainRun,
  createTrainRun,
  patchTrainRun,
  listUsage,
  // Order: rollup BEFORE :sampleUid wildcard so /rollup doesn't get captured
  getContributionsRollup,
  listContributions,
  getContribution,
]
