import { useCallback, useState } from 'react'

export interface MutationResult<T> {
  data: T | null
  loading: boolean
  error: Error | null
  mutate: () => Promise<T>
}

export function useMutation<T>(action: () => Promise<T>): MutationResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const mutate = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await action()
      setData(result)
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setLoading(false)
    }
  }, [action])

  return { data, loading, error, mutate }
}
