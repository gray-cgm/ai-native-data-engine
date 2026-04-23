/**
 * Ops modules engine
 *
 * This engine owns **all** business logic for the six operational modules
 * (labeling / tagging / checking / mining / privacy / release).
 *
 * Following the BFF doctrine in
 * `docs/architecture/web-access-layer-bff-architecture.md`:
 *
 * - `services/` is reserved for external-system clients (platform.ts plus
 *   future kafka / flink / auth clients). It stays thin and generic.
 * - `engines/` is where business orchestration lives: input normalization,
 *   filter push-down, collection shaping, vocab caching, aggregation and
 *   module metadata.
 *
 * Therefore the ops-modules engine talks to the Platform API through the
 * single `platformFetch` primitive rather than through a per-domain service.
 */
import { errorCodes } from '../const/error.js'
import { AppError } from '../errors.js'
import { platformFetch } from '../services/platform.js'
import { applyCollectionQuery } from '../utils/collection.js'

// ────────────────────────────────────────────────────────────────────────
// Module registry + metadata
// ────────────────────────────────────────────────────────────────────────

export const OPS_MODULES = [
  'labeling',
  'tagging',
  'checking',
  'mining',
  'privacy',
  'release',
] as const

export type OpsModuleKey = (typeof OPS_MODULES)[number]

export const MODULE_META: Record<
  OpsModuleKey,
  {
    label: string
    description: string
    accent: string
    defaultStatus: string
    defaultKind: string
  }
> = {
  labeling: {
    label: 'Labeling',
    description: 'Human + auto annotation batches (2D/3D boxes, masks, tracks).',
    accent: '#1677ff',
    defaultStatus: 'draft',
    defaultKind: 'human',
  },
  tagging: {
    label: 'Tagging',
    description: 'Scenario / weather / geo / behaviour tags applied to clips.',
    accent: '#52c41a',
    defaultStatus: 'draft',
    defaultKind: 'manual',
  },
  checking: {
    label: 'Checking',
    description: 'Data gating + human QC: calibration, sync, label quality.',
    accent: '#fa8c16',
    defaultStatus: 'draft',
    defaultKind: 'gating',
  },
  mining: {
    label: 'Mining',
    description: 'Hard-case / active learning / similarity candidate discovery.',
    accent: '#722ed1',
    defaultStatus: 'queued',
    defaultKind: 'hard_case',
  },
  privacy: {
    label: 'Privacy',
    description: 'PII desensitization (face / plate / audio) jobs.',
    accent: '#eb2f96',
    defaultStatus: 'queued',
    defaultKind: 'face_blur',
  },
  release: {
    label: 'Release',
    description: 'Dataset version freeze / gate / approve / publish / archive.',
    accent: '#13c2c2',
    defaultStatus: 'drafted',
    defaultKind: 'dataset',
  },
}

// ────────────────────────────────────────────────────────────────────────
// DTOs (aligned with apps/api/src/api/routes/ops_modules.py)
// ────────────────────────────────────────────────────────────────────────

export type OpsItem = {
  id: string
  module: OpsModuleKey
  title: string
  status: string
  kind: string | null
  owner: string | null
  clip_ids: string[]
  dataset_id: string | null
  scenario: string | null
  requirement_id: string | null
  data_task_id: string | null
  payload: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type OpsItemCreateInput = {
  title: string
  status?: string
  kind?: string
  owner?: string
  clip_ids?: string[]
  dataset_id?: string
  scenario?: string
  requirement_id?: string
  data_task_id?: string
  payload?: Record<string, unknown>
}

export type OpsItemPatchInput = Partial<OpsItemCreateInput>

export type OpsVocab = {
  module: OpsModuleKey
  status_options: string[]
  kind_options: string[]
}

export type OpsStats = { module: OpsModuleKey; counts: Record<string, number> }

export type OpsOverview = {
  modules: Array<
    OpsStats & { label: string; accent: string; description: string }
  >
}

// ────────────────────────────────────────────────────────────────────────
// Module validation
// ────────────────────────────────────────────────────────────────────────

export function isOpsModule(value: unknown): value is OpsModuleKey {
  return typeof value === 'string' && (OPS_MODULES as readonly string[]).includes(value)
}

export function assertOpsModule(value: unknown): OpsModuleKey {
  if (!isOpsModule(value)) {
    throw new AppError(`Unknown ops module: ${String(value)}`, {
      status: 404,
      code: errorCodes.router.unknown,
      detailMessage: `Ops module must be one of ${OPS_MODULES.join(', ')}`,
    })
  }
  return value
}

// ────────────────────────────────────────────────────────────────────────
// Private helpers
// ────────────────────────────────────────────────────────────────────────

function toQuery(params: Record<string, unknown>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const suffix = search.toString()
  return suffix ? `?${suffix}` : ''
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

type PlatformListResponse = {
  items: OpsItem[]
  total: number
  limit: number
  offset: number
}

async function platformList(
  module: OpsModuleKey,
  query: Record<string, unknown>,
): Promise<PlatformListResponse> {
  return (await platformFetch(`/api/v1/ops/${module}${toQuery(query)}`)) as PlatformListResponse
}

// ────────────────────────────────────────────────────────────────────────
// Vocab cache (30s TTL) — avoids hammering the platform on every page load
// ────────────────────────────────────────────────────────────────────────

const VOCAB_TTL_MS = 30_000
const vocabCache = new Map<OpsModuleKey, { at: number; value: OpsVocab }>()

async function fetchVocabUncached(module: OpsModuleKey): Promise<OpsVocab> {
  return (await platformFetch(`/api/v1/ops/${module}/vocab`)) as OpsVocab
}

// ────────────────────────────────────────────────────────────────────────
// Public API — consumed by handlers
// ────────────────────────────────────────────────────────────────────────

/**
 * List items for a module, pushing scalar filters down to the platform while
 * applying free-text search, sort and pagination in the BFF — same pattern
 * every other management list page uses.
 */
export async function queryOpsItems(
  module: OpsModuleKey,
  query: Record<string, unknown>,
) {
  const platformQuery = {
    status: stringOrUndefined(query.status),
    kind: stringOrUndefined(query.kind),
    dataset_id:
      stringOrUndefined(query.datasetId) ?? stringOrUndefined(query.dataset_id),
    scenario: stringOrUndefined(query.scenario),
    requirement_id:
      stringOrUndefined(query.requirementId) ?? stringOrUndefined(query.requirement_id),
    data_task_id:
      stringOrUndefined(query.dataTaskId) ?? stringOrUndefined(query.data_task_id),
  }
  const response = await platformList(module, platformQuery)
  return applyCollectionQuery<OpsItem>(response.items ?? [], {
    query,
    defaultSort: { field: 'updated_at', order: 'desc' },
    searchableText: (item) =>
      [
        item.id,
        item.title,
        item.kind ?? '',
        item.owner ?? '',
        item.status,
        item.scenario ?? '',
        item.dataset_id ?? '',
        item.requirement_id ?? '',
        item.data_task_id ?? '',
        (item.clip_ids ?? []).join(' '),
      ].join(' '),
  })
}

export async function getOpsItemDetail(module: OpsModuleKey, id: string): Promise<OpsItem> {
  return (await platformFetch(`/api/v1/ops/${module}/${encodeURIComponent(id)}`)) as OpsItem
}

export async function createOpsItemForModule(
  module: OpsModuleKey,
  input: OpsItemCreateInput,
): Promise<OpsItem> {
  const title = typeof input?.title === 'string' ? input.title.trim() : ''
  if (!title) {
    throw new AppError('title is required', {
      status: 400,
      code: errorCodes.router.requestParamIncorrect,
      detailMessage: 'Cannot create an ops item without a non-empty title.',
    })
  }
  const meta = MODULE_META[module]
  const body: OpsItemCreateInput = {
    ...input,
    title,
    status: input.status ?? meta.defaultStatus,
    kind: input.kind ?? meta.defaultKind,
  }
  return (await platformFetch(`/api/v1/ops/${module}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })) as OpsItem
}

export async function patchOpsItemForModule(
  module: OpsModuleKey,
  id: string,
  patch: OpsItemPatchInput,
): Promise<OpsItem> {
  return (await platformFetch(`/api/v1/ops/${module}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch ?? {}),
  })) as OpsItem
}

export async function deleteOpsItemForModule(module: OpsModuleKey, id: string) {
  await platformFetch(`/api/v1/ops/${module}/${encodeURIComponent(id)}`, { method: 'DELETE' })
  return { ok: true, module, id }
}

export async function getOpsVocab(module: OpsModuleKey): Promise<OpsVocab> {
  const cached = vocabCache.get(module)
  if (cached && Date.now() - cached.at < VOCAB_TTL_MS) {
    return cached.value
  }
  const fresh = await fetchVocabUncached(module)
  vocabCache.set(module, { at: Date.now(), value: fresh })
  return fresh
}

export async function getOpsStats(module: OpsModuleKey): Promise<OpsStats> {
  return (await platformFetch(`/api/v1/ops/${module}/stats`)) as OpsStats
}

/**
 * Decorates the platform overview with module metadata so the Web can render
 * cards without cross-referencing a second lookup table.
 */
export async function getOpsOverview(): Promise<OpsOverview> {
  const raw = (await platformFetch('/api/v1/ops/overview')) as { modules: OpsStats[] }
  const modules = (raw.modules ?? []).map((stats) => {
    const meta = MODULE_META[stats.module]
    return {
      ...stats,
      label: meta?.label ?? stats.module,
      accent: meta?.accent ?? '#999999',
      description: meta?.description ?? '',
    }
  })
  return { modules }
}
