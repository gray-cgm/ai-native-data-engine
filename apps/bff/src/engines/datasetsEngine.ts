import { platformFetch } from '../services/platform.js'

const PREFIX = '/api/v1/datasets'

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

export async function listDatasets(query: Query) {
  return platformFetch(`${PREFIX}${buildQuery(query)}`)
}

export async function createDataset(body: unknown) {
  return platformFetch(PREFIX, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function getDataset(datasetId: string) {
  return platformFetch(`${PREFIX}/${encodeURIComponent(datasetId)}`)
}

export async function listSamples(datasetId: string, query: Query) {
  return platformFetch(`${PREFIX}/${encodeURIComponent(datasetId)}/samples${buildQuery(query)}`)
}

export async function cutClip(
  datasetId: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return platformFetch(`${PREFIX}/${encodeURIComponent(datasetId)}/cut`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

export async function addSamples(datasetId: string, body: unknown) {
  return platformFetch(`${PREFIX}/${encodeURIComponent(datasetId)}/samples`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function promoteDataset(
  datasetId: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return platformFetch(`${PREFIX}/${encodeURIComponent(datasetId)}/promote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body ?? {}),
  })
}
