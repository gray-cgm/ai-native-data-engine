import { vi } from 'vitest'

export type FetchCall = {
  url: string
  method: string
  headers: Record<string, string>
  body: unknown
}

export type RouteResponse = {
  status?: number
  body?: unknown
  /** raw text body (skips JSON.stringify) */
  text?: string
  headers?: Record<string, string>
  /** throw a network-style error (TypeError → triggers platform retry) */
  networkError?: boolean
}

type Matcher = {
  method?: string
  /** matched against the pathname+search of the request URL */
  match: (urlPath: string, fullUrl: string) => boolean
  response: RouteResponse | ((call: FetchCall) => RouteResponse)
}

/**
 * Installs a fake global.fetch that records calls and answers based on a small
 * routing table. Returns helpers to register routes and inspect calls.
 */
export function installFetchMock() {
  const calls: FetchCall[] = []
  const matchers: Matcher[] = []
  let fallback: RouteResponse = { status: 200, body: {} }

  const fetchImpl = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    const headers = normalizeHeaders(init?.headers)
    const body = parseBody(init?.body)
    const call: FetchCall = { url, method, headers, body }
    calls.push(call)

    const path = toPathname(url)
    const matcher = matchers.find(
      (m) => (!m.method || m.method === method) && m.match(path, url),
    )
    const resolved = matcher
      ? typeof matcher.response === 'function'
        ? matcher.response(call)
        : matcher.response
      : fallback

    if (resolved.networkError) {
      throw new TypeError('network error')
    }

    return makeResponse(resolved)
  })

  vi.stubGlobal('fetch', fetchImpl)

  return {
    calls,
    fetchImpl,
    /** Register a route. `match` may be a string (substring on path), RegExp, or predicate. */
    on(
      match: string | RegExp | ((urlPath: string, fullUrl: string) => boolean),
      response: RouteResponse | ((call: FetchCall) => RouteResponse),
      method?: string,
    ) {
      matchers.push({
        method: method?.toUpperCase(),
        match: toPredicate(match),
        response,
      })
    },
    setFallback(response: RouteResponse) {
      fallback = response
    },
    reset() {
      calls.length = 0
      matchers.length = 0
      fallback = { status: 200, body: {} }
    },
    lastCall() {
      return calls[calls.length - 1]
    },
  }
}

function toPredicate(
  match: string | RegExp | ((urlPath: string, fullUrl: string) => boolean),
) {
  if (typeof match === 'function') return match
  if (match instanceof RegExp) return (path: string, full: string) => match.test(path) || match.test(full)
  return (path: string, full: string) => path.includes(match) || full.includes(match)
}

function toPathname(url: string) {
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return url
  }
}

function normalizeHeaders(headers: RequestInit['headers']): Record<string, string> {
  const out: Record<string, string> = {}
  if (!headers) return out
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      out[key.toLowerCase()] = value
    })
    return out
  }
  if (Array.isArray(headers)) {
    for (const [key, value] of headers) out[key.toLowerCase()] = value
    return out
  }
  for (const [key, value] of Object.entries(headers)) out[key.toLowerCase()] = String(value)
  return out
}

function parseBody(body: BodyInit | null | undefined): unknown {
  if (body == null) return undefined
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return body
    }
  }
  return body
}

function makeResponse(resolved: RouteResponse): Response {
  const status = resolved.status ?? 200
  const headers = new Headers(resolved.headers ?? {})
  let text: string
  if (typeof resolved.text === 'string') {
    text = resolved.text
  } else if (resolved.body === undefined || resolved.body === null) {
    text = ''
  } else if (typeof resolved.body === 'string') {
    text = resolved.body
  } else {
    text = JSON.stringify(resolved.body)
    if (!headers.has('content-type')) headers.set('content-type', 'application/json')
  }

  const ok = status >= 200 && status < 300
  return {
    ok,
    status,
    headers,
    async text() {
      return text
    },
    async json() {
      return JSON.parse(text)
    },
    async arrayBuffer() {
      return new TextEncoder().encode(text).buffer
    },
    body: null,
  } as unknown as Response
}
