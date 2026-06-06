import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useQuery } from './use-query'

describe('useQuery', () => {
  it('starts loading then resolves to ready', async () => {
    const fetcher = vi.fn().mockResolvedValue([1, 2])
    const { result } = renderHook(() => useQuery(fetcher))

    expect(result.current.state).toBe('loading')
    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.state).toBe('ready'))
    expect(result.current.data).toEqual([1, 2])
    expect(result.current.error).toBeNull()
  })

  it('marks empty via isEmpty predicate', async () => {
    const fetcher = vi.fn().mockResolvedValue([] as number[])
    const { result } = renderHook(() =>
      useQuery<number[]>(fetcher, { isEmpty: (d) => d.length === 0 }),
    )
    await waitFor(() => expect(result.current.state).toBe('empty'))
  })

  it('sets error state on rejection', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('nope'))
    const { result } = renderHook(() => useQuery(fetcher))
    await waitFor(() => expect(result.current.state).toBe('error'))
    expect(result.current.error?.message).toBe('nope')
  })

  it('serves cached value silently on mount with cacheKey', async () => {
    const key = `cache-${Math.random()}`
    const first = vi.fn().mockResolvedValue('v1')
    const r1 = renderHook(() => useQuery(first, { cacheKey: key }))
    await waitFor(() => expect(r1.result.current.state).toBe('ready'))
    r1.unmount()

    const second = vi.fn().mockResolvedValue('v2')
    const r2 = renderHook(() => useQuery(second, { cacheKey: key }))
    // cached value is shown immediately, no loading flash
    expect(r2.result.current.state).toBe('ready')
    expect(r2.result.current.data).toBe('v1')
    await waitFor(() => expect(r2.result.current.data).toBe('v2'))
  })

  it('refetch shows loading and updates data', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce('a').mockResolvedValueOnce('b')
    const { result } = renderHook(() => useQuery(fetcher))
    await waitFor(() => expect(result.current.data).toBe('a'))

    await act(async () => {
      await result.current.refetch()
    })
    expect(result.current.data).toBe('b')
  })

  it('keeps showing cached data when refetch fails', async () => {
    const key = `cache-err-${Math.random()}`
    const ok = vi.fn().mockResolvedValue('good')
    const r1 = renderHook(() => useQuery(ok, { cacheKey: key }))
    await waitFor(() => expect(r1.result.current.state).toBe('ready'))
    r1.unmount()

    const bad = vi.fn().mockRejectedValue(new Error('later fail'))
    const r2 = renderHook(() => useQuery(bad, { cacheKey: key }))
    await waitFor(() => expect(r2.result.current.error?.message).toBe('later fail'))
    // state stays ready because we already had displayable data
    expect(r2.result.current.state).toBe('ready')
    expect(r2.result.current.data).toBe('good')
  })
})
