import type { Context } from 'koa'

import {
  assertOpsModule,
  createOpsItemForModule,
  deleteOpsItemForModule,
  getOpsItemDetail,
  getOpsOverview,
  getOpsStats,
  getOpsVocab,
  loadLabelingAnnotations,
  patchOpsItemForModule,
  queryOpsItems,
  saveLabelingAnnotations,
  type OpsItemCreateInput,
  type OpsItemPatchInput,
  type SaveAnnotationsBody,
} from '../engines/opsModulesEngine.js'

/**
 * Handlers are thin Koa adapters. They only:
 *   1. Validate the `:module` param using the engine's type guard.
 *   2. Forward request data to the engine.
 *   3. Write the engine's result to `ctx.body`.
 *
 * No business rules, no `fetch()`, no Platform API paths live here.
 */
class OpsModulesHandler {
  async list(ctx: Context) {
    const module = assertOpsModule(ctx.params.module)
    ctx.body = await queryOpsItems(module, ctx.request.query as Record<string, unknown>)
  }

  async detail(ctx: Context) {
    const module = assertOpsModule(ctx.params.module)
    ctx.body = await getOpsItemDetail(module, ctx.params.id)
  }

  async create(ctx: Context) {
    const module = assertOpsModule(ctx.params.module)
    ctx.body = await createOpsItemForModule(module, ctx.request.body as OpsItemCreateInput)
    ctx.status = 201
  }

  async patch(ctx: Context) {
    const module = assertOpsModule(ctx.params.module)
    ctx.body = await patchOpsItemForModule(
      module,
      ctx.params.id,
      ctx.request.body as OpsItemPatchInput,
    )
  }

  async remove(ctx: Context) {
    const module = assertOpsModule(ctx.params.module)
    ctx.body = await deleteOpsItemForModule(module, ctx.params.id)
  }

  async vocab(ctx: Context) {
    const module = assertOpsModule(ctx.params.module)
    ctx.body = await getOpsVocab(module)
  }

  async stats(ctx: Context) {
    const module = assertOpsModule(ctx.params.module)
    ctx.body = await getOpsStats(module)
  }

  async overview(ctx: Context) {
    ctx.body = await getOpsOverview()
  }

  // ── Labeling 标注保存闭环 ──
  async saveAnnotations(ctx: Context) {
    ctx.body = await saveLabelingAnnotations(ctx.request.body as SaveAnnotationsBody)
  }

  async loadAnnotations(ctx: Context) {
    const query = ctx.request.query as Record<string, string>
    ctx.body = await loadLabelingAnnotations(query.clip_id, query.x_trace_id)
  }
}

export default new OpsModulesHandler()
