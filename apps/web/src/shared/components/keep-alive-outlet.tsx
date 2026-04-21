import { useRef, useState, Suspense } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'
import { Spin } from 'antd'

const MAX_CACHED_PAGES = 10

const LoadingFallback = (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
      width: '100%',
    }}
  >
    <Spin size="large" />
  </div>
)

/**
 * A KeepAlive-style Outlet that caches visited route pages.
 *
 * When the user navigates away from a page and later returns,
 * the cached DOM and component state are preserved — no remount,
 * no data refetch flash, and scroll position is kept.
 *
 * Implementation: each visited pathname's outlet element is stored in a ref
 * and rendered inside a wrapper with `display:none` when inactive.
 * React keeps the fiber tree (and therefore component state + DOM) alive
 * as long as the element stays in the render tree.
 *
 * Each cached outlet carries its own embedded RouteContext, so hooks
 * like useParams() / useMatch() continue to return the correct values
 * for the cached page.
 */
export function KeepAliveOutlet({ max = MAX_CACHED_PAGES }: { max?: number }) {
  const { pathname } = useLocation()
  const currentOutlet = useOutlet()

  // Map<pathname, ReactNode> — survives re-renders without losing cache
  const cacheRef = useRef(new Map<string, React.ReactNode>())
  // Counter only used to trigger a re-render when a new page enters the cache
  const [, bump] = useState(0)

  // Cache the outlet element on first visit to this pathname
  if (currentOutlet && !cacheRef.current.has(pathname)) {
    cacheRef.current.set(pathname, currentOutlet)

    // Evict the oldest page if cache exceeds max
    if (cacheRef.current.size > max) {
      for (const key of cacheRef.current.keys()) {
        if (key !== pathname) {
          cacheRef.current.delete(key)
          break
        }
      }
    }

    // Trigger re-render so the new entry appears
    bump((v) => v + 1)
  }

  return (
    <>
      {[...cacheRef.current.entries()].map(([path, element]) => (
        <div
          key={path}
          className="keep-alive-page"
          style={{
            display: path === pathname ? undefined : 'none',
            height: '100%',
            width: '100%',
          }}
        >
          <Suspense fallback={LoadingFallback}>{element}</Suspense>
        </div>
      ))}
    </>
  )
}
