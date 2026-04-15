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
