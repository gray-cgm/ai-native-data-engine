import type { Context } from 'koa'

import {
  listPipelineRuns,
  getPipelineRunBreadcrumb,
  getTraceChain,
  getPipelineStageStats,
  getPipelineQualityStats,
  getPipelineCostStats,
  listRecentTraces,
} from '../services/pipelines.js'

const PASSTHROUGH_KEYS = [
  'requirement_id',
  'data_task_id',
  'operations_task_id',
  'x_trace_id',
  'stage',
  'status',
  'trigger_source',
  'run_purpose',
  'page',
  'page_size',
]

function pickQuery(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of PASSTHROUGH_KEYS) {
    const v = raw[key]
    if (typeof v === 'string' && v.length > 0) out[key] = v
  }
  return out
}

class PipelinesHandler {
  async listRuns(ctx: Context) {
    const items = await listPipelineRuns(pickQuery(ctx.request.query as Record<string, unknown>))
    ctx.body = { items }
  }

  async getRun(ctx: Context) {
    const req = ctx.request as typeof ctx.request & { params: { id: string } }
    ctx.body = await getPipelineRunBreadcrumb(req.params.id)
  }

  async getTrace(ctx: Context) {
    const req = ctx.request as typeof ctx.request & { params: { traceId: string } }
    ctx.body = await getTraceChain(req.params.traceId)
  }

  async stageStats(ctx: Context) {
    ctx.body = await getPipelineStageStats()
  }

  async qualityStats(ctx: Context) {
    ctx.body = await getPipelineQualityStats()
  }

  async costStats(ctx: Context) {
    ctx.body = await getPipelineCostStats()
  }

  async listTraces(ctx: Context) {
    const limitRaw = (ctx.request.query as Record<string, string>).limit
    const limit = limitRaw ? Math.max(1, Math.min(200, parseInt(limitRaw, 10) || 50)) : 50
    ctx.body = await listRecentTraces(limit)
  }
}

export default new PipelinesHandler()
