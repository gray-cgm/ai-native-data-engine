import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useCommand } from './use-command'

describe('useCommand', () => {
  it('transitions idle -> success and fires onSuccess', async () => {
    const onSuccess = vi.fn()
    const execute = vi.fn().mockResolvedValue('ok')
    const { result } = renderHook(() => useCommand(execute, { onSuccess }))

    expect(result.current.state).toBe('idle')
    let out: unknown
    await act(async () => {
      out = await result.current.run('arg')
    })
    expect(out).toBe('ok')
    expect(execute).toHaveBeenCalledWith('arg')
    expect(result.current.state).toBe('success')
    expect(result.current.message).toMatch(/completed/)
    expect(onSuccess).toHaveBeenCalledWith('ok')
  })

  it('transitions to error and fires onError, rethrows', async () => {
    const onError = vi.fn()
    const execute = vi.fn().mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useCommand(execute, { onError }))

    await act(async () => {
      await expect(result.current.run()).rejects.toThrow('boom')
    })
    expect(result.current.state).toBe('error')
    expect(result.current.message).toContain('boom')
    expect(result.current.error?.message).toBe('boom')
    expect(onError).toHaveBeenCalled()
  })

  it('reset() returns to idle', async () => {
    const execute = vi.fn().mockResolvedValue(1)
    const { result } = renderHook(() => useCommand(execute))
    await act(async () => {
      await result.current.run()
    })
    act(() => result.current.reset())
    expect(result.current.state).toBe('idle')
    expect(result.current.message).toBe('')
    expect(result.current.error).toBeNull()
  })
})
