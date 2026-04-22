import { Joi } from './schema.js'

export const workspaceSchema = Joi.object({
  workspace_id: Joi.string().required(),
  name: Joi.string().required(),
}).unknown(true)

export const datasetSchema = Joi.object({
  dataset_id: Joi.string().required(),
  name: Joi.string().required(),
  workspace_id: Joi.string().required(),
  profile: Joi.string().required(),
}).unknown(true)

export const datasetVersionSchema = Joi.object({
  version_id: Joi.string().required(),
  dataset_id: Joi.string().required(),
  sample_count: Joi.number().integer().required(),
  table_name: Joi.string().required(),
}).unknown(true)

export const taskSchema = Joi.object({
  task_id: Joi.string().required(),
  title: Joi.string().required(),
  status: Joi.string().required(),
  task_type: Joi.string().required(),
  requirement_id: Joi.string().allow(null),
  pipeline_run_id: Joi.string().allow(null),
  assignee: Joi.string().allow(null),
  created_at: Joi.string().allow(null),
  updated_at: Joi.string().allow(null),
}).unknown(true)

export const runSchema = Joi.object({
  run_id: Joi.string().required(),
  job_name: Joi.string().required(),
  status: Joi.string().required(),
  requirement_id: Joi.string().allow(null),
  operation_task_id: Joi.string().allow(null),
  trigger_source: Joi.string().allow(null),
  reason_code: Joi.string().allow(null),
  duration_seconds: Joi.number().allow(null),
  cpu_seconds: Joi.number().allow(null),
  gpu_seconds: Joi.number().allow(null),
  input_bytes: Joi.number().allow(null),
  output_bytes: Joi.number().allow(null),
  estimated_cost: Joi.number().allow(null),
  derived_assets: Joi.array().items(Joi.object().unknown(true)).optional(),
  created_at: Joi.string().allow(null),
}).unknown(true)

export const exportSchema = Joi.object({
  export_id: Joi.string().required(),
  dataset_id: Joi.string().required(),
  format: Joi.string().required(),
  status: Joi.string().required(),
  output_path: Joi.string().required(),
}).unknown(true)

export const datasetDetailSchema = Joi.object({
  item: datasetSchema.allow(null),
  versions: Joi.array().items(datasetVersionSchema).required(),
  versionCount: Joi.number().integer().required(),
}).unknown(true)