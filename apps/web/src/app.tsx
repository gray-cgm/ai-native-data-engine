import { Suspense, useEffect } from 'react'
import { BrowserRouter, useRoutes } from 'react-router-dom'
import { ErrorBoundary } from '@/shared/components/error-boundary'
import { apiPost } from '@/shared/api/client'
import { routes } from './routes'

function AppRoutes() {
  return useRoutes(routes)
}

function BootstrapGuard({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    apiPost('/bootstrap').catch(() => {
      /* bootstrap is best-effort */
    })
  }, [])

  return <>{children}</>
}

export function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <BootstrapGuard>
          <Suspense fallback={<div className="page-loading">Loading...</div>}>
            <AppRoutes />
          </Suspense>
        </BootstrapGuard>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
