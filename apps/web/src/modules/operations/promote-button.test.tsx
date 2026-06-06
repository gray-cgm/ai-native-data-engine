import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithRouter } from '@/test-utils'

const m = vi.hoisted(() => ({
  getDataset: vi.fn(),
  promoteDataset: vi.fn(),
}))
vi.mock('@/modules/datasets/datasets-api', () => m)

import { PromoteToOfficialButton } from './components/promote-to-official-button'
import type { OpsItem } from './ops-modules-api'

function item(over: Partial<OpsItem> = {}): OpsItem {
  return {
    id: 'item-1',
    module: 'release',
    title: 't',
    status: 'approved',
    kind: null,
    owner: null,
    clip_ids: [],
    dataset_id: 'ds-1',
    scenario: null,
    requirement_id: 'req-1',
    data_task_id: null,
    operations_task_id: null,
    x_trace_id: null,
    payload: {},
    created_at: '2026-01-01',
    updated_at: '2026-01-02',
    ...over,
  }
}

afterEach(() => vi.clearAllMocks())

describe('PromoteToOfficialButton', () => {
  it('is disabled until the item is approved with a dataset', () => {
    renderWithRouter(<PromoteToOfficialButton item={item({ status: 'draft' })} refresh={async () => {}} />)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
  })

  it('opens the modal and loads the source dataset', async () => {
    m.getDataset.mockResolvedValue({
      item: {
        id: 'ds-1', name: 'Set', dataset_type: 'customized', dataset_version: 1, source_type: 'tags',
        requirement_id: null, allow_train: true, status: 'active', tag_expr: 'x', slice_strategy: 'flexible',
        ts_policy: 'p', default_range_l: 0, default_range_r: 0, created_by: 'me', resolved_meta: null,
        created_at: null, updated_at: null,
      },
      sample_count: 12,
    })
    renderWithRouter(<PromoteToOfficialButton item={item()} refresh={async () => {}} />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(m.getDataset).toHaveBeenCalledWith('ds-1'))
  })
})
