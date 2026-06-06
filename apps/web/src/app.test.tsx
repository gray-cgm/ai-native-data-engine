import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const apiPost = vi.fn().mockResolvedValue({})
const apiGet = vi.fn().mockResolvedValue({ items: [], total: 0 })
vi.mock('@/shared/api/client', () => ({
  apiPost: (...a: unknown[]) => apiPost(...a),
  apiGet: (...a: unknown[]) => apiGet(...a),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  ApiError: class extends Error {},
}))

import { App } from './app'

afterEach(() => vi.clearAllMocks())

describe('App', () => {
  it('mounts, fires the best-effort bootstrap, and renders a route', async () => {
    render(<App />)
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/bootstrap'))
    // app shell or a lazy page eventually resolves
    await waitFor(() => expect(document.body.textContent?.length ?? 0).toBeGreaterThan(0))
  })

  it('does not crash if bootstrap rejects', async () => {
    apiPost.mockRejectedValueOnce(new Error('bootstrap down'))
    render(<App />)
    await waitFor(() => expect(apiPost).toHaveBeenCalled())
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })
})
