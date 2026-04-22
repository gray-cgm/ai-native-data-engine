import type { Context } from 'koa'

import {
  queryRequirements,
  findRequirement,
  fetchRequirementStats,
  submitRequirement,
  patchRequirement,
  submitDataTask,
  patchDataTask,
  approveOrRejectDataTask,
  buildRequirementReport,
} from '../engines/requirementEngine.js'

class RequirementHandler {
  async list(ctx: Context) {
    ctx.body = await queryRequirements(ctx.request.query as Record<string, unknown>)
  }

  async get(ctx: Context) {
    const request = ctx.request as typeof ctx.request & { params: { id: string } }
    ctx.body = await findRequirement(request.params.id)
  }

  async stats(ctx: Context) {
    ctx.body = await fetchRequirementStats()
  }

  async create(ctx: Context) {
    ctx.body = await submitRequirement(ctx.request.body as Record<string, unknown>)
    ctx.status = 201
  }

  async update(ctx: Context) {
    const request = ctx.request as typeof ctx.request & { params: { id: string } }
    ctx.body = await patchRequirement(request.params.id, ctx.request.body as Record<string, unknown>)
  }

  async createTask(ctx: Context) {
    const request = ctx.request as typeof ctx.request & { params: { id: string } }
    const body = ctx.request.body as Record<string, unknown>
    body.requirement_id = request.params.id
    ctx.body = await submitDataTask(body)
    ctx.status = 201
  }

  async updateTask(ctx: Context) {
    const request = ctx.request as typeof ctx.request & { params: { id: string } }
    ctx.body = await patchDataTask(request.params.id, ctx.request.body as Record<string, unknown>)
  }

  async signOffTask(ctx: Context) {
    const request = ctx.request as typeof ctx.request & { params: { id: string } }
    ctx.body = await approveOrRejectDataTask(request.params.id, ctx.request.body as Record<string, unknown>)
  }

  async report(ctx: Context) {
    const request = ctx.request as typeof ctx.request & { params: { id: string } }
    ctx.body = await buildRequirementReport(request.params.id)
  }
}

export default new RequirementHandler()
