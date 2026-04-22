import { apiGet } from '@/shared/api/client'

export type ClipTopicRef = { name: string; non_null_count: number }
export type ClipCameraRef = { name: string; frame_count: number }
export type ClipStandaloneRef = { name: string; row_count: number }

export type ClipSummary = {
  clip_id: string
  keyframe_count: number
  start_time: number | null
  end_time: number | null
  duration_seconds: number | null
  vehicle_name: string | null
  city: string | null
  district: string | null
  scenario: string | null
  tags: string | null
  da_tags: string | null
  topics: ClipTopicRef[]
  cameras: ClipCameraRef[]
  standalone_topics: ClipStandaloneRef[]
  has_wm: boolean
}

export type ClipListResponse = { items: ClipSummary[]; pagination: { total: number; skip: number; limit: number } }

export type ClipCameraCatalogItem = {
  name: string
  position: string | null
  ros_topic: string | null
  model: string | null
  vendor: string | null
  width: number | null
  height: number | null
  hfov: number | null
  vfov: number | null
  is_avm: boolean
  extrinsic_xyz: [number | null, number | null, number | null] | null
  mp4_path: string | null
  mp4_resize_paths: string[]
  has_local_video: boolean
}

export type ClipDetail = {
  item: ClipSummary
  meta: {
    vehicle_name: string | null
    vehicle_model: number | null
    vehicle_info: Record<string, number> | null
    city: string | null
    district: string | null
    scenario: string | null
    tags: string | null
    da_tags: string | null
    jira_id: string | null
    start_time: number | null
    end_time: number | null
    calibration_version: number | null
  }
  camera_catalog: ClipCameraCatalogItem[]
}

export type ClipFrameRow = Record<string, unknown>
export type ClipFramesResponse = { items: ClipFrameRow[]; limit: number; offset: number }

export type ClipAlignedFrame = {
  timestamp: number
  video_frame_timestamp: number
  video_frame_index: number | null
}
export type ClipAlignedResponse = { camera: string; items: ClipAlignedFrame[] }

export async function fetchClips(params: { q?: string } = {}): Promise<ClipListResponse> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  const suffix = search.toString() ? `?${search.toString()}` : ''
  return apiGet<ClipListResponse>(`/clips${suffix}`)
}

export async function fetchClipDetail(clipId: string): Promise<ClipDetail> {
  return apiGet<ClipDetail>(`/clips/${encodeURIComponent(clipId)}`)
}

export async function fetchClipFrames(
  clipId: string,
  params: { topic?: string; camera?: string; limit?: number; offset?: number } = {},
): Promise<ClipFramesResponse> {
  const search = new URLSearchParams()
  if (params.topic) search.set('topic', params.topic)
  if (params.camera) search.set('camera', params.camera)
  if (params.limit != null) search.set('limit', String(params.limit))
  if (params.offset != null) search.set('offset', String(params.offset))
  const suffix = search.toString() ? `?${search.toString()}` : ''
  return apiGet<ClipFramesResponse>(`/clips/${encodeURIComponent(clipId)}/frames${suffix}`)
}

export async function fetchStandaloneTopic(
  clipId: string,
  name: string,
  params: { limit?: number; offset?: number } = {},
): Promise<ClipFramesResponse> {
  const search = new URLSearchParams()
  if (params.limit != null) search.set('limit', String(params.limit))
  if (params.offset != null) search.set('offset', String(params.offset))
  const suffix = search.toString() ? `?${search.toString()}` : ''
  return apiGet<ClipFramesResponse>(
    `/clips/${encodeURIComponent(clipId)}/standalone/${encodeURIComponent(name)}${suffix}`,
  )
}

export async function fetchAlignedCameraFrames(
  clipId: string,
  camera: string,
  params: { limit?: number } = {},
): Promise<ClipAlignedResponse> {
  const search = new URLSearchParams()
  if (params.limit != null) search.set('limit', String(params.limit))
  const suffix = search.toString() ? `?${search.toString()}` : ''
  return apiGet<ClipAlignedResponse>(
    `/clips/${encodeURIComponent(clipId)}/cameras/${encodeURIComponent(camera)}/aligned${suffix}`,
  )
}

export function buildClipVideoUrl(clipId: string, camera: string): string {
  const base = import.meta.env.VITE_API_BASE ?? '/api'
  return `${base}/clips/${encodeURIComponent(clipId)}/cameras/${encodeURIComponent(camera)}/video`
}
