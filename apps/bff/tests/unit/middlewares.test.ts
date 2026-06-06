import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { cleanTimestamp } from '../../src/middlewares/clean-timestamp.js'
import { handleException } from '../../src/middlewares/exception.js'
import { pagination } from '../../src/middlewares/pagination.js'
import { wrapResponse } from '../../src/middlewares/response.js'
import { errorCodes } from '../../src/const/error.js'
import { AppError, UpstreamHttpError } from '../../src/errors.js'
import { createFakeContext } from '../helpers/koaContext.js'

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('cleanTimestamp', () => {
  it('strips cache-buster t param on GET', async () => {
    const ctx = createFakeContext({ method: 'GET', query: { t: '123', keep: 'x' } })
    await cleanTimestamp(ctx, async () => undefined)
    expect(ctx.query.t).toBeUndefined()
    expect(ctx.query.keep).toBe('x')
  })

  it('strips t on DELETE', async () => {
    const ctx = createFakeContext({ method: 'DELETE', query: { t: '9' } })
    await cleanTimestamp(ctx, async () => undefined)
    expect(ctx.query.t).toBeUndefined()
  })

  it('keeps t on POST', async () => {
    const ctx = createFakeContext({ method: 'POST', query: { t: '9' } })
    await cleanTimestamp(ctx, async () => undefined)
    expect(ctx.query.t).toBe('9')
  })
})

describe('pagination', () => {
  it('translates page/pageSize into skip/limit', async () => {
    const ctx = createFakeContext({ query: { page: '2', pageSize: '10' } })
    await pagination(ctx, async () => undefined)
    expect(ctx.query.skip).toBe('10')
    expect(ctx.query.limit).toBe('10')
    expect(ctx.query.page).toBeUndefined()
    expect(ctx.query.pageSize).toBeUndefined()
  })

  it('ignores invalid page/pageSize', async () => {
    const ctx = createFakeContext({ query: { page: '0', pageSize: '-5' } })
    await pagination(ctx, async () => undefined)
    expect(ctx.query.skip).toBeUndefined()
    expect(ctx.query.limit).toBeUndefined()
  })

  it('translates sortField/sortOrder into sort JSON', async () => {
    const ctx = createFakeContext({ query: { sortField: 'name', sortOrder: 'asc' } })
    await pagination(ctx, async () => undefined)
    expect(ctx.query.sort).toBe(JSON.stringify({ name: 'asc' }))
    expect(ctx.query.sortField).toBeUndefined()
  })

  it('reads page from body when not in query', async () => {
    const ctx = createFakeContext({ query: {}, body: { page: '3', pageSize: '5' } })
    ;(ctx.request as unknown as { query: Record<string, unknown> }).query = ctx.query
    await pagination(ctx, async () => undefined)
    expect(ctx.query.skip).toBe('10')
    expect(ctx.query.limit).toBe('5')
  })
})

describe('wrapResponse', () => {
  it('wraps a plain object body in the success envelope', async () => {
    const ctx = createFakeContext({ status: 200, state: { requestId: 'r1' } })
    await wrapResponse(ctx, async () => {
      ctx.status = 200
      ctx.body = { hello: 'world' }
    })
    expect(ctx.body).toMatchObject({
      status: 200,
      code: 0,
      success: true,
      requestId: 'r1',
      data: { hello: 'world' },
    })
  })

  it('skips wrapping when skipResponseEnvelope is set', async () => {
    const ctx = createFakeContext({ status: 200, state: { skipResponseEnvelope: true } })
    await wrapResponse(ctx, async () => {
      ctx.body = { raw: true }
    })
    expect(ctx.body).toEqual({ raw: true })
  })

  it('skips error responses (status >= 400)', async () => {
    const ctx = createFakeContext({ status: 200 })
    await wrapResponse(ctx, async () => {
      ctx.status = 400
      ctx.body = { error: { message: 'x' }, success: false, requestId: 'r', data: null }
    })
    expect((ctx.body as { success: boolean }).success).toBe(false)
  })

  it('does not double-wrap an already enveloped body', async () => {
    const enveloped = { success: true, requestId: 'r', data: { a: 1 } }
    const ctx = createFakeContext({ status: 200 })
    await wrapResponse(ctx, async () => {
      ctx.body = enveloped
    })
    expect(ctx.body).toBe(enveloped)
  })

  it('skips Buffer bodies', async () => {
    const buf = Buffer.from('bin')
    const ctx = createFakeContext({ status: 200 })
    await wrapResponse(ctx, async () => {
      ctx.body = buf
    })
    expect(ctx.body).toBe(buf)
  })
})

describe('handleException', () => {
  it('wraps a thrown AppError into the error envelope with mapped code', async () => {
    const ctx = createFakeContext({ method: 'GET', path: '/x', status: 200 })
    await handleException(ctx, async () => {
      throw new AppError('nope', { status: 400, code: errorCodes.router.requestParamIncorrect })
    })
    expect(ctx.status).toBe(400)
    expect(ctx.body).toMatchObject({
      success: false,
      code: errorCodes.router.requestParamIncorrect,
      data: null,
    })
    expect((ctx.body as { error: { message: string } }).error.message).toBe('nope')
    expect((ctx as unknown as { _setHeaders: Record<string, string> })._setHeaders['x-request-id']).toBeTruthy()
  })

  it('maps an unknown thrown value to a 500 system error', async () => {
    const ctx = createFakeContext({ status: 200 })
    await handleException(ctx, async () => {
      throw new Error('kaboom')
    })
    expect(ctx.status).toBe(500)
    expect((ctx.body as { code: number }).code).toBe(errorCodes.system.unknown)
  })

  it('maps a Joi ValidationError to requestParamIncorrect', async () => {
    const ctx = createFakeContext({ status: 200 })
    await handleException(ctx, async () => {
      const err = Object.assign(new Error('bad'), {
        name: 'ValidationError',
        status: 400,
        details: [{ message: 'field x is required' }],
      })
      throw err
    })
    expect(ctx.status).toBe(400)
    expect((ctx.body as { code: number }).code).toBe(errorCodes.router.requestParamIncorrect)
    expect((ctx.body as { error: { message: string } }).error.message).toBe('field x is required')
  })

  it('maps a 5xx ValidationError to responseFieldIncorrect', async () => {
    const ctx = createFakeContext({ status: 200 })
    await handleException(ctx, async () => {
      const err = Object.assign(new Error('bad'), {
        name: 'ValidationError',
        status: 500,
        details: [{ message: 'response shape wrong' }],
      })
      throw err
    })
    expect(ctx.status).toBe(500)
    expect((ctx.body as { code: number }).code).toBe(errorCodes.router.responseFieldIncorrect)
  })

  it('synthesizes a 404 when next() leaves an empty body', async () => {
    const ctx = createFakeContext({ method: 'GET', path: '/missing', status: 200 })
    await handleException(ctx, async () => {
      ctx.status = 404
      ctx.body = null
    })
    expect(ctx.status).toBe(404)
    expect((ctx.body as { code: number }).code).toBe(errorCodes.router.unknown)
  })

  it('passes through a successful response untouched', async () => {
    const ctx = createFakeContext({ status: 200 })
    await handleException(ctx, async () => {
      ctx.status = 200
      ctx.body = { ok: true }
    })
    expect(ctx.body).toEqual({ ok: true })
  })

  it('records upstreamStatus for UpstreamHttpError', async () => {
    const ctx = createFakeContext({ status: 200 })
    await handleException(ctx, async () => {
      throw new UpstreamHttpError('upstream', { status: 502 })
    })
    expect(ctx.status).toBe(502)
    expect((ctx.body as { code: number }).code).toBe(errorCodes.platform.requestFailed)
  })
})
