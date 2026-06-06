import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { config } from '../../src/config/index.js'
import { UpstreamHttpError } from '../../src/errors.js'
import { platformFetch } from '../../src/services/platform.js'
import { installFetchMock } from '../helpers/fetchMock.js'

describe('platformFetch', () => {
  let mock: ReturnType<typeof installFetchMock>

  beforeEach(() => {
    mock = installFetchMock()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('prefixes the platform base url and parses JSON', async () => {
    mock.on('/workspaces', { body: { items: [{ id: 'w1' }] } })
    const result = await platformFetch('/workspaces')
    expect(result).toEqual({ items: [{ id: 'w1' }] })
    expect(mock.lastCall().url).toBe(`${config.platformApiBaseUrl}/workspaces`)
  })

  it('forwards method/headers/body through init', async () => {
    mock.on('/datasets', { status: 200, body: { ok: true } }, 'POST')
    await platformFetch('/datasets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: 1 }),
    })
    const call = mock.lastCall()
    expect(call.method).toBe('POST')
    expect(call.headers['content-type']).toBe('application/json')
    expect(call.body).toEqual({ a: 1 })
  })

  it('returns null for an empty body', async () => {
    mock.on('/empty', { status: 204, text: '' })
    await expect(platformFetch('/empty')).resolves.toBeNull()
  })

  it('returns raw text when body is not JSON', async () => {
    mock.on('/plain', { status: 200, text: 'hello' })
    await expect(platformFetch('/plain')).resolves.toBe('hello')
  })

  it('throws UpstreamHttpError using detailMessage from error payload', async () => {
    mock.on('/bad', { status: 422, body: { detailMessage: 'validation exploded' } })
    await expect(platformFetch('/bad')).rejects.toMatchObject({
      name: 'UpstreamHttpError',
      status: 422,
      upstreamStatus: 422,
      detailMessage: 'validation exploded',
    })
  })

  it('extracts message from error.message shape', async () => {
    mock.on('/bad2', { status: 500, body: { error: { message: 'nested boom' } } })
    await expect(platformFetch('/bad2')).rejects.toMatchObject({ detailMessage: 'nested boom' })
  })

  it('extracts top-level message field', async () => {
    mock.on('/bad3', { status: 400, body: { message: 'top message' } })
    await expect(platformFetch('/bad3')).rejects.toMatchObject({ detailMessage: 'top message' })
  })

  it('falls back to raw text when no structured message', async () => {
    mock.on('/bad4', { status: 400, text: 'raw failure text' })
    await expect(platformFetch('/bad4')).rejects.toBeInstanceOf(UpstreamHttpError)
    await expect(platformFetch('/bad4')).rejects.toMatchObject({ detailMessage: 'raw failure text' })
  })

  it('retries once on a TypeError network error then succeeds', async () => {
    let attempts = 0
    mock.on('/flaky', () => {
      attempts += 1
      if (attempts === 1) return { networkError: true }
      return { body: { recovered: true } }
    })
    await expect(platformFetch('/flaky')).resolves.toEqual({ recovered: true })
    expect(attempts).toBe(2)
  })

  it('does not retry on non-TypeError errors', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new RangeError('boom')
    })
    vi.stubGlobal('fetch', fetchImpl)
    await expect(platformFetch('/x')).rejects.toBeInstanceOf(RangeError)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
