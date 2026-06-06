import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { logger, requestContext } from '../../src/utils/logger.js'

describe('logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('emits info to console.log with structured JSON', () => {
    logger.info('hello', { foo: 'bar' })
    expect(console.log).toHaveBeenCalledTimes(1)
    const line = (console.log as unknown as { mock: { calls: string[][] } }).mock.calls[0][0]
    const parsed = JSON.parse(line)
    expect(parsed.level).toBe('info')
    expect(parsed.message).toBe('hello')
    expect(parsed.foo).toBe('bar')
    expect(parsed.timestamp).toBeTruthy()
  })

  it('routes warn and error to the matching console methods', () => {
    logger.warn('w')
    logger.error('e')
    expect(console.warn).toHaveBeenCalledTimes(1)
    expect(console.error).toHaveBeenCalledTimes(1)
  })

  it('suppresses debug below the default info threshold', () => {
    logger.debug('quiet')
    expect(console.log).not.toHaveBeenCalled()
  })

  it('threads requestId via AsyncLocalStorage context', async () => {
    let capturedInside: string | undefined
    await requestContext.run('req-123', async () => {
      capturedInside = requestContext.getRequestId()
      logger.info('within')
    })
    expect(capturedInside).toBe('req-123')
    const line = (console.log as unknown as { mock: { calls: string[][] } }).mock.calls[0][0]
    expect(JSON.parse(line).requestId).toBe('req-123')
    expect(requestContext.getRequestId()).toBeUndefined()
  })
})
