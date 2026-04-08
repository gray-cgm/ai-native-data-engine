export type SampleRecord = {
  id: string
  image_path: string
  metadata_path: string
  scene: string
  timestamp: string
  tags: string[]
}

export type DatasetSummary = {
  dataset_id: string
  name: string
  sample_count: number
  profile: 'personal' | 'enterprise'
}

export type MiningTask = {
  id: string
  query: string
  status: 'pending' | 'running' | 'done'
}

export type PlatformCapabilities = {
  multiTenant: boolean
  sso: boolean
  distributedCompute: boolean
  advancedGovernance: boolean
  objectStorage: boolean
}

export type RuntimeProfileName = 'local-dev' | 'team-dev' | 'enterprise-saas'

export type RuntimeProfile = {
  name: RuntimeProfileName
  storage: Record<string, unknown>
  query: Record<string, unknown>
  compute: Record<string, unknown>
  metadata: Record<string, unknown>
  search: Record<string, unknown>
  auth: Record<string, unknown>
  capabilities: PlatformCapabilities
}
