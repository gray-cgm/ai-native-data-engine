import { config } from '../config/index.js'
import { UpstreamHttpError } from '../errors.js'

export async function platformFetch(pathname: string, init?: RequestInit) {
  const response = await fetchWithRetry(`${config.platformApiBaseUrl}${pathname}`, init)
  const text = await response.text()
  const payload = parseResponseBody(text)

  if (!response.ok) {
    const detail = extractErrorMessage(payload) ?? text ?? `Platform API request failed: ${response.status}`
    throw new UpstreamHttpError(detail, {
      status: response.status,
      upstreamBody: payload,
    })
  }

  return payload
}

async function fetchWithRetry(input: string, init?: RequestInit) {
  try {
    return await fetch(input, init)
  } catch (error) {
    if (!isRetriableNetworkError(error)) {
      throw error
    }
    await wait(150)
    return fetch(input, init)
  }
}

function isRetriableNetworkError(error: unknown) {
  return error instanceof TypeError
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseResponseBody(text: string) {
  if (!text) {
    return null
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function extractErrorMessage(payload: unknown) {
  if (typeof payload === 'string') {
    return payload
  }
  if (!payload || typeof payload !== 'object') {
    return null
  }
  const detailMessage = (payload as Record<string, unknown>).detailMessage
  if (typeof detailMessage === 'string') {
    return detailMessage
  }
  const error = (payload as Record<string, unknown>).error
  if (error && typeof error === 'object' && typeof (error as Record<string, unknown>).message === 'string') {
    return (error as Record<string, string>).message
  }
  const message = (payload as Record<string, unknown>).message
  return typeof message === 'string' ? message : null
}
