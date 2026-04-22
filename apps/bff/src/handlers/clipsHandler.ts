import type { Context } from 'koa'
import type { Readable } from 'node:stream'

import {
  buildUpstreamVideoUrl,
  getAlignedCameraFrames,
  getClipDetail,
  getClipFrames,
  getStandaloneTopic,
  queryClips,
} from '../engines/clipsEngine.js'

type ClipParams = { clipId: string }
type CameraParams = ClipParams & { camera: string }
type StandaloneParams = ClipParams & { name: string }

class ClipsHandler {
  async list(ctx: Context) {
    ctx.body = await queryClips(ctx.request.query as Record<string, unknown>)
  }

  async detail(ctx: Context) {
    const request = ctx.request as typeof ctx.request & { params: ClipParams }
    ctx.body = await getClipDetail(request.params.clipId)
  }

  async frames(ctx: Context) {
    const request = ctx.request as typeof ctx.request & { params: ClipParams }
    const query = ctx.request.query as Record<string, unknown>
    ctx.body = await getClipFrames(request.params.clipId, {
      topic: stringOrUndefined(query.topic),
      camera: stringOrUndefined(query.camera),
      limit: numberOrUndefined(query.limit),
      offset: numberOrUndefined(query.offset),
    })
  }

  async standaloneTopic(ctx: Context) {
    const request = ctx.request as typeof ctx.request & { params: StandaloneParams }
    const query = ctx.request.query as Record<string, unknown>
    ctx.body = await getStandaloneTopic(request.params.clipId, request.params.name, {
      limit: numberOrUndefined(query.limit),
      offset: numberOrUndefined(query.offset),
    })
  }

  async aligned(ctx: Context) {
    const request = ctx.request as typeof ctx.request & { params: CameraParams }
    const query = ctx.request.query as Record<string, unknown>
    ctx.body = await getAlignedCameraFrames(request.params.clipId, request.params.camera, {
      limit: numberOrUndefined(query.limit),
    })
  }

  async video(ctx: Context) {
    const request = ctx.request as typeof ctx.request & { params: CameraParams }
    const url = buildUpstreamVideoUrl(request.params.clipId, request.params.camera)
    const headers: Record<string, string> = {}
    const range = ctx.get('range')
    if (range) headers.range = range
    const upstream = await fetch(url, { headers })
    ctx.status = upstream.status
    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase()
      if (lower === 'content-length' || lower === 'content-range' || lower === 'accept-ranges' || lower === 'content-type') {
        ctx.set(key, value)
      }
    })
    ctx.state.skipResponseEnvelope = true
    if (!upstream.body) {
      ctx.body = null
      return
    }
    // Node 20+ supports passing a web ReadableStream directly as the body; Koa
    // will pipe it to the response.
    ctx.body = upstream.body as unknown as Readable
  }
}

function stringOrUndefined(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

function numberOrUndefined(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export default new ClipsHandler()
