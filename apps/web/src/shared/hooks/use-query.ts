import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PageState } from '@/shared/types/common'

// ── Session-scoped query cache (stale-while-revalidate) ──
const queryCache = new Map<string, unknown>()

export interface QueryResult<T> {
  data: T | null
  state: PageState
  error: Error | null
  refetch: () => Promise<void>
  // Deprecated, use state instead
  loading: boolean
}

export function useQuery<T>(
  fetcher: () => Promise<T>,
  options?: { isEmpty?: (data: T) => boolean; cacheKey?: string },
): QueryResult<T> {
  const optionsRef = useRef(options)
  useEffect(() => { optionsRef.current = options }, [options])

  // Keep the latest fetcher in a ref so `refetch` is stable and inline
  // arrow functions don't cause infinite re-fetch loops.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const cacheKey = options?.cacheKey

  // Resolve cached value once on mount
  const cached = useMemo(() => {
    const key = options?.cacheKey
    return key && queryCache.has(key) ? (queryCache.get(key) as T) : undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [data, setData] = useState<T | null>(cached ?? null)
  const [state, setState] = useState<PageState>(() => {
    if (cached !== undefined) {
      const empty = options?.isEmpty?.(cached) ?? false
      return empty ? 'empty' : 'ready'
    }
    return 'loading'
  })
  const [error, setError] = useState<Error | null>(null)

  // When the component mounts with cached data the first auto-fetch is silent
  // (no loading flash). Manual refetch() always shows loading.
  const silentRef = useRef(cached !== undefined)

  const refetch = useCallback(async () => {
    const silent = silentRef.current
    silentRef.current = false
    if (!silent) {
      setState('loading')
    }
    setError(null)
    try {
      const result = await fetcherRef.current()
      setData(result)
      const key = optionsRef.current?.cacheKey
      if (key) queryCache.set(key, result)
      // Determine if data is empty for collections
      const isEmpty = optionsRef.current?.isEmpty ? optionsRef.current.isEmpty(result) : false
      setState(isEmpty ? 'empty' : 'ready')
    } catch (e) {
      setError(e as Error)
      // If we already have displayable data (from cache) keep showing it
      setState((prev) => (prev === 'ready' || prev === 'empty') ? prev : 'error')
    }
  }, [])

  // Re-fetch on mount and whenever cacheKey changes (e.g. navigating to a
  // different resource).  Using refetch in deps is safe since it's stable.
  useEffect(() => {
    refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey])

  return {
    data,
    state,
    error,
    refetch,
    // Backward compatibility
    loading: state === 'loading',
  }
}
