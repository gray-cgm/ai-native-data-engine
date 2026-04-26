import type { Context, Next } from 'koa'

import { config } from '../config/index.js'
import { AppError } from '../errors.js'

const TOOL_ID_SET = new Set(['dagster', 'superset', 'jupyter', 'kafka-ui'])
type ToolId = 'dagster' | 'superset' | 'jupyter' | 'kafka-ui'

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
])

/**
 * Path prefixes each tool serves that must be rewritten to go through the
 * gateway proxy so that sub-resource requests from the same-origin iframe
 * resolve correctly.
 */
const TOOL_REWRITE_PREFIXES: Record<string, string[]> = {
  dagster: ['/_next/', '/__next', '/graphql'],
  superset: ['/static/', '/superset/', '/api/', '/login/'],
  jupyter: ['/static/', '/api/', '/lab/', '/terminals/', '/nbextensions/'],
  'kafka-ui': ['/static/', '/api/', '/actuator/', '/ui/'],
}

const REWRITABLE_CONTENT_TYPES = [
  'text/html',
  'text/css',
  'text/javascript',
  'application/javascript',
  'application/json',
  'text/plain',
]

export async function toolsGatewayProxy(ctx: Context, next: Next) {
  const prefix = `${config.apiPrefix}/tools-gateway/`
  if (!ctx.path.startsWith(prefix)) {
    await next()
    return
  }

  const remainder = ctx.path.slice(prefix.length)
  const slashIndex = remainder.indexOf('/')
  const rawToolId = slashIndex >= 0 ? remainder.slice(0, slashIndex) : remainder
  const toolId = rawToolId as ToolId

  if (!TOOL_ID_SET.has(toolId)) {
    throw new AppError(`Unknown tool gateway target: ${rawToolId}`, { status: 404, detailMessage: `Unknown tool: ${rawToolId}` })
  }

  const toolBase = config.toolBaseUrls[toolId]
  const rawSubPath = slashIndex >= 0 ? remainder.slice(slashIndex) : '/'
  const subPath = rawSubPath.startsWith('/') ? rawSubPath : `/${rawSubPath}`

  const upstreamUrl = new URL(subPath, `${toolBase}/`)
  if (ctx.querystring) {
    upstreamUrl.search = ctx.querystring
  }

  const upstreamHeaders = buildUpstreamHeaders(ctx)
  const hasRequestBody = ctx.method !== 'GET' && ctx.method !== 'HEAD'
  const requestBody = hasRequestBody ? getRequestBody(ctx) : undefined

  const response = await fetch(upstreamUrl.toString(), {
    method: ctx.method,
    headers: upstreamHeaders,
    body: requestBody,
    redirect: 'manual',
  })

  ctx.state.skipResponseEnvelope = true
  ctx.status = response.status

  for (const [key, value] of response.headers.entries()) {
    const lower = key.toLowerCase()
    // Strip embedding-blocking headers, content-length (recalculated by Koa),
    // and content-encoding (Node.js fetch already decoded the body).
    if (
      lower === 'x-frame-options' ||
      lower === 'content-security-policy' ||
      lower === 'content-length' ||
      lower === 'content-encoding'
    ) {
      continue
    }

    if (lower === 'location') {
      ctx.set(key, rewriteLocation(value, toolId))
      continue
    }

    ctx.set(key, value)
  }

  const payload = await response.arrayBuffer()
  const contentType = response.headers.get('content-type') ?? ''
  ctx.body = rewriteResponseBody(Buffer.from(payload), contentType, toolId)
}

function buildUpstreamHeaders(ctx: Context): Headers {
  const headers = new Headers()

  for (const [key, value] of Object.entries(ctx.headers)) {
    if (!value) {
      continue
    }
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      continue
    }

    if (Array.isArray(value)) {
      headers.set(key, value.join(', '))
      continue
    }

    headers.set(key, value)
  }

  // Request uncompressed responses so body rewriting works on plain text.
  headers.set('accept-encoding', 'identity')

  return headers
}

function rewriteLocation(locationHeader: string, toolId: ToolId) {
  if (!locationHeader) {
    return locationHeader
  }

  if (locationHeader.startsWith('/')) {
    return `${config.apiPrefix}/tools-gateway/${toolId}${locationHeader}`
  }

  try {
    const parsed = new URL(locationHeader)
    const base = config.toolBaseUrls[toolId]
    const baseUrl = new URL(`${base}/`)

    if (parsed.origin === baseUrl.origin) {
      return `${config.apiPrefix}/tools-gateway/${toolId}${parsed.pathname}${parsed.search}${parsed.hash}`
    }
  } catch {
    return locationHeader
  }

  return locationHeader
}

function getRequestBody(ctx: Context): BodyInit | undefined {
  const requestBody = (ctx.request as Context['request'] & { body?: unknown }).body
  if (requestBody == null) {
    return undefined
  }

  if (typeof requestBody === 'string' || requestBody instanceof URLSearchParams) {
    return requestBody
  }

  if (Buffer.isBuffer(requestBody)) {
    return new Uint8Array(requestBody)
  }

  if (typeof requestBody === 'object') {
    return JSON.stringify(requestBody)
  }

  return String(requestBody)
}

// ── Response body rewriting ────────────────────────────────────────────

function isRewritableContent(contentType: string): boolean {
  const ct = contentType.split(';')[0].trim().toLowerCase()
  return REWRITABLE_CONTENT_TYPES.some((t) => ct === t)
}

/**
 * Rewrite known absolute-path references in text responses so that
 * sub-resource requests (scripts, styles, API calls, etc.) route back
 * through the gateway proxy instead of hitting the Vite dev server directly.
 *
 * Two passes:
 *  1. Replace full tool base URLs (`http://127.0.0.1:3001`) with the
 *     gateway base path.
 *  2. Replace known path-prefix patterns that appear inside quoted strings
 *     or CSS `url()` parentheses.
 */
function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function rewriteResponseBody(body: Buffer, contentType: string, toolId: ToolId): Buffer {
  if (!isRewritableContent(contentType)) {
    return body
  }

  const prefixes = TOOL_REWRITE_PREFIXES[toolId]
  if (!prefixes || prefixes.length === 0) {
    return body
  }

  const gatewayBase = `${config.apiPrefix}/tools-gateway/${toolId}`
  const toolBase = config.toolBaseUrls[toolId]

  let text = body.toString('utf-8')

  // Pass 1 – rewrite full origin URLs so they become gateway-relative.
  // e.g.  http://127.0.0.1:3001/_next/  →  /api/tools-gateway/dagster/_next/
  if (toolBase) {
    text = text.replaceAll(toolBase, gatewayBase)
  }

  // Pass 2 – rewrite bare absolute paths in a SINGLE regex pass.
  // A negative lookahead prevents matching paths that were already
  // rewritten (by pass 1 or by this same replacement) so we never
  // produce double-prefixed URLs like  /api/tools-gateway/t/api/tools-gateway/t/...
  const escapedGateway = escapeForRegex(gatewayBase)
  const alternatives = prefixes.map((p) => escapeForRegex(p)).join('|')
  const pattern = new RegExp(
    `((?:["'(]|&#34;))(?!${escapedGateway})(${alternatives})`,
    'g',
  )
  text = text.replace(pattern, (_match, delim: string, prefix: string) => {
    return `${delim}${gatewayBase}${prefix}`
  })

  // Superset embeds bootstrap JSON in a data attribute. Keep its
  // application_root aligned with the gateway prefix so client-side
  // route building does not jump to host-level /login.
  if (toolId === 'superset') {
    text = text.replace(
      /(&#34;application_root&#34;\s*:\s*&#34;)\/(#?[^\"]*&#34;)?/g,
      `$1${gatewayBase}/$2`,
    )
    text = text.replace(
      /("application_root"\s*:\s*")\/(#?[^\"]*")/g,
      `$1${gatewayBase}/$2`,
    )
  }

  return Buffer.from(text, 'utf-8')
}
