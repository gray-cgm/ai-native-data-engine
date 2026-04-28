import { Joi } from './schema.js'

export const workspaceSchema = Joi.object({
  workspace_id: Joi.string().required(),
  name: Joi.string().required(),
}).unknown(true)

// Legacy dataset / dataset_version schemas 已下线（v3 重构去掉 BFF 的旧 datasets 路由）。
// 新 dataset CRUD 在 routes/datasets.ts，schema 直接用 unknown object —— 平台 API
// 是 source of truth，BFF 只透传。

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

