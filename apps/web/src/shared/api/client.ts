const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3100/api'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!res.ok) throw new ApiError(res.status, text || `Request failed: ${res.status}`)
  return text ? (JSON.parse(text) as T) : (null as T)
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  return handleResponse<T>(res)
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}
