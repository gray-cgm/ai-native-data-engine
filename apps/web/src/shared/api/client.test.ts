import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from './client'

function jsonResponse(body: unknown, init: Partial<{ ok: boolean; status: number }> = {}) {
  const status = init.status ?? 200
  return {
    ok: init.ok ?? status < 400,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as Response
}

describe('apiGet', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('unwraps an API envelope and returns data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ status: 200, code: 0, success: true, data: { id: 'r1' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await apiGet<{ id: string }>('/requirements/r1')
    expect(result).toEqual({ id: 'r1' })
    expect(fetchMock).toHaveBeenCalledWith('/api/requirements/r1')
  })

  it('returns raw JSON when not an envelope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([1, 2, 3])))
    await expect(apiGet<number[]>('/raw')).resolves.toEqual([1, 2, 3])
  })

  it('dedupes concurrent in-flight GETs to the same url', async () => {
    let resolveFetch: (v: Response) => void = () => {}
    const fetchMock = vi.fn().mockImplementation(
      () => new Promise<Response>((res) => { resolveFetch = res }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const p1 = apiGet('/dedupe')
    const p2 = apiGet('/dedupe')
    resolveFetch(jsonResponse({ status: 200, code: 0, success: true, data: 'x' }))
    const [a, b] = await Promise.all([p1, p2])

    expect(a).toBe('x')
    expect(b).toBe('x')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws ApiError with envelope message on non-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          { status: 404, code: 4040, success: false, detailMessage: 'not found', requestId: 'req-1', data: null },
          { ok: false, status: 404 },
        ),
      ),
    )
    await expect(apiGet('/missing')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'not found',
      code: 4040,
      requestId: 'req-1',
    })
  })

  it('falls back to message.en / message.cn', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          { status: 500, code: 1, success: false, detailMessage: null, message: { en: 'boom-en', cn: 'boom-cn' }, data: null },
          { ok: false, status: 500 },
        ),
      ),
    )
    await expect(apiGet('/x')).rejects.toThrow('boom-en')
  })

  it('throws ApiError from a plain string body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse('plain error', { ok: false, status: 400 })))
    await expect(apiGet('/x')).rejects.toMatchObject({ status: 400, message: 'plain error' })
  })

  it('throws ApiError with fallback when body empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse('', { ok: false, status: 503 })))
    await expect(apiGet('/x')).rejects.toThrow('Request failed: 503')
  })
})

describe('apiPost / apiPatch / apiDelete', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('apiPost sends JSON body + content-type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ status: 200, code: 0, success: true, data: { ok: true } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await apiPost('/exports/train-runs', { name: 'x' })
    expect(fetchMock).toHaveBeenCalledWith('/api/exports/train-runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x' }),
    })
  })

  it('apiPost without body omits headers/body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ status: 200, code: 0, success: true, data: null }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await apiPost('/datasets/d1/exports')
    expect(fetchMock).toHaveBeenCalledWith('/api/datasets/d1/exports', {
      method: 'POST',
      headers: {},
      body: undefined,
    })
  })

  it('apiPatch sends PATCH with body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ status: 200, code: 0, success: true, data: { ok: true } }),
    )
    vi.stubGlobal('fetch', fetchMock)
    await apiPatch('/exports/train-runs/r1', { status: 'done' })
    expect(fetchMock).toHaveBeenCalledWith('/api/exports/train-runs/r1', expect.objectContaining({ method: 'PATCH' }))
  })

  it('apiDelete issues DELETE', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ status: 200, code: 0, success: true, data: null }),
    )
    vi.stubGlobal('fetch', fetchMock)
    await apiDelete('/ops/labeling/i1')
    expect(fetchMock).toHaveBeenCalledWith('/api/ops/labeling/i1', { method: 'DELETE' })
  })
})

describe('ApiError', () => {
  it('carries status/code/requestId', () => {
    const e = new ApiError(418, 'teapot', 9, 'rid')
    expect(e).toBeInstanceOf(Error)
    expect(e.name).toBe('ApiError')
    expect(e.status).toBe(418)
    expect(e.code).toBe(9)
    expect(e.requestId).toBe('rid')
  })
})
