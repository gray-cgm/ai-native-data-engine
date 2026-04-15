import { useCallback, useState } from 'react'

export type CommandState = 'idle' | 'submitting' | 'success' | 'error'

export interface CommandResult {
  state: CommandState
  message: string
  error: Error | null
}

interface UseCommandOptions {
  onSuccess?: (result: any) => void | Promise<void>
  onError?: (error: Error) => void | Promise<void>
}

export function useCommand<T extends any[], R = unknown>(
  execute: (...args: T) => Promise<R>,
  options?: UseCommandOptions,
) {
  const [state, setState] = useState<CommandState>('idle')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<Error | null>(null)

  const run = useCallback(
    async (...args: T) => {
      setState('submitting')
      setMessage('')
      setError(null)

      try {
        const result = await execute(...args)
        setState('success')
        setMessage('Operation completed successfully')
        if (options?.onSuccess) {
          await options.onSuccess(result)
        }
        return result
      } catch (err) {
        const error = err as Error
        setState('error')
        setMessage(`Operation failed: ${error.message}`)
        setError(error)
        if (options?.onError) {
          await options.onError(error)
        }
        throw error
      }
    },
    [execute, options],
  )

  const reset = useCallback(() => {
    setState('idle')
    setMessage('')
    setError(null)
  }, [])

  return { state, message, error, run, reset }
}
