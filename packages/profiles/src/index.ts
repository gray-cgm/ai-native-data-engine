export type RuntimeProfileName = 'local-dev' | 'team-dev' | 'enterprise-saas'

export type PlatformCapabilities = {
  multiTenant: boolean
  sso: boolean
  distributedCompute: boolean
  advancedGovernance: boolean
  objectStorage: boolean
}

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

export const defaultProfiles: Record<RuntimeProfileName, RuntimeProfile> = {
  'local-dev': {
    name: 'local-dev',
    storage: { provider: 'local_fs', rootUri: './data' },
    query: { provider: 'duckdb', database: './data/duckdb/app.duckdb' },
    compute: { provider: 'dagster_local' },
    metadata: { provider: 'postgres' },
    search: { provider: 'lance', uri: './data/lance/samples.lance' },
    auth: { provider: 'local' },
    capabilities: {
      multiTenant: false,
      sso: false,
      distributedCompute: false,
      advancedGovernance: false,
      objectStorage: false,
    },
  },
  'team-dev': {
    name: 'team-dev',
    storage: { provider: 'minio', bucket: 'ad-data', endpoint: 'http://minio:9000' },
    query: { provider: 'duckdb', database: './data/duckdb/team.duckdb' },
    compute: { provider: 'dagster_local' },
    metadata: { provider: 'postgres' },
    search: { provider: 'lance', uri: './data/lance/team_samples.lance' },
    auth: { provider: 'local' },
    capabilities: {
      multiTenant: false,
      sso: false,
      distributedCompute: false,
      advancedGovernance: false,
      objectStorage: true,
    },
  },
  'enterprise-saas': {
    name: 'enterprise-saas',
    storage: { provider: 's3', bucket: 'ad-enterprise-data', region: 'ap-southeast-1' },
    query: { provider: 'starrocks', jdbcUrl: 'jdbc:mysql://starrocks-fe:9030', database: 'ad_platform' },
    compute: { provider: 'dagster_k8s' },
    metadata: { provider: 'postgres' },
    search: { provider: 'lance', uri: 's3://ad-enterprise-data/lance/samples/' },
    auth: { provider: 'oidc', issuer: 'https://sso.company.com' },
    capabilities: {
      multiTenant: true,
      sso: true,
      distributedCompute: true,
      advancedGovernance: true,
      objectStorage: true,
    },
  },
}

export function getProfileCapabilities(name: RuntimeProfileName): PlatformCapabilities {
  return defaultProfiles[name].capabilities
}
