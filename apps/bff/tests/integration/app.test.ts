import type { Server } from 'node:http'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

import { config } from '../../src/config/index.js'
import { installFetchMock } from '../helpers/fetchMock.js'

let server: Server
let mock: ReturnType<typeof installFetchMock>

beforeAll(async () => {
  // getApp() loads routes via dynamic import of the route files.
  const { getApp } = await import('../../src/app.js')
  const app = await getApp()
  server = app.listen(0)
})

afterAll(() => {
  server?.close()
})

beforeEach(() => {
  mock = installFetchMock()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const agent = () => request(server)

describe('health & docs', () => {
  it('GET /health returns an un-enveloped health payload', async () => {
    const res = await agent().get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'ok', service: 'bff' })
    expect(res.body.success).toBeUndefined() // skipResponseEnvelope
  })

  it('GET /api/swagger.json returns the route manifest', async () => {
    const res = await agent().get('/api/swagger.json')
    expect(res.status).toBe(200)
    expect(res.body.openapi).toBeTruthy()
    expect(res.body.paths).toBeTruthy()
  })

  it('GET /api/doc returns HTML', async () => {
    const res = await agent().get('/api/doc')
    expect(res.status).toBe(200)
    expect(res.type).toContain('html')
    expect(res.text).toContain('API Docs')
  })

  it('unknown route yields the 404 error envelope', async () => {
    const res = await agent().get('/api/this-does-not-exist')
    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toBeTruthy()
    expect(res.headers['x-request-id']).toBeTruthy()
  })
})

describe('list endpoints wrap upstream data in the success envelope', () => {
  it('GET /api/workspaces aggregates + paginates + wraps', async () => {
    mock.on('/workspaces', {
      body: { items: [{ workspace_id: 'w1', name: 'Alpha' }, { workspace_id: 'w2', name: 'Beta' }] },
    })
    const res = await agent().get('/api/workspaces')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.code).toBe(0)
    expect(res.body.requestId).toBeTruthy()
    expect(res.body.data.items).toHaveLength(2)
    expect(res.body.data.pagination.total).toBe(2)
  })

  it('GET /api/assets forwards platform list as data', async () => {
    mock.on('/api/v1/assets', { body: { items: [{ id: 'a1' }], total: 1 } })
    const res = await agent().get('/api/assets?asset_kind=raw')
    expect(res.status).toBe(200)
    expect(res.body.data.items).toHaveLength(1)
    // pagination middleware/query forwarding: asset_kind reached upstream
    expect(mock.lastCall().url).toContain('asset_kind=raw')
  })

  it('GET /api/datasets translates page/pageSize to skip/limit upstream', async () => {
    mock.on('/api/v1/datasets', { body: { items: [] } })
    await agent().get('/api/datasets?page=2&pageSize=10')
    const url = mock.lastCall().url
    expect(url).toContain('skip=10')
    expect(url).toContain('limit=10')
  })
})

describe('detail + create endpoints', () => {
  it('GET /api/datasets/:id returns enveloped detail', async () => {
    mock.on('/api/v1/datasets/d1', { body: { dataset_id: 'd1', name: 'D' } })
    const res = await agent().get('/api/datasets/d1')
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ dataset_id: 'd1' })
  })

  it('POST /api/assets forwards the JSON body to the platform', async () => {
    mock.on('/api/v1/assets', { body: { id: 'a1' } }, 'POST')
    const res = await agent().post('/api/assets').send({ asset_kind: 'raw', name: 'x' })
    expect(res.status).toBe(200)
    expect(mock.lastCall().method).toBe('POST')
    expect(mock.lastCall().body).toMatchObject({ name: 'x' })
  })

  it('POST /api/requirements sets 201 on create', async () => {
    mock.on('/api/v1/requirements', {
      body: { id: 'r1', title: 'Req', priority: 'P0', source: 'manual', status: 'open', task_count: 0 },
    }, 'POST')
    const res = await agent()
      .post('/api/requirements')
      .send({ title: 'Req', priority: 'P0', source: 'manual', dre_owner: 'alice' })
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({ id: 'r1' })
  })
})

describe('ops-modules routes', () => {
  it('GET /api/ops/:module decorates the overview', async () => {
    mock.on('/api/v1/ops/overview', { body: { modules: [{ module: 'labeling', counts: { draft: 2 } }] } })
    const res = await agent().get('/api/ops/overview')
    expect(res.status).toBe(200)
    expect(res.body.data.modules[0].label).toBe('Labeling')
  })

  it('rejects an unknown ops module at the route validation layer (400)', async () => {
    // The :module param is constrained by Joi to the valid enum, so an invalid
    // module is rejected with a 400 before reaching the handler.
    const res = await agent().get('/api/ops/not-a-module')
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })
})

describe('upstream error propagation', () => {
  it('maps an upstream 5xx to the platform error envelope', async () => {
    mock.on('/api/v1/datasets/d-broken', { status: 503, body: { detailMessage: 'upstream unavailable' } })
    const res = await agent().get('/api/datasets/d-broken')
    expect(res.status).toBe(503)
    expect(res.body.success).toBe(false)
    expect(res.body.error.message).toBe('upstream unavailable')
  })
})

describe('tools-gateway-proxy', () => {
  it('proxies a request to the upstream tool and strips embedding headers', async () => {
    mock.on(config.toolBaseUrls.dagster, {
      status: 200,
      text: '<html>ok</html>',
      headers: { 'content-type': 'text/html', 'x-frame-options': 'DENY' },
    })
    const res = await agent().get('/api/tools-gateway/dagster/server_info')
    expect(res.status).toBe(200)
    expect(res.headers['x-frame-options']).toBeUndefined()
    expect(mock.lastCall().url).toContain('/server_info')
  })

  it('returns 404 for an unknown gateway tool', async () => {
    const res = await agent().get('/api/tools-gateway/unknown-tool/x')
    expect(res.status).toBe(404)
  })

  it('rewrites known absolute-path prefixes in HTML bodies through the gateway', async () => {
    mock.on(config.toolBaseUrls.dagster, {
      status: 200,
      text: '<script src="/_next/static/app.js"></script>',
      headers: { 'content-type': 'text/html' },
    })
    const res = await agent().get('/api/tools-gateway/dagster/')
    expect(res.status).toBe(200)
    expect(res.text).toContain('/api/tools-gateway/dagster/_next/static/app.js')
  })

  it('rewrites a same-origin Location redirect header to the gateway path', async () => {
    mock.on(config.toolBaseUrls.superset, {
      status: 302,
      text: '',
      headers: { location: '/login/', 'content-type': 'text/html' },
    })
    const res = await agent().get('/api/tools-gateway/superset/dashboard')
    expect(res.status).toBe(302)
    expect(res.headers['location']).toBe('/api/tools-gateway/superset/login/')
  })

  it('forwards a POST body to the upstream tool', async () => {
    mock.on(config.toolBaseUrls.jupyter, { status: 200, body: { ok: true }, headers: { 'content-type': 'application/json' } }, 'POST')
    const res = await agent()
      .post('/api/tools-gateway/jupyter/api/contents')
      .send({ name: 'nb' })
    expect(res.status).toBe(200)
    const upstreamCall = mock.calls[mock.calls.length - 1]
    expect(upstreamCall.method).toBe('POST')
    expect(upstreamCall.body).toMatchObject({ name: 'nb' })
  })
})

describe('docs-content routes', () => {
  it('GET /api/docs/tree returns the docs file tree', async () => {
    const res = await agent().get('/api/docs/tree')
    expect(res.status).toBe(200)
    expect(res.body.data.root).toBeTruthy()
    expect(Array.isArray(res.body.data.nodes)).toBe(true)
  })

  it('GET /api/docs/file reads a real markdown file', async () => {
    const res = await agent().get('/api/docs/file').query({ path: 'README.md' })
    expect(res.status).toBe(200)
    expect(res.body.data.content).toBeTruthy()
    expect(res.body.data.path).toContain('README.md')
    expect(typeof res.body.data.size).toBe('number')
  })

  it('GET /api/docs/file refuses path traversal with a schema-valid 404 envelope', async () => {
    // 处理器对非法路径抛 AppError(404)，由 exception 中间件产出符合
    // errorResponseSchema 的 envelope，不再被 output 校验拒成 500。
    const res = await agent().get('/api/docs/file').query({ path: '../../etc/passwd' })
    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
    expect(res.body.requestId).toBeTruthy()
    expect(res.body.error?.message).toBeTruthy()
  })

  it('GET /api/docs/file returns 404 for a missing markdown file', async () => {
    const res = await agent().get('/api/docs/file').query({ path: 'does-not-exist.md' })
    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })
})

describe('tools registry route', () => {
  it('GET /api/tools/registry returns the registry payload', async () => {
    const res = await agent().get('/api/tools/registry')
    expect(res.status).toBe(200)
    expect(res.body.data.items.length).toBe(4)
  })
})
