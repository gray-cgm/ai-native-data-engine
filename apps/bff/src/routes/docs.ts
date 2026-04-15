import JoiRouter from 'koa-joi-router'

import { config } from '../config/index.js'
import type { AppRoute } from './route-types.js'

const { Joi } = JoiRouter as typeof JoiRouter & {
  Joi: {
    object(schema?: Record<string, unknown>): any
    string(): any
  }
}

export function getDocsRouter(routes: AppRoute[]) {
  const spec = buildRouteManifest(routes)

  const router = JoiRouter()
  router.prefix(config.apiPrefix)
  router.route([
    {
      method: 'get',
      path: '/swagger.json',
      meta: {
        swagger: {
          summary: 'OpenAPI JSON',
          tags: ['docs'],
        },
      },
      validate: {
        output: {
          200: {
            body: Joi.object().unknown(true),
          },
        },
      },
      handler: async (ctx) => {
        ctx.state.skipResponseEnvelope = true
        ctx.body = spec
      },
    },
    {
      method: 'get',
      path: '/doc',
      meta: {
        swagger: {
          summary: 'Documentation index',
          tags: ['docs'],
        },
      },
      validate: {
        output: {
          200: {
            body: Joi.string(),
          },
        },
      },
      handler: async (ctx) => {
        ctx.state.skipResponseEnvelope = true
        ctx.type = 'html'
        ctx.body = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${config.appName} API Docs</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #f5efe4; color: #1f2328; }
      main { max-width: 960px; margin: 0 auto; padding: 48px 24px 80px; }
      h1 { font-size: 32px; margin-bottom: 8px; }
      p { line-height: 1.6; }
      a { color: #0b6bcb; }
      pre { background: #111827; color: #f9fafb; padding: 20px; border-radius: 16px; overflow: auto; }
      .meta { color: #57606a; margin-bottom: 24px; }
    </style>
  </head>
  <body>
    <main>
      <h1>${config.appName} API Docs</h1>
      <p class="meta">Environment: ${config.env} | Prefix: ${config.apiPrefix}</p>
      <p>Route manifest JSON is available at <a href="${config.apiPrefix}/swagger.json">${config.apiPrefix}/swagger.json</a>.</p>
      <pre>${escapeHtml(JSON.stringify(spec.paths, null, 2))}</pre>
    </main>
  </body>
</html>`
      },
    },
  ])

  return router
}

function buildRouteManifest(routes: AppRoute[]) {
  const paths: Record<string, Record<string, unknown>> = {}

  for (const route of routes) {
    const pathKey = `${config.apiPrefix}${toOpenApiPath(route.path)}`
    const method = String(route.method).toLowerCase()
    paths[pathKey] ??= {}
    paths[pathKey][method] = {
      summary: route.meta?.swagger?.summary ?? null,
      description: route.meta?.swagger?.description ?? null,
      tags: route.meta?.swagger?.tags ?? [],
      auth: route.auth ?? false,
      validate: summarizeValidation(route.validate),
    }
  }

  return {
    openapi: '3.0.0-lite',
    info: {
      title: `${config.appName.toUpperCase()} API`,
      version: config.version,
      description: 'Generated from BFF route metadata and validation declarations.',
    },
    responseEnvelope: {
      appliedTo: 'all JSON API responses except /health, /api/doc and /api/swagger.json',
      shape: {
        status: 'number',
        code: 'number',
        success: 'boolean',
        detailMessage: 'string | null',
        message: {
          cn: 'string | null',
          en: 'string | null',
        },
        requestId: 'string',
        data: 'route-specific payload',
      },
    },
    paths,
  }
}

function summarizeValidation(validate: Record<string, unknown> | undefined) {
  if (!validate) {
    return {}
  }

  return {
    params: summarizeValidationSection(validate.params),
    query: summarizeValidationSection(validate.query),
    body: summarizeValidationSection(validate.body),
    type: typeof validate.type === 'string' ? validate.type : undefined,
    output: summarizeOutputSection(validate.output),
  }
}

function summarizeValidationSection(section: unknown) {
  if (!section) {
    return undefined
  }
  if (typeof section !== 'object') {
    return 'schema'
  }
  if (isJoiSchemaLike(section)) {
    return 'schema'
  }
  const keys = Object.keys(section)
  return keys.length > 0 ? keys : 'schema'
}

function summarizeOutputSection(section: unknown) {
  if (!section || typeof section !== 'object') {
    return undefined
  }
  return Object.keys(section)
}

function toOpenApiPath(pathname: string) {
  return pathname.replaceAll(/:([A-Za-z0-9_]+)/g, '{$1}')
}

function isJoiSchemaLike(value: object) {
  const keys = new Set(Object.keys(value))
  return keys.has('type') && keys.has('$_terms') && keys.has('_ids')
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}