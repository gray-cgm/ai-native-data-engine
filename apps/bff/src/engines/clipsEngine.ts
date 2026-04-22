import type { ClipSummary } from '../types.js'
import { applyCollectionQuery } from '../utils/collection.js'
import { config } from '../config/index.js'
import { platformFetch } from '../services/platform.js'
import type {
  ClipAlignedResponse,
  ClipDetail,
  ClipFramesResponse,
  ClipListResponse,
} from '../types.js'

type Query = Record<string, unknown>

async function listClips() {
  return (await platformFetch('/clips')) as ClipListResponse
}

function buildQuery(params: Record<string, unknown>) {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== '')
  if (entries.length === 0) return ''
  const search = new URLSearchParams()
  for (const [key, value] of entries) {
    search.append(key, String(value))
  }
  return `?${search.toString()}`
}

export async function queryClips(query: Query) {
  const response = await listClips()
  const items = response.items ?? []
  return applyCollectionQuery<ClipSummary>(items, {
    query,
    defaultSort: { field: 'start_time', order: 'desc' },
    searchableText: (item) =>
      [
        item.clip_id,
        item.vehicle_name ?? '',
        item.city ?? '',
        item.district ?? '',
        item.scenario ?? '',
        item.tags ?? '',
        item.da_tags ?? '',
      ].join(' '),
  })
}

export async function getClipDetail(clipId: string) {
  return (await platformFetch(`/clips/${clipId}`)) as ClipDetail
}

export async function getClipFrames(
  clipId: string,
  params: { topic?: string; camera?: string; limit?: number; offset?: number },
) {
  const query = buildQuery(params)
  return (await platformFetch(`/clips/${clipId}/frames${query}`)) as ClipFramesResponse
}

export async function getStandaloneTopic(
  clipId: string,
  name: string,
  params: { limit?: number; offset?: number },
) {
  const query = buildQuery(params)
  return (await platformFetch(
    `/clips/${clipId}/standalone/${encodeURIComponent(name)}${query}`,
  )) as ClipFramesResponse
}

export async function getAlignedCameraFrames(
  clipId: string,
  camera: string,
  params: { limit?: number },
) {
  const query = buildQuery(params)
  return (await platformFetch(
    `/clips/${clipId}/cameras/${encodeURIComponent(camera)}/aligned${query}`,
  )) as ClipAlignedResponse
}

export function buildUpstreamVideoUrl(clipId: string, camera: string) {
  return `${config.platformApiBaseUrl}/clips/${encodeURIComponent(clipId)}/cameras/${encodeURIComponent(camera)}/video`
}
