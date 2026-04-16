export type ToolCategory = 'orchestration' | 'analytics' | 'notebook'

export type ToolIntegrationMode = 'direct-iframe' | 'proxy-iframe'

export interface ToolRouteDescriptor {
  path: string
  label: string
}

export interface ToolDescriptor {
  id: string
  name: string
  shortName: string
  icon: string
  category: ToolCategory
  summary: string
  description: string
  integrationMode: ToolIntegrationMode
  baseUrl: string
  gatewayPath: string
  healthPath: string
  docsPath?: string
  workspacePath: string
  capabilities: string[]
  useCases: string[]
  route: ToolRouteDescriptor
  notes?: string[]
}