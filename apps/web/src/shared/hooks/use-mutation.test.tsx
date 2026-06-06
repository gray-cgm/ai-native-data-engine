import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useMutation } from './use-mutation'

describe('useMutation', () => {
  it('runs action, exposes data, toggles loading', async () => {
    const action = vi.fn().mockResolvedValue({ id: 'x' })
    const { result } = renderHook(() => useMutation(action))

    expect(result.current.loading).toBe(false)
    let returned: unknown
    await act(async () => {
      returned = await result.current.mutate()
    })
    expect(returned).toEqual({ id: 'x' })
    expect(result.current.data).toEqual({ id: 'x' })
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('captures and rethrows errors', async () => {
    const action = vi.fn().mockRejectedValue(new Error('fail'))
    const { result } = renderHook(() => useMutation(action))

    await act(async () => {
      await expect(result.current.mutate()).rejects.toThrow('fail')
    })
    await waitFor(() => expect(result.current.error?.message).toBe('fail'))
    expect(result.current.loading).toBe(false)
  })
})
