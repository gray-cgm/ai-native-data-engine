import { apiGet } from '@/shared/api/client'
import type { ToolDescriptor, ToolHealth, ToolWorkspaceContext } from '@/shared/microfrontends/types'

type ToolRegistryApiItem = {
  id: string
  name: string
  short_name: string
  category: ToolDescriptor['category']
  summary: string
  description: string
  integration_mode: ToolDescriptor['integrationMode']
  base_url: string
  gateway_path: string
  health_path: string
  workspace_path: string
  capabilities: string[]
  use_cases: string[]
  notes?: string[]
}

type ToolRegistryApiResponse = {
  items: ToolRegistryApiItem[]
}

export async function fetchToolsRegistry(): Promise<ToolDescriptor[]> {
  const payload = await apiGet<ToolRegistryApiResponse>('/tools/registry')
  return payload.items.map((item) => ({
    id: item.id,
    name: item.name,
    shortName: item.short_name,
    icon: inferToolIcon(item.id),
    category: item.category,
    summary: item.summary,
    description: item.description,
    integrationMode: item.integration_mode,
    baseUrl: item.base_url,
    gatewayPath: item.gateway_path,
    healthPath: item.health_path,
    workspacePath: item.workspace_path,
    capabilities: item.capabilities,
    useCases: item.use_cases,
    route: {
      path: `/tools/${item.id}`,
      label: item.short_name,
    },
    notes: item.notes ?? [],
    quickLinks: inferQuickLinks(item.id),
    showLiveRuns: item.id === 'dagster',
  }))
}

export function fetchToolWorkspaceContext(toolId: string) {
  return apiGet<ToolWorkspaceContext>(`/tools/${toolId}/workspace-context`)
}

export function fetchToolHealth(toolId: string) {
  return apiGet<ToolHealth>(`/tools/${toolId}/health`)
}

function inferToolIcon(toolId: string) {
  if (toolId === 'dagster') return 'DR'
  if (toolId === 'superset') return 'BI'
  if (toolId === 'jupyter') return 'NB'
  return 'TL'
}

function inferQuickLinks(toolId: string): ToolDescriptor['quickLinks'] {
  if (toolId === 'dagster') {
    return [
      { label: 'Asset catalog', path: '/asset-groups' },
      { label: 'Run history', path: '/runs' },
      { label: 'Sensors', path: '/sensors' },
      { label: 'Schedules', path: '/schedules' },
    ]
  }

  if (toolId === 'superset') {
    return [
      { label: 'Dashboards', path: '/dashboard/list' },
      { label: 'SQL Lab', path: '/sqllab' },
      { label: 'Charts', path: '/chart/list' },
      { label: 'Datasets', path: '/tablemodelview/list' },
    ]
  }

  if (toolId === 'jupyter') {
    return [
      { label: 'Notebooks', path: '/lab/tree' },
      { label: 'File browser', path: '/lab' },
    ]
  }

  return []
}
