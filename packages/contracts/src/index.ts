export interface StorageAdapter {
  putFile(localPath: string, targetUri: string): Promise<string>
  getFile(sourceUri: string, localPath: string): Promise<string>
  exists(uri: string): Promise<boolean>
  list(prefix: string): Promise<string[]>
  delete(uri: string): Promise<void>
}

export interface QueryAdapter {
  query(sql: string, params?: Record<string, unknown>): Promise<Record<string, unknown>[]>
  createView(name: string, sql: string): Promise<void>
  registerTable(name: string, source: string): Promise<void>
  materializeTable(name: string, sql: string): Promise<void>
}

export interface ComputeRun {
  runId: string
  status: 'queued' | 'running' | 'success' | 'failed' | 'canceled'
  metadata?: Record<string, unknown>
}

export interface ComputeAdapter {
  submitJob(jobName: string, payload: Record<string, unknown>): Promise<ComputeRun>
  getRun(runId: string): Promise<ComputeRun>
  cancelRun(runId: string): Promise<void>
}

export interface MetadataAdapter {
  createDataset(payload: Record<string, unknown>): Promise<Record<string, unknown>>
  getDataset(datasetId: string): Promise<Record<string, unknown> | null>
  createDatasetVersion(payload: Record<string, unknown>): Promise<Record<string, unknown>>
  listDatasetVersions(datasetId: string): Promise<Record<string, unknown>[]>
  createJobRun(payload: Record<string, unknown>): Promise<Record<string, unknown>>
  appendLineageEvent(payload: Record<string, unknown>): Promise<Record<string, unknown>>
}

export interface SearchAdapter {
  indexSamples(datasetVersionId: string, records: Record<string, unknown>[]): Promise<void>
  searchSimilar(vector: number[], topK?: number): Promise<Record<string, unknown>[]>
  searchByFilters(filters: Record<string, unknown>, topK?: number): Promise<Record<string, unknown>[]>
}

export interface AuthAdapter {
  authenticate(username: string, password: string): Promise<Record<string, unknown> | null>
  issueToken(user: Record<string, unknown>): Promise<string>
  verifyToken(token: string): Promise<Record<string, unknown> | null>
  getUserRoles(userId: string, scope: string): Promise<string[]>
}
