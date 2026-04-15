import { useCallback, useEffect, useState } from 'react'
import type { PageState } from '@/shared/types/common'

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
  options?: { isEmpty?: (data: T) => boolean }
): QueryResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [state, setState] = useState<PageState>('loading')
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    setState('loading')
    setError(null)
    try {
      const result = await fetcher()
      setData(result)
      // Determine if data is empty for collections
      const isEmpty = options?.isEmpty ? options.isEmpty(result) : false
      setState(isEmpty ? 'empty' : 'ready')
    } catch (e) {
      setError(e as Error)
      setState('error')
    }
  }, [fetcher, options])

  useEffect(() => {
    refetch()
  }, [refetch])

  return {
    data,
    state,
    error,
    refetch,
    // Backward compatibility
    loading: state === 'loading',
  }
}
