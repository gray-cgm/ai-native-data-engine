import type { Context, Next } from 'koa'

const successMessage = {
  cn: '请求成功',
  en: 'success',
} as const

export async function wrapResponse(ctx: Context, next: Next) {
  await next()

  if (shouldSkipResponseWrap(ctx)) {
    return
  }

  const status = ctx.status || 200
  if (status >= 400) {
    return
  }

  ctx.body = {
    status,
    code: 0,
    success: true,
    detailMessage: null,
    message: successMessage,
    requestId: getRequestId(ctx),
    data: ctx.body ?? null,
  }
}

function shouldSkipResponseWrap(ctx: Context) {
  if (ctx.state.skipResponseEnvelope === true) {
    return true
  }

  const body = ctx.body
  if (body == null) {
    return true
  }
  if (Buffer.isBuffer(body)) {
    return true
  }
  if (typeof body === 'string' && ctx.type === 'html') {
    return true
  }
  if (typeof body === 'object' && body && 'success' in body && 'requestId' in body && 'data' in body) {
    return true
  }

  return false
}

function getRequestId(ctx: Context) {
  return typeof ctx.state.requestId === 'string' ? ctx.state.requestId : ''
}