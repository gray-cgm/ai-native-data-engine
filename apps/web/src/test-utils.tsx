import type { ReactElement, ReactNode } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

/** Render a component inside a MemoryRouter at an optional initial path. */
export function renderWithRouter(ui: ReactElement, initialEntries: string[] = ['/']) {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>)
}

/**
 * Render a route-aware page so that hooks like useParams() resolve.
 * `path` is the route pattern (e.g. '/requirements/:id'); `entry` the actual url.
 */
export function renderRoutePage(
  element: ReactNode,
  path: string,
  entry: string,
) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path={path} element={element} />
      </Routes>
    </MemoryRouter>,
  )
}
