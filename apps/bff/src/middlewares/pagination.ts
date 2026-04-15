import type { Context, Next } from 'koa'

export async function pagination(ctx: Context, next: Next) {
  const query = ctx.request.query as Record<string, unknown>
  const body = (ctx.request.body ?? {}) as Record<string, unknown>

  const pageValue = query.page ?? body.page
  const pageSizeValue = query.pageSize ?? body.pageSize
  const sortField = query.sortField
  const sortOrder = query.sortOrder

  if (pageValue !== undefined && pageSizeValue !== undefined) {
    const page = Number(pageValue)
    const pageSize = Number(pageSizeValue)
    if (Number.isFinite(page) && Number.isFinite(pageSize) && page > 0 && pageSize > 0) {
      query.skip = String((page - 1) * pageSize)
      query.limit = String(pageSize)
      delete query.page
      delete query.pageSize
    }
  }

  if (typeof sortField === 'string' && typeof sortOrder === 'string') {
    query.sort = JSON.stringify({ [sortField]: sortOrder })
    delete query.sortField
    delete query.sortOrder
  }

  await next()
}