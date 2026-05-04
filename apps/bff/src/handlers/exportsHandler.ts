import type { Context } from 'koa'

import {
  createTrainRunVM,
  getContributionVM,
  getContributionsRollupVM,
  getSnapshotVM,
  getTrainRunVM,
  listContributionsVM,
  listSnapshotsVM,
  listTrainRunsVM,
  listUsageVM,
  patchTrainRunVM,
} from '../engines/exportsEngine.js'

class ExportsHandler {
  async listSnapshots(ctx: Context) {
    const query = ctx.request.query as Record<string, string | undefined>
    ctx.body = await listSnapshotsVM({
      limit: query.limit ? Number(query.limit) : undefined,
      scenario: query.scenario,
      dataset_id: query.dataset_id,
      consumed: query.consumed as 'yes' | 'no' | undefined,
    })
  }

  async getSnapshot(ctx: Context) {
    const params = (ctx.request as typeof ctx.request & {
      params: { traceId: string }
    }).params
    ctx.body = await getSnapshotVM(params.traceId)
  }

  async listTrainRuns(ctx: Context) {
    const query = ctx.request.query as Record<string, string | undefined>
    ctx.body = await listTrainRunsVM({
      limit: query.limit ? Number(query.limit) : undefined,
      snapshot_trace: query.snapshot_trace,
      consumer: query.consumer,
      status: query.status,
    })
  }

  async getTrainRun(ctx: Context) {
    const params = (ctx.request as typeof ctx.request & {
      params: { runId: string }
    }).params
    ctx.body = await getTrainRunVM(params.runId)
  }

  async createTrainRun(ctx: Context) {
    const body = (ctx.request as typeof ctx.request & {
      body?: {
        snapshot_ids: string[]
        name?: string
        consumer?: string
        external_run_id?: string
        model_version?: string
        notes?: string
      }
    }).body
    if (!body || !Array.isArray(body.snapshot_ids) || body.snapshot_ids.length === 0) {
      ctx.throw(400, 'snapshot_ids is required and must be non-empty')
    }
    ctx.status = 201
    ctx.body = await createTrainRunVM(body)
  }

  async listContributions(ctx: Context) {
    const query = ctx.request.query as Record<string, string | undefined>
    ctx.body = await listContributionsVM({
      dataset_id: query.dataset_id,
      limit: query.limit ? Number(query.limit) : undefined,
    })
  }

  async getContributionsRollup(ctx: Context) {
    const query = ctx.request.query as Record<string, string | undefined>
    ctx.body = await getContributionsRollupVM({ dataset_id: query.dataset_id })
  }

  async getContribution(ctx: Context) {
    const params = (ctx.request as typeof ctx.request & {
      params: { sampleUid: string }
    }).params
    ctx.body = await getContributionVM(params.sampleUid)
  }

  async listUsage(ctx: Context) {
    const query = ctx.request.query as Record<string, string | undefined>
    ctx.body = await listUsageVM({
      snapshot_trace: query.snapshot_trace,
      train_run_id: query.train_run_id,
      sample_uid: query.sample_uid,
      limit: query.limit ? Number(query.limit) : undefined,
    })
  }

  async patchTrainRun(ctx: Context) {
    const params = (ctx.request as typeof ctx.request & {
      params: { runId: string }
    }).params
    const body = (ctx.request as typeof ctx.request & {
      body?: { status?: string; finished_at?: string; notes?: string }
    }).body ?? {}
    ctx.body = await patchTrainRunVM(params.runId, body)
  }
}

export default new ExportsHandler()
