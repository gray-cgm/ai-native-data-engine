import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

const host = process.env.BFF_HOST ?? '0.0.0.0'
const port = Number(process.env.BFF_PORT ?? 3100)
const platformApiBaseUrl = (process.env.PLATFORM_API_BASE_URL ?? 'http://localhost:8000').replace(/\/$/, '')

type DistributionRow = { scene: string; sample_count: number }
type DatasetVersion = { version_id: string; dataset_id: string; sample_count: number; table_name: string }
type DatasetItem = { dataset_id: string; name: string; workspace_id: string; profile: string }
type TaskItem = { task_id: string; title: string; status: string; task_type: string }
type WorkspaceItem = { workspace_id: string; name: string }
type ExportItem = { export_id: string; dataset_id: string; format: string; status: string; output_path: string }
type SearchRow = { id: string; scene: string; dataset_version_id?: string }

type DashboardPayload = {
  distribution: DistributionRow[]
  datasets: DatasetItem[]
  datasetVersions: Record<string, DatasetVersion[]>
  tasks: TaskItem[]
  workspaces: WorkspaceItem[]
  exports: ExportItem[]
  searchRows: SearchRow[]
}

function setCorsHeaders(response: ServerResponse) {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  setCorsHeaders(response)
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Uint8Array[] = []

  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }

  if (chunks.length === 0) {
    return {}
  }

  const raw = Buffer.concat(chunks).toString('utf-8')
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
}

async function platformFetch(pathname: string, init?: RequestInit) {
  const response = await fetch(`${platformApiBaseUrl}${pathname}`, init)
  const text = await response.text()

  if (!response.ok) {
    throw new Error(text || `Platform API request failed: ${response.status}`)
  }

  return text ? (JSON.parse(text) as unknown) : null
}

async function buildDashboardPayload(): Promise<DashboardPayload> {
  const [distributionRes, datasetsRes, tasksRes, workspacesRes, exportsRes, searchRes] = await Promise.all([
    platformFetch('/samples/distribution'),
    platformFetch('/datasets'),
    platformFetch('/tasks'),
    platformFetch('/workspaces'),
    platformFetch('/exports'),
    platformFetch('/samples/search-preview'),
  ])

  const datasets = ((datasetsRes as { items?: DatasetItem[] }).items ?? []) as DatasetItem[]
  const versionEntries = await Promise.all(
    datasets.map(async (item) => {
      const detail = (await platformFetch(`/datasets/${item.dataset_id}`)) as { versions?: DatasetVersion[] }
      return [item.dataset_id, detail.versions ?? []] as const
    }),
  )

  return {
    distribution: ((distributionRes as { distribution?: DistributionRow[] }).distribution ?? []) as DistributionRow[],
    datasets,
    datasetVersions: Object.fromEntries(versionEntries),
    tasks: ((tasksRes as { items?: TaskItem[] }).items ?? []) as TaskItem[],
    workspaces: ((workspacesRes as { items?: WorkspaceItem[] }).items ?? []) as WorkspaceItem[],
    exports: ((exportsRes as { items?: ExportItem[] }).items ?? []) as ExportItem[],
    searchRows: ((searchRes as { rows?: SearchRow[] }).rows ?? []) as SearchRow[],
  }
}

const server = createServer(async (request, response) => {
  setCorsHeaders(response)

  if (!request.url) {
    sendJson(response, 400, { error: { message: 'Missing request URL' } })
    return
  }

  if (request.method === 'OPTIONS') {
    response.statusCode = 204
    response.end()
    return
  }

  const url = new URL(request.url, `http://${request.headers.host ?? `${host}:${port}`}`)
  const pathname = url.pathname

  try {
    if (request.method === 'GET' && pathname === '/health') {
      sendJson(response, 200, {
        status: 'ok',
        service: 'bff',
        upstream: platformApiBaseUrl,
      })
      return
    }

    if (request.method === 'POST' && pathname === '/api/bootstrap') {
      const payload = await platformFetch('/samples/ingest-demo', { method: 'POST' })
      sendJson(response, 200, payload)
      return
    }

    if (request.method === 'GET' && pathname === '/api/dashboard') {
      const payload = await buildDashboardPayload()
      sendJson(response, 200, payload)
      return
    }

    const exportMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/exports$/)
    if (request.method === 'POST' && exportMatch) {
      const body = await readJsonBody(request)
      const format = typeof body.format === 'string' && body.format.length > 0 ? body.format : 'parquet'
      const datasetId = exportMatch[1]
      const payload = await platformFetch(`/exports/dataset/${datasetId}?format=${encodeURIComponent(format)}`, {
        method: 'POST',
      })
      sendJson(response, 200, payload)
      return
    }

    sendJson(response, 404, { error: { message: `Route not found: ${request.method} ${pathname}` } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    sendJson(response, 500, { error: { message } })
  }
})

server.listen(port, host, () => {
  console.log(`BFF server listening on http://${host}:${port}`)
})
