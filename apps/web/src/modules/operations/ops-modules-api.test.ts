import { afterEach, describe, expect, it, vi } from 'vitest'

const apiGet = vi.fn()
const apiPost = vi.fn()
const apiPatch = vi.fn()
const apiDelete = vi.fn()
vi.mock('@/shared/api/client', () => ({
  apiGet: (...a: unknown[]) => apiGet(...a),
  apiPost: (...a: unknown[]) => apiPost(...a),
  apiPatch: (...a: unknown[]) => apiPatch(...a),
  apiDelete: (...a: unknown[]) => apiDelete(...a),
}))

import {
  MODULE_META,
  OPS_MODULES,
  createOpsItem,
  deleteOpsItem,
  fetchOpsItem,
  fetchOpsItems,
  fetchOpsStats,
  fetchOpsVocab,
  patchOpsItem,
} from './ops-modules-api'

afterEach(() => vi.clearAllMocks())

describe('ops-modules-api', () => {
  it('MODULE_META covers every OPS module', () => {
    for (const m of OPS_MODULES) {
      expect(MODULE_META[m].label).toBeTruthy()
    }
  })

  it('fetchOpsItems builds query, dropping empties', async () => {
    apiGet.mockResolvedValue({ items: [] })
    await fetchOpsItems('labeling', { status: 'done', kind: '', requirementId: 'r1' })
    const call = apiGet.mock.calls[0][0] as string
    expect(call.startsWith('/ops/labeling?')).toBe(true)
    expect(call).toContain('status=done')
    expect(call).toContain('requirementId=r1')
    expect(call).not.toContain('kind=')
  })

  it('fetchOpsItems omits query entirely when no params', async () => {
    apiGet.mockResolvedValue({ items: [] })
    await fetchOpsItems('mining')
    expect(apiGet).toHaveBeenCalledWith('/ops/mining')
  })

  it('fetchOpsItem / vocab / stats hit nested endpoints', async () => {
    apiGet.mockResolvedValue({})
    await fetchOpsItem('tagging', 'i 1')
    expect(apiGet).toHaveBeenCalledWith('/ops/tagging/i%201')
    await fetchOpsVocab('tagging')
    expect(apiGet).toHaveBeenCalledWith('/ops/tagging/vocab')
    await fetchOpsStats('tagging')
    expect(apiGet).toHaveBeenCalledWith('/ops/tagging/stats')
  })

  it('create / patch / delete use correct verbs', async () => {
    apiPost.mockResolvedValue({})
    apiPatch.mockResolvedValue({})
    apiDelete.mockResolvedValue(undefined)
    await createOpsItem('checking', { title: 'x' } as never)
    expect(apiPost).toHaveBeenCalledWith('/ops/checking', { title: 'x' })
    await patchOpsItem('checking', 'id1', { status: 'done' } as never)
    expect(apiPatch).toHaveBeenCalledWith('/ops/checking/id1', { status: 'done' })
    await deleteOpsItem('checking', 'id1')
    expect(apiDelete).toHaveBeenCalledWith('/ops/checking/id1')
  })
})
