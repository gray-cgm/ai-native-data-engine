import { platformFetch } from '../services/platform.js'

const PREFIX = '/api/v1/events'

type Query = Record<string, unknown>

function buildQuery(query: Query): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v == null || v === '') continue
    params.set(k, String(v))
  }
  const s = params.toString()
  return s ? `?${s}` : ''
}

export async function listEvents(query: Query) {
  return platformFetch(`${PREFIX}${buildQuery(query)}`)
}

export async function createEvent(body: unknown) {
  return platformFetch(PREFIX, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function getEvent(eventPk: string) {
  return platformFetch(`${PREFIX}/${encodeURIComponent(eventPk)}`)
}

export async function getDimension(dimension: string, query: Query) {
  return platformFetch(`${PREFIX}/dimensions/${encodeURIComponent(dimension)}${buildQuery(query)}`)
}
