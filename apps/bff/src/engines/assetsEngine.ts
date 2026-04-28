import { platformFetch } from '../services/platform.js'

const PREFIX = '/api/v1/assets'

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

export async function listAssets(query: Query) {
  return platformFetch(`${PREFIX}${buildQuery(query)}`)
}

export async function createAsset(body: unknown) {
  return platformFetch(PREFIX, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function getAsset(assetId: string) {
  return platformFetch(`${PREFIX}/${encodeURIComponent(assetId)}`)
}
