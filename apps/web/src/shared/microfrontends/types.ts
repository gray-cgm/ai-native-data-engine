export type ToolCategory = 'orchestration' | 'analytics' | 'notebook'

export type ToolIntegrationMode = 'direct-iframe' | 'proxy-iframe'

export interface ToolRouteDescriptor {
  path: string
  label: string
}

export interface ToolQuickLink {
  label: string
  path: string
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
  /** Deep-links into specific sections of the tool */
  quickLinks?: ToolQuickLink[]
  /** When true, the workspace sidebar fetches live run data from the platform */
  showLiveRuns?: boolean
}