import type { ClipDetail, ClipListResponse, ClipFramesResponse, ClipAlignedResponse } from '../types.js'
import { config } from '../config/index.js'
import { platformFetch } from './platform.js'

export async function listClips() {
  const response = (await platformFetch('/clips')) as ClipListResponse
  return response
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
  return (await platformFetch(`/clips/${clipId}/standalone/${encodeURIComponent(name)}${query}`)) as ClipFramesResponse
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

/**
 * Build the upstream video URL for a clip camera. Video bytes are proxied
 * through the BFF without JSON wrapping via the handler.
 */
export function buildUpstreamVideoUrl(clipId: string, camera: string) {
  return `${config.platformApiBaseUrl}/clips/${encodeURIComponent(clipId)}/cameras/${encodeURIComponent(camera)}/video`
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
