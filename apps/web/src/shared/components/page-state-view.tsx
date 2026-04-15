import type { ReactNode } from 'react'
import type { PageState } from '@/shared/types/common'
import { PageLoading } from './page-loading'
import { PageError } from './page-error'
import { EmptyState } from './empty-state'

interface PageStateViewProps {
  state: PageState
  error: Error | null
  children: ReactNode
  emptyMessage?: string
  onRetry?: () => void
}

export function PageStateView({
  state,
  error,
  children,
  emptyMessage = 'No data available',
  onRetry,
}: PageStateViewProps) {
  switch (state) {
    case 'loading':
      return <PageLoading />
    case 'error':
      return <PageError message={error?.message} onRetry={onRetry} />
    case 'empty':
      return (
        <div className="card">
          <EmptyState message={emptyMessage} />
        </div>
      )
    case 'ready':
      return children
    default:
      return children
  }
}
