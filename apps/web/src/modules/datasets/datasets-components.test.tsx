import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithRouter } from '@/test-utils'

const m = vi.hoisted(() => ({
  listDatasets: vi.fn(),
  createDataset: vi.fn(),
  getDataset: vi.fn(),
  flexibleCut: vi.fn(),
  listSamples: vi.fn(),
  promoteDataset: vi.fn(),
}))
vi.mock('./datasets-api', () => m)

import { DatasetPicker } from './dataset-picker'
import { NewDatasetModal } from './new-dataset-modal'

afterEach(() => vi.clearAllMocks())

const ds = {
  id: 'ds-1', name: 'Set A', dataset_type: 'customized', dataset_version: 1,
  source_type: 'tags', requirement_id: null, allow_train: true, status: 'active',
  tag_expr: null, slice_strategy: 'flexible', ts_policy: 'p', default_range_l: 0,
  default_range_r: 0, created_by: 'me', resolved_meta: null, created_at: null, updated_at: null,
}

describe('DatasetPicker', () => {
  it('loads active datasets on mount', async () => {
    m.listDatasets.mockResolvedValue({ items: [ds], total: 1 })
    renderWithRouter(<DatasetPicker value={null} onChange={() => {}} />)
    await waitFor(() => expect(m.listDatasets).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' })))
  })

  it('passes the dataset_type filter through', async () => {
    m.listDatasets.mockResolvedValue({ items: [], total: 0 })
    renderWithRouter(<DatasetPicker filterType="customized" onChange={() => {}} />)
    await waitFor(() =>
      expect(m.listDatasets).toHaveBeenCalledWith(expect.objectContaining({ dataset_type: 'customized' })),
    )
  })
})

describe('NewDatasetModal', () => {
  it('does not render fields when closed', () => {
    renderWithRouter(<NewDatasetModal open={false} onClose={() => {}} />)
    expect(screen.queryByText(/Create/)).not.toBeInTheDocument()
  })

  it('renders when open', async () => {
    renderWithRouter(<NewDatasetModal open onClose={() => {}} />)
    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeTruthy())
  })
})
