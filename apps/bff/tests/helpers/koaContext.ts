import type { Context } from 'koa'

export type FakeCtxOptions = {
  method?: string
  path?: string
  query?: Record<string, unknown>
  body?: unknown
  headers?: Record<string, string>
  state?: Record<string, unknown>
  status?: number
  type?: string
  querystring?: string
}

/**
 * Builds a minimal Koa-like Context sufficient for exercising the BFF
 * middlewares in isolation. Only the surface the middlewares touch is faked.
 */
export function createFakeContext(options: FakeCtxOptions = {}): Context {
  const headers = options.headers ?? {}
  const setHeaders: Record<string, string> = {}
  let status = options.status ?? 404
  let body: unknown = options.body

  const ctx = {
    method: options.method ?? 'GET',
    path: options.path ?? '/',
    querystring: options.querystring ?? '',
    query: options.query ?? {},
    headers,
    params: {},
    request: {
      query: options.query ?? {},
      body: options.body,
      header: headers,
      get(name: string) {
        return headers[name.toLowerCase()] ?? ''
      },
    },
    state: options.state ?? {},
    get type() {
      return options.type ?? ''
    },
    set type(value: string) {
      options.type = value
    },
    get status() {
      return status
    },
    set status(value: number) {
      status = value
    },
    get body() {
      return body
    },
    set body(value: unknown) {
      body = value
    },
    get(name: string) {
      return headers[name.toLowerCase()] ?? ''
    },
    set(name: string, value: string) {
      setHeaders[name.toLowerCase()] = value
    },
    throw(code: number, message?: string) {
      const err = new Error(message ?? 'error') as Error & { status: number; expose: boolean }
      err.status = code
      err.expose = true
      throw err
    },
    _setHeaders: setHeaders,
  } as unknown as Context

  return ctx
}
