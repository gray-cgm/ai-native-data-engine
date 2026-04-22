const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'
const inflightGetRequests = new Map<string, Promise<unknown>>()

type ApiEnvelope<T> = {
  status: number
  code: number
  success: boolean
  detailMessage: string | null
  message?:
    | string
    | {
        cn?: string | null
        en?: string | null
      }
    | null
  requestId?: string
  data: T | null
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: number,
    public requestId?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text()
  const parsed = parseJson(text)

  if (!res.ok) {
    throw toApiError(res.status, parsed, text)
  }

  if (isApiEnvelope<T>(parsed)) {
    return parsed.data as T
  }

  return parsed as T
}

export async function apiGet<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}`
  const existing = inflightGetRequests.get(url)
  if (existing) {
    return existing as Promise<T>
  }

  const request = fetch(url)
    .then((res) => handleResponse<T>(res))
    .finally(() => {
      inflightGetRequests.delete(url)
    })

  inflightGetRequests.set(url, request as Promise<unknown>)
  return request
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' })
  return handleResponse<T>(res)
}

function parseJson(text: string) {
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function isApiEnvelope<T>(value: unknown): value is ApiEnvelope<T> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'success' in value &&
      'status' in value &&
      'data' in value,
  )
}

function toApiError(status: number, parsed: unknown, fallbackText: string) {
  if (isApiEnvelope(parsed)) {
    return new ApiError(
      status,
      extractEnvelopeMessage(parsed) ?? fallbackText ?? `Request failed: ${status}`,
      parsed.code,
      parsed.requestId,
    )
  }

  if (typeof parsed === 'string') {
    return new ApiError(status, parsed || `Request failed: ${status}`)
  }

  return new ApiError(status, fallbackText || `Request failed: ${status}`)
}

function extractEnvelopeMessage<T>(envelope: ApiEnvelope<T>) {
  if (typeof envelope.detailMessage === 'string' && envelope.detailMessage.trim()) {
    return envelope.detailMessage
  }

  if (typeof envelope.message === 'string' && envelope.message.trim()) {
    return envelope.message
  }

  if (envelope.message && typeof envelope.message === 'object') {
    return envelope.message.en ?? envelope.message.cn ?? null
  }

  return null
}
