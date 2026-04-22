import { Suspense, useEffect, useRef } from 'react'
import { BrowserRouter, useRoutes } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import { ErrorBoundary } from '@/shared/components/error-boundary'
import { apiPost } from '@/shared/api/client'
import { routes } from './routes'

const antdTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#2175ff',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    colorInfo: '#1677ff',
    borderRadius: 8,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  components: {
    Table: {
      headerBg: '#fafafa',
    },
    Card: {
      paddingLG: 24,
      headerFontSize: 18,
      headerFontSizeSM: 16,
    },
    Statistic: {
      contentFontSize: 28,
      titleFontSize: 14,
    },
  },
}

function AppRoutes() {
  return useRoutes(routes)
}

function BootstrapGuard({ children }: { children: React.ReactNode }) {
  const hasBootstrappedRef = useRef(false)

  useEffect(() => {
    if (hasBootstrappedRef.current) {
      return
    }
    hasBootstrappedRef.current = true

    apiPost('/bootstrap').catch(() => {
      /* bootstrap is best-effort */
    })
  }, [])

  return <>{children}</>
}

export function App() {
  return (
    <ConfigProvider theme={antdTheme}>
      <BrowserRouter>
        <ErrorBoundary>
          <BootstrapGuard>
            <Suspense fallback={<div className="page-loading">Loading...</div>}>
              <AppRoutes />
            </Suspense>
          </BootstrapGuard>
        </ErrorBoundary>
      </BrowserRouter>
    </ConfigProvider>
  )
}
