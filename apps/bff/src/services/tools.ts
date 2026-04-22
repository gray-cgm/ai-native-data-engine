import { config } from '../config/index.js'
import { AppError } from '../errors.js'
import type {
  DatasetItem,
  DatasetVersion,
  ToolHealthPayload,
  ToolRegistryItem,
  ToolRegistryPayload,
  ToolWorkspaceContextPayload,
  WorkspaceItem,
} from '../types.js'
import { platformFetch } from './platform.js'

type ToolId = 'dagster' | 'superset' | 'jupyter'

type ToolDefinition = Omit<ToolRegistryItem, 'id' | 'base_url' | 'gateway_path'>

const TOOL_DEFINITIONS: Record<ToolId, ToolDefinition> = {
  dagster: {
    name: 'Dagster Control Plane',
    short_name: 'Dagster',
    category: 'orchestration',
    summary: 'Pipeline orchestration, asset materialization, and run operations.',
    description: 'Dagster is integrated into the platform shell for run operations and asset health.',
    integration_mode: 'proxy-iframe',
    health_path: '/server_info',
    workspace_path: '/tools/dagster',
    contract_version: 'v2',
    policy_profile: 'platform-default',
    owner: 'data-platform',
    capabilities: ['Asset catalog', 'Run queue visibility', 'Backfills', 'Sensors and schedules'],
    use_cases: ['Inspect materializations', 'Trigger assets', 'Debug failed runs'],
    notes: ['Proxy mode is preferred in local and production to keep same-origin embedding.'],
  },
  superset: {
    name: 'Superset BI Studio',
    short_name: 'Superset',
    category: 'analytics',
    summary: 'Dashboards, SQL lab, chart exploration, and governed analytics.',
    description: 'Superset is integrated as BI workspace with gateway-first embedding mode.',
    integration_mode: 'proxy-iframe',
    health_path: '/health',
    workspace_path: '/tools/superset',
    contract_version: 'v2',
    policy_profile: 'platform-default',
    owner: 'data-platform',
    capabilities: ['Dashboard viewing', 'Ad hoc SQL', 'Semantic datasets', 'Chart authoring'],
    use_cases: ['Explore aggregates', 'Publish metrics', 'Share BI views'],
    notes: ['Embedded mode should always use gateway path to avoid direct iframe failures.'],
  },
  jupyter: {
    name: 'Jupyter Lab Workspace',
    short_name: 'Jupyter',
    category: 'notebook',
    summary: 'Notebook authoring, exploratory analysis, and quick validation loops.',
    description: 'Jupyter workspace integrated with same-origin gateway for notebook exploration.',
    integration_mode: 'proxy-iframe',
    health_path: '/api/status',
    workspace_path: '/tools/jupyter',
    contract_version: 'v2',
    policy_profile: 'platform-default',
    owner: 'data-platform',
    capabilities: ['Notebook editing', 'Kernel execution', 'Exploratory analysis', 'Ad hoc profiling'],
    use_cases: ['Validate samples', 'Prototype queries', 'Inspect intermediate artifacts'],
    notes: ['Production should isolate kernels by workspace and user policy.'],
  },
}

type WorkspaceContextRequest = {
  requestId?: string | null
  actor?: string | null
}

function toToolId(value: string): ToolId | null {
  return value in TOOL_DEFINITIONS ? (value as ToolId) : null
}

export async function fetchToolRegistry(): Promise<ToolRegistryPayload> {
  const items: ToolRegistryItem[] = (Object.keys(TOOL_DEFINITIONS) as ToolId[]).map((toolId) => {
    const tool = TOOL_DEFINITIONS[toolId]
    return {
      id: toolId,
      ...tool,
      base_url: config.toolBaseUrls[toolId],
      gateway_path: `${config.apiPrefix}/tools-gateway/${toolId}/`,
    }
  })

  return { items }
}

export async function fetchToolWorkspaceContext(
  toolId: string,
  request: WorkspaceContextRequest = {},
): Promise<ToolWorkspaceContextPayload> {
  const normalizedToolId = toToolId(toolId)
  if (!normalizedToolId) {
    throw new AppError(`Unknown tool id: ${toolId}`, {
      status: 404,
      detailMessage: `Unknown tool id: ${toolId}`,
    })
  }

  const datasetsResponse = (await platformFetch('/datasets').catch(() => ({ items: [] }))) as { items?: DatasetItem[] }
  const datasets = datasetsResponse.items ?? []
  const datasetId = datasets[0]?.dataset_id ?? null

  let datasetVersionId: string | null = null
  if (datasetId) {
    const versionsResponse = (await platformFetch(`/datasets/${encodeURIComponent(datasetId)}/versions`).catch(() => ({ items: [] }))) as {
      items?: DatasetVersion[]
    }
    datasetVersionId = versionsResponse.items?.[0]?.version_id ?? null
  }

  const workspacesResponse = (await platformFetch('/workspaces').catch(() => ({ items: [] }))) as { items?: WorkspaceItem[] }
  const workspaceId = workspacesResponse.items?.[0]?.workspace_id ?? null

  return {
    tool_id: normalizedToolId,
    workspace_id: workspaceId,
    dataset_id: datasetId,
    dataset_version_id: datasetVersionId,
    request_id: request.requestId ?? null,
    actor: request.actor ?? 'platform-operator',
  }
}

export async function fetchToolHealth(toolId: string): Promise<ToolHealthPayload> {
  return platformFetch(`/tools/${encodeURIComponent(toolId)}/health`) as Promise<ToolHealthPayload>
}
