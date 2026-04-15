import type { Context, Next } from 'koa'

export async function cleanTimestamp(ctx: Context, next: Next) {
  if ((ctx.method === 'GET' || ctx.method === 'DELETE') && typeof ctx.query.t === 'string') {
    delete ctx.query.t
  }
  await next()
}