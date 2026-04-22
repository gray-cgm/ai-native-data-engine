import { apiDelete, apiGet, apiPatch, apiPost } from '@/shared/api/client'

export const OPS_MODULES = [
  'labeling',
  'tagging',
  'checking',
  'mining',
  'release',
] as const

export type OpsModuleKey = (typeof OPS_MODULES)[number]

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
  payload: Record<string, unknown>
  created_at: string
  updated_at: string
}

/** Shape returned by BFF after `applyCollectionQuery`. */
export type OpsItemListResponse = {
  items: OpsItem[]
  pagination: { total: number; skip: number; limit: number }
}

export type OpsVocab = {
  module: OpsModuleKey
  status_options: string[]
  kind_options: string[]
}

export type OpsStats = {
  module: OpsModuleKey
  counts: Record<string, number>
}

export type OpsOverviewItem = OpsStats & {
  label: string
  accent: string
  description: string
}

export type OpsOverview = { modules: OpsOverviewItem[] }

export type OpsItemCreateInput = {
  title: string
  status?: string
  kind?: string
  owner?: string
  clip_ids?: string[]
  dataset_id?: string
  scenario?: string
  requirement_id?: string
  payload?: Record<string, unknown>
}

export type OpsItemPatchInput = Partial<OpsItemCreateInput>

/** UI-only metadata (kept in sync with the BFF engine's `MODULE_META`). */
export const MODULE_META: Record<
  OpsModuleKey,
  { label: string; description: string; accent: string }
> = {
  labeling: {
    label: 'Labeling',
    description: 'Human + auto annotation batches — 2D/3D boxes, masks, tracks.',
    accent: '#1677ff',
  },
  tagging: {
    label: 'Tagging',
    description: 'Scenario / weather / geo / behaviour tags applied to clips.',
    accent: '#52c41a',
  },
  checking: {
    label: 'Checking',
    description: 'Data gating + human QC: calibration, sync, label quality, release gates.',
    accent: '#fa8c16',
  },
  mining: {
    label: 'Mining',
    description: 'Hard-case / active-learning / similarity candidate discovery.',
    accent: '#722ed1',
  },
  release: {
    label: 'Release',
    description: 'Dataset version freeze, sign-off, publish and training-set handoff.',
    accent: '#13c2c2',
  },
}

function toQuery(params: Record<string, unknown>): string {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    search.set(k, String(v))
  }
  const s = search.toString()
  return s ? `?${s}` : ''
}

export async function fetchOpsItems(
  module: OpsModuleKey,
  params: Record<string, unknown> = {},
): Promise<OpsItemListResponse> {
  return apiGet<OpsItemListResponse>(`/ops/${module}${toQuery(params)}`)
}

export async function fetchOpsItem(module: OpsModuleKey, id: string): Promise<OpsItem> {
  return apiGet<OpsItem>(`/ops/${module}/${encodeURIComponent(id)}`)
}

export async function createOpsItem(
  module: OpsModuleKey,
  body: OpsItemCreateInput,
): Promise<OpsItem> {
  return apiPost<OpsItem>(`/ops/${module}`, body)
}

export async function patchOpsItem(
  module: OpsModuleKey,
  id: string,
  body: OpsItemPatchInput,
): Promise<OpsItem> {
  return apiPatch<OpsItem>(`/ops/${module}/${encodeURIComponent(id)}`, body)
}

export async function deleteOpsItem(module: OpsModuleKey, id: string): Promise<void> {
  await apiDelete<unknown>(`/ops/${module}/${encodeURIComponent(id)}`)
}

export async function fetchOpsVocab(module: OpsModuleKey): Promise<OpsVocab> {
  return apiGet<OpsVocab>(`/ops/${module}/vocab`)
}

export async function fetchOpsStats(module: OpsModuleKey): Promise<OpsStats> {
  return apiGet<OpsStats>(`/ops/${module}/stats`)
}

export async function fetchOpsOverview(): Promise<OpsOverview> {
  return apiGet<OpsOverview>('/ops/overview')
}
