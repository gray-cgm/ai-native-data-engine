export type RuntimeProfileName = 'local-dev' | 'team-dev' | 'enterprise-saas'

export type PlatformCapabilities = {
  multiTenant: boolean
  sso: boolean
  distributedCompute: boolean
  advancedGovernance: boolean
  objectStorage: boolean
}

export type FileFormatProfile = {
  currentPrimary: 'parquet' | 'lance'
  targetPrimary: 'parquet' | 'lance'
  retrievalFormat: 'parquet' | 'lance'
  exportDefault: 'lance' | 'csv' | 'jsonl'
}

export type LocalFsStorageConfig = {
  provider: 'local_fs'
  rootUri: string
}

export type MinioStorageConfig = {
  provider: 'minio'
  bucket: string
  endpoint: string
}

export type S3StorageConfig = {
  provider: 's3'
  bucket: string
  region: string
}

export type StorageConfig = LocalFsStorageConfig | MinioStorageConfig | S3StorageConfig

export type DuckDbQueryConfig = {
  provider: 'duckdb'
  database: string
}

export type StarRocksQueryConfig = {
  provider: 'starrocks'
  jdbcUrl: string
  database: string
}

export type TrinoQueryConfig = {
  provider: 'trino'
  server: string
  catalog: string
  schema: string
}

export type QueryConfig = DuckDbQueryConfig | StarRocksQueryConfig | TrinoQueryConfig

export type DagsterLocalComputeConfig = {
  provider: 'dagster_local'
}

export type DagsterK8sComputeConfig = {
  provider: 'dagster_k8s'
  sparkCluster?: string
  flinkEndpoint?: string
}

export type ComputeConfig = DagsterLocalComputeConfig | DagsterK8sComputeConfig

export type SqliteMetadataConfig = {
  provider: 'sqlite'
  database: string
}

export type PostgresMetadataConfig = {
  provider: 'postgres'
  dsn?: string
}

export type MetadataConfig = SqliteMetadataConfig | PostgresMetadataConfig

export type LanceSearchConfig = {
  provider: 'lance'
  uri: string
}

export type SearchConfig = LanceSearchConfig

export type LocalAuthConfig = {
  provider: 'local'
  jwtSecret?: string
}

export type OidcAuthConfig = {
  provider: 'oidc'
  issuer: string
  audience?: string
}

export type AuthConfig = LocalAuthConfig | OidcAuthConfig

export type RuntimeProfile = {
  name: RuntimeProfileName
  storage: StorageConfig
  fileFormats: FileFormatProfile
  query: QueryConfig
  compute: ComputeConfig
  metadata: MetadataConfig
  search: SearchConfig
  auth: AuthConfig
  capabilities: PlatformCapabilities
}

export const defaultProfiles: Record<RuntimeProfileName, RuntimeProfile> = {
  'local-dev': {
    name: 'local-dev',
    storage: { provider: 'local_fs', rootUri: './data' },
    fileFormats: { currentPrimary: 'lance', targetPrimary: 'lance', retrievalFormat: 'lance', exportDefault: 'lance' },
    query: { provider: 'duckdb', database: './data/duckdb/app.duckdb' },
    compute: { provider: 'dagster_local' },
    metadata: { provider: 'sqlite', database: './data/metadata/metadata.db' },
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
    fileFormats: { currentPrimary: 'lance', targetPrimary: 'lance', retrievalFormat: 'lance', exportDefault: 'lance' },
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
    fileFormats: { currentPrimary: 'lance', targetPrimary: 'lance', retrievalFormat: 'lance', exportDefault: 'lance' },
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
