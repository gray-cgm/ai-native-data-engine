import { apiGet, apiPost } from '@/shared/api/client'

// 单个标注的落库 DTO：tool/label/uid 平铺，data 存 cornerstone 完整 annotation 对象
// （含 metadata + 几何 handles），加载时可逐字回写到 viewport。
export interface SavedAnnotation {
  uid: string
  tool: string
  label?: string
  ts?: number
  data?: unknown
}

export interface SaveAnnotationsRequest {
  clip_id: string
  annotations: SavedAnnotation[]
  ops_item_id?: string
  requirement_id?: string
  x_trace_id?: string
  image_id?: string
}

export interface SaveAnnotationsResponse {
  event: LineageEventView
  ops_item: { id: string; status: string } | null
}

// 后端 serialize_event(with_results=True) 的精简视图
export interface LineageEventView {
  id: string
  event_id: string | null
  event_type: string
  x_trace_id: string | null
  created_at: string | null
  results: Array<{
    id: string
    clip_id: string
    da_tags: string | null
    note: string | null
    ts: number | null
    extra: { uid?: string; tool?: string; image_id?: string; data?: unknown } | null
  }>
}

export async function saveAnnotations(
  body: SaveAnnotationsRequest,
): Promise<SaveAnnotationsResponse> {
  return apiPost<SaveAnnotationsResponse>('/ops/labeling/annotations', body)
}

export async function loadAnnotations(
  clipId: string,
  xTraceId?: string,
): Promise<{ clip_id: string; event: LineageEventView | null }> {
  const params = new URLSearchParams({ clip_id: clipId })
  if (xTraceId) params.set('x_trace_id', xTraceId)
  return apiGet<{ clip_id: string; event: LineageEventView | null }>(
    `/ops/labeling/annotations?${params.toString()}`,
  )
}
