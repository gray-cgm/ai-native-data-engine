import { describe, expect, it } from 'vitest'

import { errorCodes } from '../../src/const/error.js'
import { AppError, UpstreamHttpError } from '../../src/errors.js'

describe('AppError', () => {
  it('defaults code to system.unknown and detailMessage to message', () => {
    const err = new AppError('boom', { status: 500 })
    expect(err.name).toBe('AppError')
    expect(err.status).toBe(500)
    expect(err.code).toBe(errorCodes.system.unknown)
    expect(err.detailMessage).toBe('boom')
    expect(err).toBeInstanceOf(Error)
  })

  it('honours explicit code and detailMessage', () => {
    const err = new AppError('bad', {
      status: 400,
      code: errorCodes.router.requestParamIncorrect,
      detailMessage: 'param x missing',
    })
    expect(err.code).toBe(errorCodes.router.requestParamIncorrect)
    expect(err.detailMessage).toBe('param x missing')
  })
})

describe('UpstreamHttpError', () => {
  it('maps to platform.requestFailed and carries upstream status/body', () => {
    const err = new UpstreamHttpError('upstream down', { status: 503, upstreamBody: { detail: 'x' } })
    expect(err.name).toBe('UpstreamHttpError')
    expect(err.status).toBe(503)
    expect(err.upstreamStatus).toBe(503)
    expect(err.code).toBe(errorCodes.platform.requestFailed)
    expect(err.upstreamBody).toEqual({ detail: 'x' })
    expect(err).toBeInstanceOf(AppError)
  })

  it('defaults upstreamBody to null', () => {
    const err = new UpstreamHttpError('nope', { status: 500 })
    expect(err.upstreamBody).toBeNull()
  })
})
